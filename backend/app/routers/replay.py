"""
replay.py — Router FastAPI pour le Mode Replay ThePnLab
Rejouer une journée de marché historique bougie par bougie (intraday 5min)

Installation :
  1. Copier dans backend/app/routers/replay.py
  2. Dans backend/app/main.py ajouter :
       from app.routers import replay
       app.include_router(replay.router)
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/replay", tags=["replay"])

# ── Tickers disponibles en mode replay ──────────────────────────────────────
REPLAY_TICKERS = {
    "BTC-USD": "Bitcoin",
    "ETH-USD": "Ethereum",
    "NVDA":    "NVIDIA",
    "AAPL":    "Apple",
    "TSLA":    "Tesla",
    "MSFT":    "Microsoft",
    "GOOGL":   "Google",
    "META":    "Meta",
    "AMD":     "AMD",
}

# ── Modèles Pydantic ─────────────────────────────────────────────────────────
class Candle(BaseModel):
    time:   str
    open:   float
    high:   float
    low:    float
    close:  float
    volume: float
    rsi:    Optional[float]
    sma20:  Optional[float]
    macd:   Optional[float]
    signal: Optional[float]

class SessionResponse(BaseModel):
    ticker:     str
    date:       str
    candles:    List[Candle]
    open_price: float
    close_price: float
    day_change_pct: float

class AvailableDaysResponse(BaseModel):
    ticker: str
    dates:  List[str]

# ── Calcul des indicateurs ───────────────────────────────────────────────────
def _compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    close = df["Close"].squeeze()

    # RSI 14
    delta = close.diff()
    gain  = delta.clip(lower=0)
    loss  = (-delta).clip(lower=0)
    avg_gain = gain.ewm(com=13, adjust=False).mean()
    avg_loss = loss.ewm(com=13, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, 1e-9)
    df["RSI"] = (100 - 100 / (1 + rs)).round(2)

    # SMA 20
    df["SMA20"] = close.rolling(20).mean().round(2)

    # MACD (12, 26, 9)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df["MACD"]   = (ema12 - ema26).round(4)
    df["SIGNAL"] = df["MACD"].ewm(span=9, adjust=False).mean().round(4)

    return df

# ── Endpoint : jours disponibles pour un ticker ──────────────────────────────
@router.get("/available-days", response_model=AvailableDaysResponse)
def available_days(ticker: str = Query("BTC-USD")):
    """
    Retourne les 30 derniers jours de bourse disponibles pour le ticker.
    On exclut aujourd'hui (données intraday incomplètes).
    """
    if ticker not in REPLAY_TICKERS:
        raise HTTPException(400, f"Ticker non supporté. Disponibles : {list(REPLAY_TICKERS)}")

    try:
        # Téléchargement des 45 derniers jours en daily pour connaître les jours de bourse
        df = yf.download(ticker, period="45d", interval="1d", progress=False, auto_adjust=True)
        if df.empty:
            raise HTTPException(503, "Données indisponibles")

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Exclure aujourd'hui et garder les 30 derniers jours ouvrés
        today = pd.Timestamp.now(tz="UTC").normalize()
        df = df[df.index < today]
        dates = [d.strftime("%Y-%m-%d") for d in df.index[-30:]]
        dates.reverse()  # Du plus récent au plus ancien

        return AvailableDaysResponse(ticker=ticker, dates=dates)

    except Exception as e:
        raise HTTPException(503, f"Erreur données : {str(e)}")


# ── Endpoint : session replay pour un ticker + date ──────────────────────────
@router.get("/session", response_model=SessionResponse)
def get_session(
    ticker: str = Query("BTC-USD"),
    date:   str = Query(..., description="Format YYYY-MM-DD"),
):
    """
    Retourne toutes les bougies 5min d'une journée donnée avec indicateurs.
    Les bougies sont retournées en ordre chronologique pour le dévoilement progressif.
    """
    if ticker not in REPLAY_TICKERS:
        raise HTTPException(400, f"Ticker non supporté.")

    try:
        target = pd.Timestamp(date)
    except Exception:
        raise HTTPException(400, "Format de date invalide. Utiliser YYYY-MM-DD")

    try:
        # Téléchargement intraday 5min sur 7 jours autour de la date
        start = (target - timedelta(days=3)).strftime("%Y-%m-%d")
        end   = (target + timedelta(days=2)).strftime("%Y-%m-%d")

        df = yf.download(
            ticker,
            start=start,
            end=end,
            interval="5m",
            progress=False,
            auto_adjust=True,
        )

        if df.empty:
            raise HTTPException(404, f"Aucune donnée pour {ticker} le {date}")

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Filtrer uniquement le jour demandé
        df.index = pd.to_datetime(df.index, utc=True)
        day_df = df[df.index.date == target.date()].copy()

        if day_df.empty:
            raise HTTPException(404, f"Aucune donnée intraday pour {ticker} le {date} (jour férié ou week-end ?)")

        if len(day_df) < 10:
            raise HTTPException(404, f"Données insuffisantes ({len(day_df)} bougies) pour {date}")

        # Calcul indicateurs sur toute la série (pas seulement le jour)
        full_df = _compute_indicators(df.copy())
        day_indicators = full_df[full_df.index.date == target.date()]

        # Construction des bougies
        candles = []
        for ts, row in day_df.iterrows():
            ind_row = day_indicators.loc[ts] if ts in day_indicators.index else None
            candles.append(Candle(
                time   = ts.strftime("%H:%M"),
                open   = round(float(row["Open"]),  4),
                high   = round(float(row["High"]),  4),
                low    = round(float(row["Low"]),   4),
                close  = round(float(row["Close"]), 4),
                volume = round(float(row["Volume"]), 0),
                rsi    = round(float(ind_row["RSI"]),    2) if ind_row is not None and pd.notna(ind_row["RSI"])    else None,
                sma20  = round(float(ind_row["SMA20"]),  2) if ind_row is not None and pd.notna(ind_row["SMA20"])  else None,
                macd   = round(float(ind_row["MACD"]),   4) if ind_row is not None and pd.notna(ind_row["MACD"])   else None,
                signal = round(float(ind_row["SIGNAL"]), 4) if ind_row is not None and pd.notna(ind_row["SIGNAL"]) else None,
            ))

        open_price  = candles[0].open
        close_price = candles[-1].close
        day_change  = round((close_price - open_price) / open_price * 100, 2)

        return SessionResponse(
            ticker          = ticker,
            date            = date,
            candles         = candles,
            open_price      = open_price,
            close_price     = close_price,
            day_change_pct  = day_change,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, f"Erreur serveur : {str(e)}")
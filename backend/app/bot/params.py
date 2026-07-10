"""
params.py — paramètres de risque et constantes du bot (v5).
v4 : -$250 sur bot AI → trop de trades en baisse de marché + SL trop serré.
v5 : MAX_PCT réduit, SL élargi pour absorber la volatilité intraday, cash +.
"""
from __future__ import annotations

import pytz

PARIS_TZ = pytz.timezone("Europe/Paris")
NY_TZ    = pytz.timezone("America/New_York")

BOT_PORTFOLIO_NAME = "AI"
BOT_ACTOR          = "BOT"

# ── Sizing par confiance ─────────────────────────────────────────────────────
MAX_PCT_HIGH   = 0.15   # HIGH : 15% max (était 20% — trop exposé sur 1 trade)
MAX_PCT_MEDIUM = 0.10   # MEDIUM : 10% (était 13%)
MAX_PCT_LOW    = 0.06   # LOW : 6% (était 8%)
MIN_CASH_RESERVE = 0.20 # Garder 20% de cash (était 15% — plus de buffer)
MAX_OPEN_POSITIONS = 4  # Max 4 positions (diversification > concentration)

# Tickers protégés — jamais bannis par le ML (liquidité mondiale, piliers crypto)
NEVER_BAN_TICKERS = {"BTC-USD", "ETH-USD"}

# ── Circuit breaker + VIX ────────────────────────────────────────────────────
SPY_DROP_THRESHOLD = -0.050  # -5% → circuit breaker
VIX_HIGH_THRESHOLD = 25.0    # Réduction sizing au-dessus
VIX_EXTREME        = 40.0    # Panic mode — SELL ALL + 0 BUY

# ── TP/SL ────────────────────────────────────────────────────────────────────
TP_THRESHOLD  = 0.15   # Take profit à +15%
SL_THRESHOLD  = -0.07  # Stop-loss à -7% (était -5% — trop serré pour ETF 3x)
PYRAMID_THRESHOLD = 0.10  # Pyramiding à +10%

# ── Univers crypto tradé par le bot (24/7) ───────────────────────────────────
CRYPTO_TICKERS = {"BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "ADA-USD", "XRP-USD", "DOGE-USD"}

# ── Sanity check prix — mouvement journalier max acceptable par catégorie ────
# Au-delà, le prix est suspect (glitch yfinance, données stales, mauvais
# ticker) : le trade est annulé plutôt que d'exécuter à un mauvais prix.
LEVERAGED_ETFS = {
    "TQQQ","SOXL","SPXL","NVDL","TECL","UDOW","LABU",
    "FAS","UPRO","TNA","BULZ","WEBL","WANT","HIBL","FNGU",
}
MAX_DAILY_MOVE: dict[str, float] = {
    "leveraged": 0.40,  # ETF 3x → jusqu'à ±40% sur un crash extrême
    "crypto":    0.25,  # crypto — volatilité naturelle élevée
    "default":   0.18,  # stocks & ETFs standard — crash 1987 = -22% en 1j
}

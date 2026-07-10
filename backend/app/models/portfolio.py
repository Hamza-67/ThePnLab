from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.services.timeutils import utcnow

class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    cash: Mapped[float] = mapped_column(Float, default=10000.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    ticker: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[float] = mapped_column(Float, default=0.0)   # ← Float (crypto fractions)
    avg_price: Mapped[float] = mapped_column(Float, default=0.0)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    ticker: Mapped[str] = mapped_column(String(20))
    side: Mapped[str] = mapped_column(String(4))
    price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[float] = mapped_column(Float)                 # ← Float (crypto fractions)
    profit: Mapped[float] = mapped_column(Float, default=0.0)
    actor: Mapped[str] = mapped_column(String(10), default="USER")
    rationale: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class EquitySnapshot(Base):
    __tablename__ = "equity_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    equity: Mapped[float] = mapped_column(Float, default=0.0)
    cash: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TradeFeature(Base):
    """Features techniques capturées au moment d'un BUY bot — dataset futur XGBoost."""
    __tablename__ = "trade_features"

    id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.id"), index=True)
    ticker: Mapped[str] = mapped_column(String(20))
    rsi: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    macd_signal: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    adx: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    atr_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    volume_surge: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    momentum_1d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    momentum_5d: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bb_position: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    above_sma50: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    vix: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    spy_change: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    regime: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # BULL | BEAR | UNKNOWN
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class BotCycle(Base):
    __tablename__ = "bot_cycles"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    decisions_json: Mapped[str] = mapped_column(Text, default="[]")
    screened_assets_json: Mapped[str] = mapped_column(Text, default="[]")
    market_summary_fr: Mapped[str] = mapped_column(Text, default="")
    market_summary_en: Mapped[str] = mapped_column(Text, default="")
    spy_change: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    vix: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    macro_news: Mapped[str] = mapped_column(Text, default="")
    users_processed: Mapped[int] = mapped_column(Integer, default=0)
    total_trades: Mapped[int] = mapped_column(Integer, default=0)
    portfolio_value_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    portfolio_value_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cycle_duration_s: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    errors_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
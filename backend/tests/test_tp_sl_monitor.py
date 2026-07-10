"""
Tests du monitor TP/SL 10 min : une position à -8% doit être vendue en totalité,
une position à +16% doit être vendue à 60%, une position entre les deux ne bouge pas.
"""
import pytest

from app.models.portfolio import Portfolio, Position, Trade
from app.bot import tp_sl_monitor


@pytest.fixture()
def bot_portfolio(db_session, auth_user):
    return db_session.query(Portfolio).filter(
        Portfolio.user_id == auth_user.id, Portfolio.name == "AI"
    ).one()


def _run_monitor(db_session, monkeypatch, price: float) -> int:
    """Lance run_tp_sl_check sur la DB de test avec un prix mocké partout."""
    monkeypatch.setattr("app.database.SessionLocal", lambda: db_session)
    # close/rollback ne doivent pas tuer la session de test
    monkeypatch.setattr(db_session, "close", lambda: None)
    monkeypatch.setattr("app.bot.pricing._get_price", lambda t: price)
    monkeypatch.setattr("app.bot.execution._get_price", lambda t: price)
    return tp_sl_monitor.run_tp_sl_check()


def test_monitor_stop_loss_sells_all(db_session, bot_portfolio, monkeypatch):
    # Position achetée à $100, prix actuel $92 → -8% < SL -7%
    db_session.add(Position(portfolio_id=bot_portfolio.id, ticker="NVDA",
                            quantity=10.0, avg_price=100.0))
    db_session.commit()

    sells = _run_monitor(db_session, monkeypatch, price=92.0)

    assert sells == 1
    pos = db_session.query(Position).filter(Position.ticker == "NVDA").one()
    assert float(pos.quantity) == 0.0            # SL → vente totale
    trade = db_session.query(Trade).filter(Trade.side == "SELL").one()
    assert "STOP LOSS MONITOR" in trade.rationale


def test_monitor_take_profit_sells_60pct(db_session, bot_portfolio, monkeypatch):
    # Position achetée à $100, prix actuel $116 → +16% > TP +15%
    db_session.add(Position(portfolio_id=bot_portfolio.id, ticker="BTC-USD",
                            quantity=1.0, avg_price=100.0))
    db_session.commit()

    sells = _run_monitor(db_session, monkeypatch, price=116.0)

    assert sells == 1
    pos = db_session.query(Position).filter(Position.ticker == "BTC-USD").one()
    assert 0.35 <= float(pos.quantity) <= 0.45   # ~40% restant après vente 60%


def test_monitor_position_in_range_untouched(db_session, bot_portfolio, monkeypatch):
    # -3% : ni SL ni TP → aucune vente
    db_session.add(Position(portfolio_id=bot_portfolio.id, ticker="AAPL",
                            quantity=5.0, avg_price=100.0))
    db_session.commit()

    sells = _run_monitor(db_session, monkeypatch, price=97.0)

    assert sells == 0
    pos = db_session.query(Position).filter(Position.ticker == "AAPL").one()
    assert float(pos.quantity) == 5.0
    assert db_session.query(Trade).count() == 0

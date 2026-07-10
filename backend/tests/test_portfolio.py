"""Tests portfolio : ordres BUY/SELL avec prix mocké (pas d'appel yfinance)."""
import pytest

from app.config import STARTING_CASH, FEE_RATE, SLIPPAGE_BPS
from app.models.portfolio import Position, Portfolio


@pytest.fixture(autouse=True)
def mock_market(monkeypatch):
    """Prix fixe $100 + marché toujours ouvert — aucun appel réseau en test."""
    import app.routers.portfolio as pf_module
    monkeypatch.setattr(pf_module, "_last_price", lambda ticker: 100.0)
    monkeypatch.setattr(pf_module, "_check_market_open", lambda ticker: (True, "ouvert"))
    monkeypatch.setattr(pf_module, "_invalidate_price", lambda ticker: None)


def test_order_requires_auth(client):
    resp = client.post("/api/portfolio/order", json={
        "ticker": "AAPL", "side": "BUY", "mode": "amount", "value": 100,
    })
    assert resp.status_code == 401


def test_buy_order_updates_cash_and_position(client, auth_headers, db_session, auth_user):
    resp = client.post("/api/portfolio/order", headers=auth_headers, json={
        "ticker": "AAPL", "side": "BUY", "mode": "amount", "value": 1000,
    })
    assert resp.status_code == 200, resp.json()

    pf = db_session.query(Portfolio).filter(
        Portfolio.user_id == auth_user.id, Portfolio.name == "USER"
    ).first()
    pos = db_session.query(Position).filter(
        Position.portfolio_id == pf.id, Position.ticker == "AAPL"
    ).first()
    assert pos is not None
    assert pos.quantity > 0
    assert pf.cash < STARTING_CASH  # cash débité (montant + slippage + frais)


def test_buy_rejects_insufficient_cash(client, auth_headers):
    resp = client.post("/api/portfolio/order", headers=auth_headers, json={
        "ticker": "AAPL", "side": "BUY", "mode": "amount", "value": STARTING_CASH * 10,
    })
    assert resp.status_code == 400
    assert "insuffisant" in resp.json()["detail"].lower()


def test_sell_without_position_rejected(client, auth_headers):
    resp = client.post("/api/portfolio/order", headers=auth_headers, json={
        "ticker": "TSLA", "side": "SELL", "mode": "qty", "value": 5,
    })
    assert resp.status_code == 400


def test_buy_then_sell_roundtrip(client, auth_headers, db_session, auth_user):
    r1 = client.post("/api/portfolio/order", headers=auth_headers, json={
        "ticker": "NVDA", "side": "BUY", "mode": "qty", "value": 10,
    })
    assert r1.status_code == 200

    r2 = client.post("/api/portfolio/order", headers=auth_headers, json={
        "ticker": "NVDA", "side": "SELL", "mode": "qty", "value": 10,
    })
    assert r2.status_code == 200

    pf = db_session.query(Portfolio).filter(
        Portfolio.user_id == auth_user.id, Portfolio.name == "USER"
    ).first()
    pos = db_session.query(Position).filter(
        Position.portfolio_id == pf.id, Position.ticker == "NVDA"
    ).first()
    assert pos.quantity == pytest.approx(0.0)
    # Aller-retour au même prix → on perd uniquement slippage + frais
    slip = SLIPPAGE_BPS / 10000
    expected_loss = 10 * 100.0 * (2 * slip + 2 * FEE_RATE)
    assert STARTING_CASH - float(pf.cash) == pytest.approx(expected_loss, rel=0.05)


def test_order_rejects_invalid_amount(client, auth_headers):
    resp = client.post("/api/portfolio/order", headers=auth_headers, json={
        "ticker": "AAPL", "side": "BUY", "mode": "amount", "value": 0,
    })
    assert resp.status_code == 400

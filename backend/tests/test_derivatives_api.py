"""
Tests API des dérivés (CFD + Futures) : ouverture, fermeture, caps de levier,
liquidation automatique via summary.
"""
import pytest

import app.routers.portfolio as pf_module
from app.models.portfolio import Position, Trade
from app.config import FEE_RATE


PRICE = {"value": 100.0}   # prix mocké mutable


@pytest.fixture(autouse=True)
def mock_market(monkeypatch):
    PRICE["value"] = 100.0
    monkeypatch.setattr(pf_module, "_last_price", lambda t: PRICE["value"])
    monkeypatch.setattr(pf_module, "_check_market_open", lambda t: (True, "ouvert"))
    monkeypatch.setattr(pf_module, "_invalidate_price", lambda t: None)
    monkeypatch.setattr("app.services.liquidation.last_price", lambda t: PRICE["value"])


def _order(client, auth_headers, **kw):
    body = {"ticker": "NVDA", "side": "BUY", "mode": "amount", "value": 200,
            "portfolio": "USER", "instrument_type": "CFD", "direction": "LONG",
            "leverage": 5}
    body.update(kw)
    return client.post("/api/portfolio/order", json=body, headers=auth_headers)


def test_open_cfd_long_blocks_margin(client, auth_headers, db_session):
    r = _order(client, auth_headers)   # marge $200, x5 → notionnel $1000
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["margin"] == pytest.approx(200.0, rel=0.01)
    # liq long x5 @ ~100 → ~90
    assert 89 < data["liquidation_price"] < 91

    pos = db_session.query(Position).filter(Position.instrument_type == "CFD").one()
    assert pos.direction == "LONG"
    assert pos.leverage == 5

    # cash : 10000 − marge − frais (0.1% du notionnel)
    summary = client.get("/api/portfolio/summary", headers=auth_headers).json()
    assert summary["cash"] == pytest.approx(10000 - 200 - 1000 * FEE_RATE, rel=0.01)


def test_short_cfd_gains_when_price_falls(client, auth_headers, db_session):
    r = _order(client, auth_headers, direction="SHORT")
    assert r.status_code == 200, r.text

    PRICE["value"] = 90.0   # −10% → short x5 : uPnL ≈ +$100 sur $200 de marge

    summary = client.get("/api/portfolio/summary", headers=auth_headers).json()
    cfd = next(p for p in summary["positions"] if p["instrument_type"] == "CFD")
    assert cfd["pnl"] > 90          # ≈ +$100
    assert cfd["pnl_pct"] > 45      # ≈ +50% sur la marge

    r = _order(client, auth_headers, side="SELL", direction="SHORT")
    assert r.status_code == 200
    assert r.json()["pnl"] > 80

    pos = db_session.query(Position).filter(Position.instrument_type == "CFD").one()
    assert float(pos.quantity) == 0.0


def test_leverage_cap_rejected(client, auth_headers):
    r = _order(client, auth_headers, leverage=25)
    assert r.status_code == 400
    assert "maximum" in r.json()["detail"].lower()


def test_crypto_leverage_capped_at_5(client, auth_headers):
    r = _order(client, auth_headers, ticker="BTC-USD", leverage=10)
    assert r.status_code == 400


def test_leveraged_etf_excluded(client, auth_headers):
    r = _order(client, auth_headers, ticker="TQQQ", leverage=2)
    assert r.status_code == 400
    assert "leveraged" in r.json()["detail"].lower()


def test_derivatives_blocked_on_ai_portfolio(client, auth_headers):
    r = _order(client, auth_headers, portfolio="AI")
    assert r.status_code == 400


def test_liquidation_triggered_by_summary(client, auth_headers, db_session):
    # long x20 @ ~100 → liq à ~97.5 ; on envoie le prix à 95
    r = _order(client, auth_headers, leverage=20)
    assert r.status_code == 200
    liq = r.json()["liquidation_price"]
    assert 97 < liq < 98

    PRICE["value"] = 95.0
    summary = client.get("/api/portfolio/summary", headers=auth_headers).json()

    # La position a été liquidée par le check dans summary
    assert not any(p["instrument_type"] == "CFD" for p in summary["positions"])
    liq_trade = db_session.query(Trade).filter(Trade.actor == "SYSTEM").one()
    assert "LIQUIDATION" in liq_trade.rationale


def test_open_futures_sets_expiry_and_10pct_margin(client, auth_headers, db_session):
    r = _order(client, auth_headers, instrument_type="FUTURES", mode="qty", value=10)
    assert r.status_code == 200, r.text
    # N = 10 × ~100 = ~$1000 → marge 10% ≈ $100
    assert r.json()["margin"] == pytest.approx(100.0, rel=0.02)

    pos = db_session.query(Position).filter(Position.instrument_type == "FUTURES").one()
    assert pos.expiry_date is not None
    assert pos.last_mark_price is not None

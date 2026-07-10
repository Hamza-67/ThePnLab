"""
Tests de GET /api/portfolio/metrics — Sharpe, volatilité, max drawdown.
"""
from datetime import datetime, timedelta

from app.models.portfolio import Portfolio, EquitySnapshot


def _add_snaps(db, pf_id, equities):
    base = datetime(2026, 6, 1, 12, 0)
    for i, e in enumerate(equities):
        db.add(EquitySnapshot(
            portfolio_id=pf_id, equity=e, cash=e,
            created_at=base + timedelta(days=i),
        ))
    db.commit()


def test_metrics_no_data(client, auth_headers):
    r = client.get("/api/portfolio/metrics", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "no_data"


def test_metrics_computed(client, auth_headers, db_session, auth_user):
    pf = db_session.query(Portfolio).filter(
        Portfolio.user_id == auth_user.id, Portfolio.name == "USER"
    ).one()
    # 10000 → 10500 → 10200 → 11000 : drawdown max = (10500-10200)/10500 ≈ 2.86%
    _add_snaps(db_session, pf.id, [10000, 10500, 10200, 11000])

    r = client.get("/api/portfolio/metrics", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["days"] == 4
    assert data["total_return_pct"] == 10.0
    assert abs(data["max_drawdown_pct"] - 2.86) < 0.05
    assert data["volatility_pct"] > 0
    assert isinstance(data["sharpe"], float)


def test_metrics_flat_series_zero_sharpe(client, auth_headers, db_session, auth_user):
    pf = db_session.query(Portfolio).filter(
        Portfolio.user_id == auth_user.id, Portfolio.name == "USER"
    ).one()
    _add_snaps(db_session, pf.id, [10000, 10000, 10000, 10000])

    data = client.get("/api/portfolio/metrics", headers=auth_headers).json()
    assert data["status"] == "ok"
    assert data["sharpe"] == 0.0
    assert data["max_drawdown_pct"] == 0.0

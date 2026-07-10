"""
Tests de la passe overnight : financement CFD débité, MTM futures appliqué.
"""
import pytest

from app.models.portfolio import Portfolio, Position
from app.services import overnight
from app.services.margin import CFD_FINANCING_RATE


@pytest.fixture()
def user_pf(db_session, auth_user):
    return db_session.query(Portfolio).filter(
        Portfolio.user_id == auth_user.id, Portfolio.name == "USER"
    ).one()


def test_cfd_financing_debited(db_session, user_pf, monkeypatch):
    monkeypatch.setattr(overnight, "last_price", lambda t: 100.0)
    db_session.add(Position(
        portfolio_id=user_pf.id, ticker="NVDA", quantity=10.0, avg_price=100.0,
        instrument_type="CFD", direction="LONG", leverage=5.0, margin=200.0,
        liquidation_price=90.0,
    ))
    db_session.commit()
    cash_before = float(user_pf.cash)

    stats = overnight.run_overnight_tasks(db_session)

    assert stats["financed"] == 1
    expected_fee = 1000.0 * CFD_FINANCING_RATE / 365   # N=$1000
    assert float(user_pf.cash) == pytest.approx(cash_before - expected_fee)


def test_futures_mark_to_market(db_session, user_pf, monkeypatch):
    monkeypatch.setattr(overnight, "last_price", lambda t: 105.0)
    db_session.add(Position(
        portfolio_id=user_pf.id, ticker="ES=F", quantity=2.0, avg_price=100.0,
        instrument_type="FUTURES", direction="LONG", leverage=10.0, margin=100.0,
        liquidation_price=95.0, contract_size=1.0, last_mark_price=100.0,
    ))
    db_session.commit()
    cash_before = float(user_pf.cash)

    stats = overnight.run_overnight_tasks(db_session)

    assert stats["marked"] == 1
    # MTM : 2 × 1 × (105 − 100) = +$10
    assert float(user_pf.cash) == pytest.approx(cash_before + 10.0)
    pos = db_session.query(Position).filter(Position.ticker == "ES=F").one()
    assert float(pos.last_mark_price) == pytest.approx(105.0)

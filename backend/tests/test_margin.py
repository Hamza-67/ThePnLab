"""
Tests des maths de marge (CFD + Futures) — écrits AVANT services/margin.py (TDD).
Conventions :
  s = +1 (LONG) / -1 (SHORT)
  N = notionnel = q · p0 (CFD) ou q · m · p0 (futures, m = contract_size)
  M = marge initiale = N / L (CFD) ou 10% · N (futures)
  MM = 0.5 · M (maintenance)
  Prix liq : long p0·(1−(1−mm)/L), short p0·(1+(1−mm)/L)
"""
import pytest

from app.services import margin as mg


# ── Marge initiale CFD ─────────────────────────────────────────────────────────

def test_initial_margin_cfd():
    # 10 actions à $100, levier x5 → N=$1000, M=$200
    assert mg.initial_margin_cfd(notional=1000.0, leverage=5) == pytest.approx(200.0)


def test_maintenance_margin_is_half():
    assert mg.maintenance_margin(200.0) == pytest.approx(100.0)


# ── P&L latent ────────────────────────────────────────────────────────────────

def test_upnl_long_gains_when_price_rises():
    # long 10 @ 100 → prix 110 : +$100
    assert mg.unrealized_pnl("LONG", qty=10, entry=100.0, price=110.0) == pytest.approx(100.0)


def test_upnl_long_loses_when_price_falls():
    assert mg.unrealized_pnl("LONG", qty=10, entry=100.0, price=95.0) == pytest.approx(-50.0)


def test_upnl_short_gains_when_price_falls():
    # short 10 @ 100 → prix 90 : +$100
    assert mg.unrealized_pnl("SHORT", qty=10, entry=100.0, price=90.0) == pytest.approx(100.0)


def test_upnl_short_loses_when_price_rises():
    assert mg.unrealized_pnl("SHORT", qty=10, entry=100.0, price=108.0) == pytest.approx(-80.0)


def test_upnl_contract_size():
    # futures : 2 contrats, m=50, entry 4000 → 4010 long : 2·50·10 = +$1000
    assert mg.unrealized_pnl("LONG", qty=2, entry=4000.0, price=4010.0,
                             contract_size=50.0) == pytest.approx(1000.0)


# ── Équité position ───────────────────────────────────────────────────────────

def test_position_equity():
    assert mg.position_equity(margin=200.0, upnl=-50.0) == pytest.approx(150.0)


# ── Prix de liquidation CFD ───────────────────────────────────────────────────

def test_liquidation_price_long():
    # p0=100, L=5, mm=0.5 → 100·(1 − 0.5/5) = 90
    assert mg.liquidation_price("LONG", entry=100.0, leverage=5) == pytest.approx(90.0)


def test_liquidation_price_short():
    # p0=100, L=5, mm=0.5 → 100·(1 + 0.5/5) = 110
    assert mg.liquidation_price("SHORT", entry=100.0, leverage=5) == pytest.approx(110.0)


def test_liquidation_price_high_leverage_is_tight():
    # L=20 → liq à 100·(1 − 0.5/20) = 97.5 : très proche de l'entrée
    assert mg.liquidation_price("LONG", entry=100.0, leverage=20) == pytest.approx(97.5)


def test_liquidation_consistency_with_equity():
    # Au prix de liquidation, l'équité doit valoir exactement MM
    entry, lev, qty = 100.0, 5, 10
    n  = qty * entry
    m  = mg.initial_margin_cfd(n, lev)
    liq = mg.liquidation_price("LONG", entry=entry, leverage=lev)
    upnl = mg.unrealized_pnl("LONG", qty=qty, entry=entry, price=liq)
    assert mg.position_equity(m, upnl) == pytest.approx(mg.maintenance_margin(m))


def test_is_liquidated():
    # long x5 @ 100, liq à 90 : à 89 → liquidé, à 91 → non
    assert mg.is_liquidated("LONG", mark_price=89.0, liquidation_price=90.0) is True
    assert mg.is_liquidated("LONG", mark_price=91.0, liquidation_price=90.0) is False
    # short : liquidé si le prix MONTE au-dessus du prix liq
    assert mg.is_liquidated("SHORT", mark_price=111.0, liquidation_price=110.0) is True
    assert mg.is_liquidated("SHORT", mark_price=109.0, liquidation_price=110.0) is False


# ── Financement overnight CFD ─────────────────────────────────────────────────

def test_overnight_financing():
    # N=$1000 → 1000 · 0.08/365 ≈ $0.219 par nuit
    assert mg.overnight_financing(1000.0) == pytest.approx(1000.0 * 0.08 / 365)


def test_overnight_financing_multiple_nights():
    assert mg.overnight_financing(1000.0, nights=3) == pytest.approx(3 * 1000.0 * 0.08 / 365)


# ── Futures ───────────────────────────────────────────────────────────────────

def test_futures_initial_margin():
    # N = q·m·p0 = 2·50·4000 = $400k → marge 10% = $40k
    assert mg.initial_margin_futures(400_000.0) == pytest.approx(40_000.0)


def test_futures_mark_to_market_long():
    # long 2 contrats m=50, settle 4010 vs last_mark 4000 → cash +$1000
    assert mg.mark_to_market("LONG", qty=2, contract_size=50.0,
                             settle=4010.0, last_mark=4000.0) == pytest.approx(1000.0)


def test_futures_mark_to_market_short():
    assert mg.mark_to_market("SHORT", qty=2, contract_size=50.0,
                             settle=4010.0, last_mark=4000.0) == pytest.approx(-1000.0)


# ── Caps de levier ────────────────────────────────────────────────────────────

def test_leverage_cap_stock_ok():
    ok, _ = mg.validate_leverage("NVDA", 20)
    assert ok


def test_leverage_cap_stock_too_high():
    ok, msg = mg.validate_leverage("NVDA", 21)
    assert not ok


def test_leverage_cap_crypto_max_5():
    ok, _ = mg.validate_leverage("BTC-USD", 5)
    assert ok
    ok, _ = mg.validate_leverage("BTC-USD", 6)
    assert not ok


def test_leverage_min_2():
    ok, _ = mg.validate_leverage("NVDA", 1)
    assert not ok


def test_leveraged_etf_excluded_from_cfd():
    # TQQQ est déjà x3 — pas de levier sur du levier
    ok, msg = mg.validate_leverage("TQQQ", 2)
    assert not ok
    assert "leveraged" in msg.lower() or "ETF" in msg

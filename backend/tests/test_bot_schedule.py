"""
Tests du scheduler bot : quiet hours (heures limites) et fenêtre horaire.
"""
from datetime import datetime

from app.bot import scheduler
from app.bot.params import PARIS_TZ


def _patch_quiet(monkeypatch, value: str):
    monkeypatch.setattr(scheduler, "_parse_quiet_hours", lambda: tuple(
        int(x) for x in value.split("-")
    ))


def test_quiet_hours_default_window(monkeypatch):
    _patch_quiet(monkeypatch, "0-7")
    assert scheduler._in_quiet_hours(0) is True     # borne basse incluse
    assert scheduler._in_quiet_hours(3) is True
    assert scheduler._in_quiet_hours(6) is True
    assert scheduler._in_quiet_hours(7) is False    # borne haute exclue
    assert scheduler._in_quiet_hours(23) is False


def test_quiet_hours_crossing_midnight(monkeypatch):
    _patch_quiet(monkeypatch, "23-6")
    assert scheduler._in_quiet_hours(23) is True
    assert scheduler._in_quiet_hours(2) is True
    assert scheduler._in_quiet_hours(5) is True
    assert scheduler._in_quiet_hours(6) is False
    assert scheduler._in_quiet_hours(12) is False


def test_quiet_hours_disabled(monkeypatch):
    _patch_quiet(monkeypatch, "0-0")
    for h in range(24):
        assert scheduler._in_quiet_hours(h) is False


def test_quiet_hours_invalid_config(monkeypatch):
    monkeypatch.setattr("app.config.QUIET_HOURS", "n'importe quoi")
    assert scheduler._parse_quiet_hours() == (0, 0)   # invalide → désactivé


def _fake_now(monkeypatch, weekday: int, hour: int):
    """weekday : 0=lundi ... 6=dimanche."""
    real = datetime.now(PARIS_TZ)
    # trouve une date au bon jour de semaine
    from datetime import timedelta
    d = real
    while d.weekday() != weekday:
        d += timedelta(days=1)
    fake = d.replace(hour=hour, minute=30)

    class _FakeDatetime:
        @staticmethod
        def now(tz=None):
            return fake

    monkeypatch.setattr(scheduler, "datetime", _FakeDatetime)


def test_should_run_weekday_hours(monkeypatch):
    _patch_quiet(monkeypatch, "0-7")
    _fake_now(monkeypatch, weekday=1, hour=8)    # mardi 8h — avant ouverture
    assert scheduler._should_run_now() is False
    _fake_now(monkeypatch, weekday=1, hour=9)    # mardi 9h — ouvert
    assert scheduler._should_run_now() is True
    _fake_now(monkeypatch, weekday=1, hour=21)   # mardi 21h — dernier créneau
    assert scheduler._should_run_now() is True
    _fake_now(monkeypatch, weekday=1, hour=22)   # mardi 22h — fermé
    assert scheduler._should_run_now() is False


def test_should_run_weekend_crypto(monkeypatch):
    _patch_quiet(monkeypatch, "0-7")
    _fake_now(monkeypatch, weekday=6, hour=15)   # dimanche 15h — crypto 24/7
    assert scheduler._should_run_now() is True
    _fake_now(monkeypatch, weekday=6, hour=3)    # dimanche 3h — quiet hours
    assert scheduler._should_run_now() is False

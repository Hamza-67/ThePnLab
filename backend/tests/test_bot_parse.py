"""Tests du parser LLM du bot (_parse) — robustesse aux formats de réponse."""
import json

from app.bot.brain import _parse


def _make_raw(decisions):
    return json.dumps({
        "decisions": decisions,
        "market_summary_fr": "Marché haussier.",
        "market_summary_en": "Bullish market.",
    })


def test_parse_valid_json():
    raw = _make_raw([{
        "ticker": "BTC-USD", "action": "BUY", "confidence": "HIGH",
        "amount_usd": 500, "rationale_fr": "momentum", "rationale_en": "momentum",
        "risk_level": "MEDIUM",
    }])
    decisions, fr, en = _parse(raw)
    assert len(decisions) == 1
    assert decisions[0].ticker == "BTC-USD"
    assert decisions[0].action == "BUY"
    assert fr == "Marché haussier."


def test_parse_strips_markdown_fences():
    raw = "```json\n" + _make_raw([{
        "ticker": "ETH-USD", "action": "SELL", "amount_usd": 300,
    }]) + "\n```"
    decisions, _, _ = _parse(raw)
    assert len(decisions) == 1
    assert decisions[0].action == "SELL"


def test_parse_clamps_amount():
    raw = _make_raw([
        {"ticker": "A", "action": "BUY", "amount_usd": 99999},
        {"ticker": "B", "action": "BUY", "amount_usd": 5},
    ])
    decisions, _, _ = _parse(raw)
    assert decisions[0].amount_usd == 3000.0   # clamp max
    assert decisions[1].amount_usd == 50.0     # clamp min


def test_parse_skips_invalid_action():
    raw = _make_raw([
        {"ticker": "A", "action": "SHORT", "amount_usd": 100},
        {"ticker": "B", "action": "hold", "amount_usd": 100},
    ])
    decisions, _, _ = _parse(raw)
    # SHORT ignoré, hold accepté (case-insensitive)
    assert len(decisions) == 1
    assert decisions[0].action == "HOLD"


def test_parse_garbage_returns_empty():
    decisions, fr, en = _parse("pas du json du tout {{{")
    assert decisions == []
    assert fr  # message par défaut présent

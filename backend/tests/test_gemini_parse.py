"""Unit tests for the hardened Gemini JSON parsing (services/gemini.py).

These guard the round-2 fix: the model intermittently wraps JSON in prose or fences,
which used to crash storyboard/idea generation with an opaque 500.
"""
import json

import pytest

from services.gemini import _extract_json_block, _parse_json_response


def test_plain_object():
    assert _parse_json_response('{"a": 1}') == {"a": 1}


def test_plain_array():
    assert _parse_json_response("[1, 2, 3]") == [1, 2, 3]


def test_json_fence():
    assert _parse_json_response('```json\n{"a": 1}\n```') == {"a": 1}


def test_bare_fence():
    assert _parse_json_response('```\n{"a": 1}\n```') == {"a": 1}


def test_prose_wrapped_recovers():
    text = 'Sure! Here is your JSON:\n{"a": 1, "b": [2, 3]}\nHope that helps.'
    assert _parse_json_response(text) == {"a": 1, "b": [2, 3]}


def test_truncated_fence_recovers():
    # opening fence, model never closed it
    assert _parse_json_response('```json\n{"a": 1}') == {"a": 1}


def test_invalid_raises_json_error():
    with pytest.raises(json.JSONDecodeError):
        _parse_json_response("this is not json at all")


def test_extract_block_handles_braces_inside_strings():
    text = 'noise {"k": "}{", "n": {"x": 1}} trailing'
    assert json.loads(_extract_json_block(text)) == {"k": "}{", "n": {"x": 1}}


def test_extract_block_handles_escaped_quote():
    text = '{"k": "a \\" b"}'
    assert json.loads(_extract_json_block(text)) == {"k": 'a " b'}


def test_extract_block_none_when_no_json():
    assert _extract_json_block("no braces at all") is None

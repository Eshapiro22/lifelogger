"""
tests/test_extractor.py
-----------------------
Unit tests for src/extractor.py

Run with:
    python -m pytest tests/test_extractor.py -v
or:
    python tests/test_extractor.py
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extractor import extract_data


class TestExtractorValidation(unittest.TestCase):
    """Tests for input validation in extract_data()."""

    def test_unsupported_platform_raises(self):
        with self.assertRaises(ValueError):
            extract_data(platform="unknown_platform", data_type="chat_history")

    def test_unsupported_data_type_raises(self):
        with self.assertRaises(ValueError):
            extract_data(platform="openai", data_type="invalid_type")

    def test_platform_case_insensitive(self):
        result = extract_data(platform="OpenAI", data_type="chat_history")
        self.assertEqual(result["platform"], "openai")


class TestExtractorOutputShape(unittest.TestCase):
    """Tests for the structure of extract_data() output."""

    def test_returns_dict_with_required_keys(self):
        result = extract_data(platform="openai", data_type="chat_history")
        self.assertIn("platform", result)
        self.assertIn("data_type", result)
        self.assertIn("data", result)
        self.assertIn("record_count", result)

    def test_record_count_matches_data_length(self):
        for platform in ["openai", "anthropic", "gemini"]:
            result = extract_data(platform=platform, data_type="chat_history")
            self.assertEqual(result["record_count"], len(result["data"]))

    def test_chat_history_returns_list(self):
        result = extract_data(platform="openai", data_type="chat_history")
        self.assertIsInstance(result["data"], list)
        self.assertGreater(len(result["data"]), 0)

    def test_user_instructions_returns_dict(self):
        result = extract_data(platform="anthropic", data_type="user_instructions")
        self.assertIsInstance(result["data"], dict)

    def test_response_styles_returns_list(self):
        result = extract_data(platform="gemini", data_type="response_styles")
        self.assertIsInstance(result["data"], list)

    def test_all_platforms_all_types(self):
        """Smoke test: all platform/type combinations should succeed."""
        platforms = ["openai", "anthropic", "gemini"]
        data_types = ["chat_history", "user_instructions", "response_styles"]
        for platform in platforms:
            for dtype in data_types:
                with self.subTest(platform=platform, dtype=dtype):
                    result = extract_data(platform=platform, data_type=dtype)
                    self.assertIsNotNone(result["data"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

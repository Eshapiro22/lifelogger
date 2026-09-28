"""
tests/test_importer.py
-----------------------
Unit tests for src/importer.py

Run with:
    python -m pytest tests/test_importer.py -v
or:
    python tests/test_importer.py
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extractor import extract_data
from src.transformer import transform_data
from src.importer import import_data


def _full_pipeline(source, target, dtype):
    """Helper: run extract -> transform -> import and return the import result."""
    extracted = extract_data(platform=source, data_type=dtype)
    transformed = transform_data(
        extracted=extracted,
        source_platform=source,
        target_platform=target,
        data_type=dtype,
    )
    return import_data(transformed=transformed, target_platform=target)


class TestImporterOutputShape(unittest.TestCase):
    """Tests for the structure of import_data() output."""

    def test_returns_dict_with_required_keys(self):
        result = _full_pipeline("openai", "anthropic", "chat_history")
        for key in ["status", "platform", "data_type", "records_imported"]:
            self.assertIn(key, result)

    def test_status_is_mock_success(self):
        result = _full_pipeline("openai", "anthropic", "user_instructions")
        self.assertEqual(result["status"], "mock_success")

    def test_platform_matches_target(self):
        result = _full_pipeline("anthropic", "gemini", "response_styles")
        self.assertEqual(result["platform"], "gemini")

    def test_records_imported_count_positive(self):
        result = _full_pipeline("gemini", "openai", "chat_history")
        self.assertGreater(result["records_imported"], 0)

    def test_unsupported_target_raises(self):
        extracted = extract_data(platform="openai", data_type="chat_history")
        transformed = transform_data(
            extracted=extracted,
            source_platform="openai",
            target_platform="anthropic",
            data_type="chat_history",
        )
        with self.assertRaises(ValueError):
            import_data(transformed=transformed, target_platform="unsupported_platform")

    def test_empty_records_returns_skipped(self):
        """If transformed data has no records, import should skip gracefully."""
        empty_transformed = {
            "data_type": "chat_history",
            "records": [],
            "record_count": 0,
        }
        result = import_data(transformed=empty_transformed, target_platform="anthropic")
        self.assertEqual(result["status"], "skipped")

    def test_all_platforms_all_types(self):
        """Smoke test: all platform/type combinations should import without error."""
        platforms = ["openai", "anthropic", "gemini"]
        data_types = ["chat_history", "user_instructions", "response_styles"]
        for source in platforms:
            for target in platforms:
                for dtype in data_types:
                    with self.subTest(source=source, target=target, dtype=dtype):
                        result = _full_pipeline(source, target, dtype)
                        self.assertIn(result["status"], ("mock_success", "skipped"))


if __name__ == "__main__":
    unittest.main(verbosity=2)

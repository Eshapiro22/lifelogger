"""
tests/test_transformer.py
--------------------------
Unit tests for src/transformer.py

Run with:
    python -m pytest tests/test_transformer.py -v
or:
    python tests/test_transformer.py
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extractor import extract_data
from src.transformer import transform_data


class TestTransformerOutputSchema(unittest.TestCase):
    """Tests for the standardized output schema of transform_data()."""

    def _get_transformed(self, source, target, dtype):
        extracted = extract_data(platform=source, data_type=dtype)
        return transform_data(
            extracted=extracted,
            source_platform=source,
            target_platform=target,
            data_type=dtype,
        )

    def test_required_top_level_keys(self):
        result = self._get_transformed("openai", "anthropic", "chat_history")
        for key in ["schema_version", "source_platform", "target_platform",
                    "data_type", "exported_at", "record_count", "records"]:
            self.assertIn(key, result)

    def test_schema_version_is_string(self):
        result = self._get_transformed("openai", "anthropic", "chat_history")
        self.assertIsInstance(result["schema_version"], str)

    def test_record_count_matches_records_length(self):
        result = self._get_transformed("gemini", "openai", "chat_history")
        self.assertEqual(result["record_count"], len(result["records"]))

    def test_chat_history_record_has_required_fields(self):
        result = self._get_transformed("openai", "anthropic", "chat_history")
        for record in result["records"]:
            self.assertIn("id", record)
            self.assertIn("title", record)
            self.assertIn("timestamp", record)
            self.assertIn("messages", record)

    def test_chat_history_messages_have_role_and_content(self):
        result = self._get_transformed("anthropic", "gemini", "chat_history")
        for record in result["records"]:
            for msg in record["messages"]:
                self.assertIn("role", msg)
                self.assertIn("content", msg)
                self.assertIn(msg["role"], ("user", "assistant"))

    def test_user_instructions_record_has_required_fields(self):
        result = self._get_transformed("openai", "anthropic", "user_instructions")
        self.assertGreater(len(result["records"]), 0)
        record = result["records"][0]
        for field in ["system_prompt", "about_user", "response_preferences",
                      "source_platform", "enabled"]:
            self.assertIn(field, record)

    def test_response_styles_record_has_required_fields(self):
        result = self._get_transformed("gemini", "anthropic", "response_styles")
        for record in result["records"]:
            for field in ["id", "name", "description", "active", "source_platform"]:
                self.assertIn(field, record)

    def test_gemini_model_role_normalized_to_assistant(self):
        """Gemini uses 'model' as the assistant role; transformer must normalize it."""
        result = self._get_transformed("gemini", "openai", "chat_history")
        for record in result["records"]:
            for msg in record["messages"]:
                self.assertNotEqual(msg["role"], "model",
                    "Gemini 'model' role should be normalized to 'assistant'")

    def test_all_platform_combinations(self):
        """Smoke test all 6 source->target combos for all data types."""
        platforms = ["openai", "anthropic", "gemini"]
        data_types = ["chat_history", "user_instructions", "response_styles"]
        for source in platforms:
            for target in platforms:
                for dtype in data_types:
                    with self.subTest(source=source, target=target, dtype=dtype):
                        result = self._get_transformed(source, target, dtype)
                        self.assertIsInstance(result["records"], list)


if __name__ == "__main__":
    unittest.main(verbosity=2)

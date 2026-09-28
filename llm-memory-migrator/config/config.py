"""
config/config.py
----------------
Central configuration file for the LLM Memory Migration Tool.

Store API keys and platform-specific settings here.
Replace placeholder values with real credentials when integrating live APIs.

SECURITY NOTE: Never commit real API keys to version control.
Use environment variables or a secrets manager in production.
"""

import os

# ---------------------------------------------------------------------------
# API Keys (placeholders – replace or override via environment variables)
# ---------------------------------------------------------------------------

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "your_openai_key_here")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "your_anthropic_key_here")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "your_gemini_key_here")

# ---------------------------------------------------------------------------
# Platform API base URLs (for future real-API integration)
# ---------------------------------------------------------------------------

OPENAI_BASE_URL = "https://api.openai.com/v1"
ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# ---------------------------------------------------------------------------
# Supported platforms and data types
# ---------------------------------------------------------------------------

SUPPORTED_PLATFORMS = ["openai", "anthropic", "gemini"]

SUPPORTED_DATA_TYPES = ["chat_history", "user_instructions", "response_styles"]

# ---------------------------------------------------------------------------
# Local data paths
# ---------------------------------------------------------------------------

import pathlib

ROOT_DIR = pathlib.Path(__file__).parent.parent
DATA_DIR = ROOT_DIR / "data"

"""
src/extractor.py
----------------
Core extraction module for the LLM Memory Migration Tool.

Responsible for pulling data (chat history, user instructions, response styles)
from a specified source platform. For MVP, all platform interactions use mock
data via the platform-specific handlers in /platforms/.

Usage:
    from src.extractor import extract_data
    data = extract_data(platform="openai", data_type="chat_history", auth_token="...")
"""

import sys
import os

# Allow imports from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config import SUPPORTED_PLATFORMS, SUPPORTED_DATA_TYPES
from platforms import openai_handler, anthropic_handler, gemini_handler


# Map platform names to their handler modules
_PLATFORM_HANDLERS = {
    "openai": openai_handler,
    "anthropic": anthropic_handler,
    "gemini": gemini_handler,
}

# Map data types to handler function names
_FETCH_FUNCTION_MAP = {
    "chat_history": "fetch_chat_history",
    "user_instructions": "fetch_user_instructions",
    "response_styles": "fetch_response_styles",
}


def extract_data(platform: str, data_type: str, auth_token: str = "mock_token") -> dict:
    """
    Extract data of a given type from a source platform.

    Parameters
    ----------
    platform : str
        The source platform identifier. One of: 'openai', 'anthropic', 'gemini'.
    data_type : str
        The type of data to extract. One of: 'chat_history', 'user_instructions',
        'response_styles'.
    auth_token : str
        Authentication token for the platform's API.
        For MVP, defaults to 'mock_token' (no real auth required).

    Returns
    -------
    dict
        A dictionary containing:
        - 'platform': source platform name
        - 'data_type': the requested data type
        - 'data': the extracted (mock) data in platform-native format
        - 'record_count': number of top-level records returned

    Raises
    ------
    ValueError
        If an unsupported platform or data_type is provided.
    """
    # Validate inputs
    platform = platform.lower().strip()
    data_type = data_type.lower().strip()

    if platform not in SUPPORTED_PLATFORMS:
        raise ValueError(
            f"Unsupported platform '{platform}'. "
            f"Choose from: {SUPPORTED_PLATFORMS}"
        )

    if data_type not in SUPPORTED_DATA_TYPES:
        raise ValueError(
            f"Unsupported data_type '{data_type}'. "
            f"Choose from: {SUPPORTED_DATA_TYPES}"
        )

    # Retrieve the correct handler module
    handler = _PLATFORM_HANDLERS[platform]

    # Look up and call the appropriate fetch function
    fetch_fn_name = _FETCH_FUNCTION_MAP[data_type]
    fetch_fn = getattr(handler, fetch_fn_name)

    print(f"  [Extractor] Extracting '{data_type}' from '{platform}'...")
    raw_data = fetch_fn(auth_token)

    # Normalise record count regardless of whether data is list or dict
    record_count = len(raw_data) if isinstance(raw_data, (list, dict)) else 1

    print(f"  [Extractor] Retrieved {record_count} record(s).")

    return {
        "platform": platform,
        "data_type": data_type,
        "data": raw_data,
        "record_count": record_count,
    }

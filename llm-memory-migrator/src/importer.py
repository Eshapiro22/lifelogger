"""
src/importer.py
---------------
Core import module for the LLM Memory Migration Tool.

Takes standardized (transformed) data and simulates importing it into the
target platform via platform-specific handler functions.

For MVP, all imports are mocked – no real API calls are made.
Platform handlers print confirmation messages and return mock results.

Usage:
    from src.importer import import_data
    result = import_data(transformed_data, target_platform="anthropic",
                         auth_token="mock_token")
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config import SUPPORTED_PLATFORMS
from platforms import openai_handler, anthropic_handler, gemini_handler


# Map platform names → handler modules
_PLATFORM_HANDLERS = {
    "openai": openai_handler,
    "anthropic": anthropic_handler,
    "gemini": gemini_handler,
}

# Map data types → push function names in handler modules
_PUSH_FUNCTION_MAP = {
    "chat_history": "push_chat_history",
    "user_instructions": "push_user_instructions",
    "response_styles": "push_response_styles",
}


def import_data(
    transformed: dict,
    target_platform: str,
    auth_token: str = "mock_token",
) -> dict:
    """
    Import standardized data into the target platform.

    Parameters
    ----------
    transformed : dict
        Output of transformer.transform_data(). Must contain 'data_type' and 'records'.
    target_platform : str
        Destination platform. One of: 'openai', 'anthropic', 'gemini'.
    auth_token : str
        Authentication token for the target platform's API.
        Defaults to 'mock_token' for MVP.

    Returns
    -------
    dict
        Import result summary including status, platform, and record counts.

    Raises
    ------
    ValueError
        If an unsupported target_platform is specified.
    """
    target_platform = target_platform.lower().strip()

    if target_platform not in SUPPORTED_PLATFORMS:
        raise ValueError(
            f"Unsupported target_platform '{target_platform}'. "
            f"Choose from: {SUPPORTED_PLATFORMS}"
        )

    data_type = transformed.get("data_type", "")
    records = transformed.get("records", [])

    if not records:
        print(f"  [Importer] No records to import. Skipping.")
        return {"status": "skipped", "reason": "empty_records", "platform": target_platform}

    # Retrieve handler and push function
    handler = _PLATFORM_HANDLERS[target_platform]
    push_fn_name = _PUSH_FUNCTION_MAP.get(data_type)

    if not push_fn_name:
        raise ValueError(f"No import handler for data_type '{data_type}'.")

    push_fn = getattr(handler, push_fn_name)

    print(f"  [Importer] Importing '{data_type}' into '{target_platform}'...")

    # For user_instructions the handler expects a dict (single record); unwrap list
    if data_type == "user_instructions":
        payload = records[0] if records else {}
    else:
        payload = records

    result = push_fn(payload, auth_token)

    # Build a human-readable summary
    summary = _build_summary(data_type, records, target_platform)
    _print_summary(summary)

    return {
        "status": result.get("status", "unknown"),
        "platform": target_platform,
        "data_type": data_type,
        "records_imported": len(records),
        "summary": summary,
        "handler_result": result,
    }


# ---------------------------------------------------------------------------
# Summary helpers
# ---------------------------------------------------------------------------

def _build_summary(data_type: str, records: list, target_platform: str) -> dict:
    """Build a brief human-readable summary of what was imported."""
    if data_type == "chat_history":
        total_messages = sum(len(r.get("messages", [])) for r in records)
        return {
            "conversations": len(records),
            "total_messages": total_messages,
            "titles": [r.get("title", "Untitled") for r in records],
        }
    elif data_type == "user_instructions":
        record = records[0] if records else {}
        return {
            "system_prompt_length": len(record.get("system_prompt", "")),
            "about_user_length": len(record.get("about_user", "")),
            "enabled": record.get("enabled", True),
        }
    elif data_type == "response_styles":
        return {
            "styles_count": len(records),
            "active_styles": [r.get("name") for r in records if r.get("active")],
            "inactive_styles": [r.get("name") for r in records if not r.get("active")],
        }
    return {}


def _print_summary(summary: dict) -> None:
    """Pretty-print the import summary."""
    print("\n  --- Import Summary ---")
    for key, value in summary.items():
        print(f"    {key}: {value}")
    print("  ----------------------\n")

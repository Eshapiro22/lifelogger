"""
src/transformer.py
------------------
Core transformation module for the LLM Memory Migration Tool.

Converts platform-native data formats into a common, platform-agnostic
internal schema, making memory/history portable across platforms.

The standardized internal format:
  {
      "schema_version": "1.0",
      "source_platform": "<platform>",
      "target_platform": "<platform>",
      "data_type": "<type>",
      "exported_at": "<ISO timestamp>",
      "records": [ ... ]   # normalized records (format depends on data_type)
  }

Usage:
    from src.transformer import transform_data
    result = transform_data(extracted, source_platform="openai",
                            target_platform="anthropic",
                            data_type="chat_history")
"""

from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def transform_data(
    extracted: dict,
    source_platform: str,
    target_platform: str,
    data_type: str,
) -> dict:
    """
    Transform platform-native extracted data into the standardized internal format.

    Parameters
    ----------
    extracted : dict
        The output of extractor.extract_data() – contains 'data', 'platform', etc.
    source_platform : str
        The platform the data was extracted from.
    target_platform : str
        The platform the data will be imported into.
    data_type : str
        One of 'chat_history', 'user_instructions', 'response_styles'.

    Returns
    -------
    dict
        Standardized internal representation ready for the importer.
    """
    raw_data = extracted.get("data", [])

    print(f"  [Transformer] Converting '{data_type}' from '{source_platform}' → '{target_platform}'...")

    # Dispatch to the appropriate normalizer
    if data_type == "chat_history":
        records = _normalize_chat_history(raw_data, source_platform)
    elif data_type == "user_instructions":
        records = _normalize_user_instructions(raw_data, source_platform)
    elif data_type == "response_styles":
        records = _normalize_response_styles(raw_data, source_platform)
    else:
        raise ValueError(f"Unknown data_type: '{data_type}'")

    print(f"  [Transformer] Normalized {len(records)} record(s).")

    return {
        "schema_version": "1.0",
        "source_platform": source_platform,
        "target_platform": target_platform,
        "data_type": data_type,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "records": records,
    }


# ---------------------------------------------------------------------------
# Chat history normalizers
# ---------------------------------------------------------------------------

def _normalize_chat_history(raw: list, source: str) -> list[dict]:
    """
    Normalize chat history from any platform into the common conversation format:

        {
            "id": str,
            "title": str,
            "timestamp": str (ISO 8601),
            "messages": [
                {"role": "user" | "assistant", "content": str},
                ...
            ]
        }
    """
    normalizers = {
        "openai": _normalize_openai_conversation,
        "anthropic": _normalize_anthropic_conversation,
        "gemini": _normalize_gemini_conversation,
    }
    normalize_fn = normalizers.get(source, _normalize_generic_conversation)
    return [normalize_fn(item) for item in raw]


def _normalize_openai_conversation(item: dict) -> dict:
    """Convert OpenAI's mapping-based format to the standard format."""
    messages = []
    # OpenAI stores messages in a 'mapping' dict keyed by message ID
    for _msg_id, node in item.get("mapping", {}).items():
        msg = node.get("message", {})
        role = msg.get("author", {}).get("role", "unknown")
        parts = msg.get("content", {}).get("parts", [])
        content = " ".join(str(p) for p in parts if p)
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # OpenAI uses Unix timestamps
    ts = item.get("create_time", 0)
    timestamp = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else ""

    return {
        "id": item.get("id", ""),
        "title": item.get("title", "Untitled"),
        "timestamp": timestamp,
        "messages": messages,
    }


def _normalize_anthropic_conversation(item: dict) -> dict:
    """Convert Anthropic's flat messages format to the standard format."""
    messages = [
        {"role": msg.get("role", "unknown"), "content": msg.get("content", "")}
        for msg in item.get("messages", [])
    ]
    return {
        "id": item.get("conversation_id", ""),
        "title": item.get("name", "Untitled"),
        "timestamp": item.get("created_at", ""),
        "messages": messages,
    }


def _normalize_gemini_conversation(item: dict) -> dict:
    """Convert Gemini's 'contents' format (with 'parts') to the standard format."""
    messages = []
    for content in item.get("contents", []):
        role = content.get("role", "unknown")
        # Gemini uses 'model' for assistant; normalize to 'assistant'
        if role == "model":
            role = "assistant"
        text = " ".join(
            part.get("text", "") for part in content.get("parts", []) if "text" in part
        )
        if text:
            messages.append({"role": role, "content": text})

    return {
        "id": item.get("conversation_id", ""),
        "title": item.get("display_name", "Untitled"),
        "timestamp": item.get("create_time", ""),
        "messages": messages,
    }


def _normalize_generic_conversation(item: dict) -> dict:
    """Fallback normalizer for unknown platforms."""
    return {
        "id": item.get("id", item.get("conversation_id", "")),
        "title": item.get("title", item.get("name", item.get("display_name", "Untitled"))),
        "timestamp": item.get("timestamp", item.get("created_at", item.get("create_time", ""))),
        "messages": item.get("messages", []),
    }


# ---------------------------------------------------------------------------
# User instructions normalizers
# ---------------------------------------------------------------------------

def _normalize_user_instructions(raw: dict, source: str) -> list[dict]:
    """
    Normalize user instructions / system prompts from any platform into:

        {
            "system_prompt": str,
            "about_user": str,
            "response_preferences": str,
            "source_platform": str,
            "enabled": bool
        }
    """
    normalizers = {
        "openai": _normalize_openai_instructions,
        "anthropic": _normalize_anthropic_instructions,
        "gemini": _normalize_gemini_instructions,
    }
    normalize_fn = normalizers.get(source, _normalize_generic_instructions)
    # Instructions are a single dict; return as single-element list for consistency
    return [normalize_fn(raw)]


def _normalize_openai_instructions(raw: dict) -> dict:
    return {
        "system_prompt": raw.get("response_preferences", ""),
        "about_user": raw.get("about_user", ""),
        "response_preferences": raw.get("response_preferences", ""),
        "source_platform": "openai",
        "enabled": raw.get("enabled", True),
    }


def _normalize_anthropic_instructions(raw: dict) -> dict:
    return {
        "system_prompt": raw.get("system_prompt", ""),
        "about_user": raw.get("custom_persona", ""),
        "response_preferences": "",
        "source_platform": "anthropic",
        "enabled": raw.get("enabled", True),
    }


def _normalize_gemini_instructions(raw: dict) -> dict:
    return {
        "system_prompt": raw.get("system_instruction", ""),
        "about_user": "",
        "response_preferences": str(raw.get("safety_settings", "")),
        "source_platform": "gemini",
        "enabled": raw.get("enabled", True),
    }


def _normalize_generic_instructions(raw: dict) -> dict:
    return {
        "system_prompt": raw.get("system_prompt", raw.get("system_instruction", "")),
        "about_user": raw.get("about_user", ""),
        "response_preferences": raw.get("response_preferences", ""),
        "source_platform": "unknown",
        "enabled": raw.get("enabled", True),
    }


# ---------------------------------------------------------------------------
# Response styles normalizers
# ---------------------------------------------------------------------------

def _normalize_response_styles(raw: list, source: str) -> list[dict]:
    """
    Normalize response style definitions into:

        {
            "id": str,
            "name": str,
            "description": str,
            "active": bool,
            "source_platform": str
        }
    """
    return [
        {
            "id": style.get("style_id", ""),
            "name": style.get("name", ""),
            "description": style.get("description", ""),
            "active": style.get("active", False),
            "source_platform": source,
        }
        for style in raw
    ]

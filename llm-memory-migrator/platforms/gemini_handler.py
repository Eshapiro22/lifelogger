"""
platforms/gemini_handler.py
----------------------------
Platform-specific helper functions for Google Gemini.

Called by src/extractor.py and src/importer.py to handle Gemini-specific
data shapes and (future) API interactions.

MVP: All functions return mock data or simulate import actions.
TODO: Replace mock bodies with real Gemini API calls when credentials are
      available (see config/config.py for key placeholders).
"""


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def fetch_chat_history(auth_token: str) -> list[dict]:
    """
    Mock extraction of Gemini conversation history.

    Real implementation would use the Google AI / Gemini API or
    Google Takeout export to retrieve conversation data.

    Gemini's native format wraps messages in 'parts' arrays inside
    'contents' with 'role' set to 'user' or 'model'.
    """
    # TODO: Replace with real Gemini API call
    # import google.generativeai as genai
    # genai.configure(api_key=auth_token)
    # ... fetch conversation history via Gemini API

    return [
        {
            "conversation_id": "conv_gemini_001",
            "display_name": "Trading Bot Architecture",
            "create_time": "2024-04-01T08:00:00Z",
            "update_time": "2024-04-01T09:00:00Z",
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "Design a trading bot architecture using Python."}],
                },
                {
                    "role": "model",
                    "parts": [
                        {
                            "text": "Here's a recommended architecture for a Python trading bot..."
                        }
                    ],
                },
            ],
        },
        {
            "conversation_id": "conv_gemini_002",
            "display_name": "Foreclosure Property Analysis",
            "create_time": "2024-04-02T14:00:00Z",
            "update_time": "2024-04-02T14:30:00Z",
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": "How do I analyze foreclosure properties for STR potential?"
                        }
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        {
                            "text": "Analyzing foreclosure properties for short-term rental involves..."
                        }
                    ],
                },
            ],
        },
    ]


def fetch_user_instructions(auth_token: str) -> dict:
    """
    Mock extraction of Gemini user preferences / system instructions.

    Real implementation would pull from Google AI Studio settings or
    Gemini Advanced account preferences.
    """
    # TODO: Replace with real export mechanism
    return {
        "system_instruction": (
            "You are a knowledgeable assistant for finance, real estate, and technology. "
            "Provide data-driven insights and keep responses under 300 words unless asked for detail."
        ),
        "safety_settings": {
            "harassment": "BLOCK_MEDIUM_AND_ABOVE",
            "hate_speech": "BLOCK_MEDIUM_AND_ABOVE",
        },
        "enabled": True,
    }


def fetch_response_styles(auth_token: str) -> list[dict]:
    """
    Mock extraction of Gemini response style / tone preferences.
    """
    # TODO: Replace with real API call
    return [
        {
            "style_id": "gemini_style_001",
            "name": "Data-Driven Analyst",
            "description": "Numbers-first, cite sources, use structured tables when applicable",
            "active": True,
        },
        {
            "style_id": "gemini_style_002",
            "name": "Creative Brainstormer",
            "description": "Free-flowing ideation with divergent thinking prompts",
            "active": False,
        },
    ]


# ---------------------------------------------------------------------------
# Import helpers
# ---------------------------------------------------------------------------

def push_user_instructions(instructions: dict, auth_token: str) -> dict:
    """
    Mock import of user instructions / system prompt into Gemini.

    Real implementation would use the Google AI Studio API or
    Gemini API's system_instruction parameter in a cached context.
    """
    # TODO: Replace with real Gemini API call
    # import google.generativeai as genai
    # genai.configure(api_key=auth_token)
    # model = genai.GenerativeModel(
    #     model_name="gemini-1.5-pro",
    #     system_instruction=instructions.get("system_instruction")
    # )

    print(f"  [Gemini Mock] Uploaded system instruction / user preferences.")
    return {"status": "mock_success", "platform": "gemini"}


def push_response_styles(styles: list[dict], auth_token: str) -> dict:
    """
    Mock import of response style preferences into Gemini.
    """
    # TODO: Replace with real API call
    print(f"  [Gemini Mock] Uploaded {len(styles)} response style(s).")
    return {"status": "mock_success", "platform": "gemini", "styles_uploaded": len(styles)}


def push_chat_history(conversations: list[dict], auth_token: str) -> dict:
    """
    Mock import of chat history into Gemini.

    NOTE: Google does not currently provide a public API for importing
    existing conversation history into Gemini. This is a placeholder
    for potential future capability.
    """
    # TODO: Implement when Google exposes a Gemini import endpoint
    print(
        f"  [Gemini Mock] Chat history import simulated for {len(conversations)} conversation(s)."
    )
    return {
        "status": "mock_success",
        "platform": "gemini",
        "conversations_uploaded": len(conversations),
        "note": "Google does not yet provide a public import API for Gemini chat history.",
    }

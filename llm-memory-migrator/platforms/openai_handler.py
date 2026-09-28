"""
platforms/openai_handler.py
---------------------------
Platform-specific helper functions for OpenAI ChatGPT.

Called by src/extractor.py and src/importer.py to handle OpenAI-specific
data shapes and (future) API interactions.

MVP: All functions return mock data or simulate import actions.
TODO: Replace mock bodies with real OpenAI API calls when credentials are
      available (see config/config.py for key placeholders).
"""

from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def fetch_chat_history(auth_token: str) -> list[dict]:
    """
    Mock extraction of ChatGPT conversation history.

    Real implementation would call:
        GET https://api.openai.com/v1/conversations
    with a bearer token obtained via OAuth.

    Returns a list of conversation objects in OpenAI's native format.
    """
    # TODO: Replace with real API call
    # import requests
    # headers = {"Authorization": f"Bearer {auth_token}"}
    # response = requests.get(f"{OPENAI_BASE_URL}/conversations", headers=headers)
    # return response.json()["items"]

    return [
        {
            "id": "conv_openai_001",
            "title": "Python Async Patterns",
            "create_time": 1711929600.0,
            "update_time": 1711933200.0,
            "mapping": {
                "msg_001": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["Can you explain asyncio event loops?"]},
                    }
                },
                "msg_002": {
                    "message": {
                        "author": {"role": "assistant"},
                        "content": {
                            "parts": [
                                "Sure! An asyncio event loop is the core of every async application..."
                            ]
                        },
                    }
                },
            },
        },
        {
            "id": "conv_openai_002",
            "title": "Real Estate Investment Tips",
            "create_time": 1712016000.0,
            "update_time": 1712019600.0,
            "mapping": {
                "msg_003": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["What are the best strategies for STR investing?"]},
                    }
                },
                "msg_004": {
                    "message": {
                        "author": {"role": "assistant"},
                        "content": {
                            "parts": [
                                "Short-term rental investing involves several key considerations..."
                            ]
                        },
                    }
                },
            },
        },
    ]


def fetch_user_instructions(auth_token: str) -> dict:
    """
    Mock extraction of custom user instructions / system prompt overrides.

    Real implementation would call the ChatGPT user-settings or
    custom-instructions endpoint (currently no public API; would rely
    on browser-based export or unofficial endpoints).
    """
    # TODO: Replace with real export mechanism
    return {
        "enabled": True,
        "about_user": "I am a real estate investor and software developer. I prefer concise, actionable advice.",
        "response_preferences": "Always use bullet points. Skip disclaimers. Use professional tone.",
    }


def fetch_response_styles(auth_token: str) -> list[dict]:
    """
    Mock extraction of GPT persona / response style preferences.

    Real implementation would pull from user profile or exported settings.
    """
    # TODO: Replace with real API call
    return [
        {
            "style_id": "openai_style_001",
            "name": "Concise Expert",
            "description": "Bullet points, no fluff, expert-level vocabulary",
            "active": True,
        },
        {
            "style_id": "openai_style_002",
            "name": "Socratic Teacher",
            "description": "Guides through questions rather than giving direct answers",
            "active": False,
        },
    ]


# ---------------------------------------------------------------------------
# Import helpers
# ---------------------------------------------------------------------------

def push_user_instructions(instructions: dict, auth_token: str) -> dict:
    """
    Mock import of user instructions into OpenAI ChatGPT.

    Real implementation would use the custom-instructions update endpoint.
    """
    # TODO: Replace with real API call
    # import requests
    # headers = {"Authorization": f"Bearer {auth_token}"}
    # payload = { "about_user": instructions.get("about_user"), ... }
    # response = requests.post(f"{OPENAI_BASE_URL}/me/custom_instructions", ...)
    # return response.json()

    print(f"  [OpenAI Mock] Uploaded user instructions: {list(instructions.keys())}")
    return {"status": "mock_success", "platform": "openai"}


def push_response_styles(styles: list[dict], auth_token: str) -> dict:
    """
    Mock import of response styles into OpenAI ChatGPT.
    """
    # TODO: Replace with real API call
    print(f"  [OpenAI Mock] Uploaded {len(styles)} response style(s).")
    return {"status": "mock_success", "platform": "openai", "styles_uploaded": len(styles)}


def push_chat_history(conversations: list[dict], auth_token: str) -> dict:
    """
    Mock import of chat history into OpenAI.

    NOTE: OpenAI does not currently offer a public API for importing
    conversation history. This is a placeholder for a potential future
    capability or unofficial mechanism.
    """
    # TODO: Implement if/when OpenAI exposes an import endpoint
    print(
        f"  [OpenAI Mock] Chat history import simulated for {len(conversations)} conversation(s)."
    )
    return {
        "status": "mock_success",
        "platform": "openai",
        "conversations_uploaded": len(conversations),
        "note": "OpenAI does not yet provide a public import API for chat history.",
    }

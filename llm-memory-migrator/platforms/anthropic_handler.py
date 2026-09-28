"""
platforms/anthropic_handler.py
-------------------------------
Platform-specific helper functions for Anthropic Claude.

Called by src/extractor.py and src/importer.py to handle Anthropic-specific
data shapes and (future) API interactions.

MVP: All functions return mock data or simulate import actions.
TODO: Replace mock bodies with real Anthropic API calls when credentials are
      available (see config/config.py for key placeholders).
"""


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def fetch_chat_history(auth_token: str) -> list[dict]:
    """
    Mock extraction of Claude conversation history.

    Real implementation would call Anthropic's conversations endpoint
    (currently requires account-level export or future API support).

    Anthropic's native message format uses a flat 'messages' array with
    'role' and 'content' fields.
    """
    # TODO: Replace with real API call once Anthropic exposes export endpoint
    return [
        {
            "conversation_id": "conv_anthropic_001",
            "name": "Startup SaaS Ideas",
            "created_at": "2024-04-01T10:00:00Z",
            "updated_at": "2024-04-01T11:00:00Z",
            "messages": [
                {
                    "role": "user",
                    "content": "What SaaS ideas have the highest growth potential in 2024?",
                },
                {
                    "role": "assistant",
                    "content": "Here are several high-potential SaaS verticals for 2024...",
                },
            ],
        },
        {
            "conversation_id": "conv_anthropic_002",
            "name": "Code Review: Flight Arbitrage",
            "created_at": "2024-04-02T09:00:00Z",
            "updated_at": "2024-04-02T09:45:00Z",
            "messages": [
                {
                    "role": "user",
                    "content": "Please review my FastAPI backend for the flight arbitrage tool.",
                },
                {
                    "role": "assistant",
                    "content": "I've reviewed the code. Here are my observations and suggestions...",
                },
            ],
        },
    ]


def fetch_user_instructions(auth_token: str) -> dict:
    """
    Mock extraction of Claude system prompt / user preferences.

    Real implementation would pull from Claude.ai account settings
    or a future Anthropic preferences API.
    """
    # TODO: Replace with real export mechanism
    return {
        "system_prompt": (
            "You are a helpful assistant specializing in software development, "
            "real estate investing, and entrepreneurship. Always be concise and actionable."
        ),
        "custom_persona": "Alex – Strategic Advisor",
        "enabled": True,
    }


def fetch_response_styles(auth_token: str) -> list[dict]:
    """
    Mock extraction of preferred Claude response styles.
    """
    # TODO: Replace with real API call
    return [
        {
            "style_id": "anthropic_style_001",
            "name": "Strategic Advisor",
            "description": "Analytical, structured responses with pros/cons breakdowns",
            "active": True,
        },
        {
            "style_id": "anthropic_style_002",
            "name": "Code Reviewer",
            "description": "Focused on code quality, security, and best practices",
            "active": False,
        },
    ]


# ---------------------------------------------------------------------------
# Import helpers
# ---------------------------------------------------------------------------

def push_user_instructions(instructions: dict, auth_token: str) -> dict:
    """
    Mock import of user instructions / system prompt into Claude.

    Real implementation would use the Anthropic API to set a default
    system prompt (requires account-level API access).
    """
    # TODO: Replace with real Anthropic API call
    # import anthropic
    # client = anthropic.Anthropic(api_key=auth_token)
    # ... store system prompt via account settings endpoint

    print(f"  [Anthropic Mock] Uploaded system prompt / user instructions.")
    return {"status": "mock_success", "platform": "anthropic"}


def push_response_styles(styles: list[dict], auth_token: str) -> dict:
    """
    Mock import of response style preferences into Claude.
    """
    # TODO: Replace with real API call
    print(f"  [Anthropic Mock] Uploaded {len(styles)} response style(s).")
    return {"status": "mock_success", "platform": "anthropic", "styles_uploaded": len(styles)}


def push_chat_history(conversations: list[dict], auth_token: str) -> dict:
    """
    Mock import of chat history into Claude.

    NOTE: Anthropic does not currently provide a public API for importing
    conversation history. This function simulates the process.
    """
    # TODO: Implement when Anthropic exposes an import endpoint
    print(
        f"  [Anthropic Mock] Chat history import simulated for {len(conversations)} conversation(s)."
    )
    return {
        "status": "mock_success",
        "platform": "anthropic",
        "conversations_uploaded": len(conversations),
        "note": "Anthropic does not yet provide a public import API for chat history.",
    }

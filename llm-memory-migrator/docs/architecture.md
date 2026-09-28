# LLM Memory Migration Tool – Architecture Overview

## Data Flow

```
[Source Platform]
      |
      v
 extractor.py  ──── platforms/{source}_handler.py
      |
      | (platform-native format)
      v
transformer.py  ──── converts to standardized internal schema
      |
      | (platform-agnostic format)
      v
 importer.py   ──── platforms/{target}_handler.py
      |
      v
[Target Platform]
```

## Standardized Internal Schema

All data passes through a common schema before import:

### chat_history
```json
{
  "id": "string",
  "title": "string",
  "timestamp": "ISO 8601 string",
  "messages": [
    {"role": "user|assistant", "content": "string"}
  ]
}
```

### user_instructions
```json
{
  "system_prompt": "string",
  "about_user": "string",
  "response_preferences": "string",
  "source_platform": "string",
  "enabled": true
}
```

### response_styles
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "active": true,
  "source_platform": "string"
}
```

## Platform-Native Quirks

| Platform  | chat role name | conversation key  | message wrapper       |
|-----------|----------------|-------------------|-----------------------|
| OpenAI    | user/assistant | `mapping` dict    | `content.parts[]`     |
| Anthropic | user/assistant | `messages[]`      | direct `content` str  |
| Gemini    | user/**model** | `contents[]`      | `parts[].text`        |

The transformer normalizes all quirks (e.g., Gemini's `model` → `assistant`).

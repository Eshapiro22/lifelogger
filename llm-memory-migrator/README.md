# LLM Memory Migration & Portability Tool

Migrate your chat history, user instructions, and response style preferences across **OpenAI ChatGPT**, **Anthropic Claude**, and **Google Gemini** — from a single CLI.

> **MVP Status:** All platform interactions use mock data. No real API keys or internet connection required to run the tool today. See [Adding Real API Integrations](#adding-real-api-integrations) to go live.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Quick Start](#quick-start)
3. [CLI Reference](#cli-reference)
4. [Mock Data & Migration Results](#mock-data--migration-results)
5. [Standardized Internal Format](#standardized-internal-format)
6. [Adding Real API Integrations](#adding-real-api-integrations)
7. [Running Tests](#running-tests)
8. [Future Enhancements](#future-enhancements)

---

## Project Structure

```
llm-memory-migrator/
├── main.py                        # CLI entry point
├── requirements.txt
├── README.md
│
├── src/                           # Core pipeline logic
│   ├── extractor.py               # Extract data from source platform
│   ├── transformer.py             # Normalize to platform-agnostic schema
│   └── importer.py                # Import normalized data into target platform
│
├── platforms/                     # Platform-specific handlers
│   ├── openai_handler.py
│   ├── anthropic_handler.py
│   └── gemini_handler.py
│
├── data/                          # Mock data & schema examples
│   ├── mock_chat_history.json
│   ├── mock_user_instructions.json
│   ├── mock_response_styles.json
│   └── standardized_format_example.json
│
├── config/
│   └── config.py                  # API key placeholders & settings
│
├── docs/
│   └── architecture.md            # Data flow & schema reference
│
└── tests/
    ├── test_extractor.py
    ├── test_transformer.py
    └── test_importer.py
```

---

## Quick Start

### 1. Clone & set up environment

```bash
git clone <repo-url>
cd llm-memory-migrator

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run a mock migration

Migrate **all data types** from OpenAI to Anthropic (mock, no keys needed):

```bash
python main.py --source openai --target anthropic
```

Migrate only **chat history** from Gemini to OpenAI:

```bash
python main.py --source gemini --target openai --data-types chat_history
```

Migrate **user instructions and response styles** from Anthropic to Gemini:

```bash
python main.py --source anthropic --target gemini \
    --data-types user_instructions response_styles
```

Dry run (extract + transform only, skip import):

```bash
python main.py --source openai --target gemini --dry-run
```

Save the full migration report to a JSON file:

```bash
python main.py --source openai --target anthropic --output report.json
```

### 3. Expected output

```
============================================================
  LLM Memory Migration Tool – MVP
  OPENAI → ANTHROPIC
  Data types: chat_history, user_instructions, response_styles
============================================================

[CHAT_HISTORY]
  Step 1/3 – Extract
  [Extractor] Extracting 'chat_history' from 'openai'...
  [Extractor] Retrieved 2 record(s).
  Step 2/3 – Transform
  [Transformer] Converting 'chat_history' from 'openai' → 'anthropic'...
  [Transformer] Normalized 2 record(s).
  Step 3/3 – Import
  [Importer] Importing 'chat_history' into 'anthropic'...
  [Anthropic Mock] Chat history import simulated for 2 conversation(s).

  --- Import Summary ---
    conversations: 2
    total_messages: 4
    titles: ['Python Async Patterns', 'Real Estate Investment Tips']
  ----------------------
...
============================================================
  Migration Complete – migration_20240401_120000
============================================================
  [OK] chat_history: mock_success
  [OK] user_instructions: mock_success
  [OK] response_styles: mock_success
============================================================
```

---

## CLI Reference

```
python main.py [OPTIONS]

Options:
  --source PLATFORM         Source platform (openai | anthropic | gemini)  [required]
  --target PLATFORM         Target platform (openai | anthropic | gemini)  [required]
  --data-types TYPE [...]   Data types to migrate (default: all)
                            Choices: chat_history user_instructions response_styles
  --auth-token TOKEN        Auth token for APIs (default: mock_token)
  --output FILE             Save migration report as JSON
  --dry-run                 Skip import step (extract + transform only)
  -h, --help                Show this message and exit
```

---

## Mock Data & Migration Results

The tool ships with mock data in `data/` representing realistic platform exports:

| File | Description |
|------|-------------|
| `mock_chat_history.json` | 2 conversations per platform in each platform's native format |
| `mock_user_instructions.json` | System prompts and user preference settings per platform |
| `mock_response_styles.json` | Named response style personas per platform |
| `standardized_format_example.json` | Example of the normalized internal schema |

**How to read mock migration results:**
- "mock_success" status = the import function was called correctly and would succeed with real credentials
- "record_count" in the report = number of items processed through the pipeline
- The JSON output file (via `--output`) contains the full normalized data and per-step results

---

## Standardized Internal Format

All data is normalized to a platform-agnostic schema before import:

```json
{
  "schema_version": "1.0",
  "source_platform": "openai",
  "target_platform": "anthropic",
  "data_type": "chat_history",
  "exported_at": "2024-04-01T12:00:00+00:00",
  "record_count": 2,
  "records": [
    {
      "id": "conv_001",
      "title": "Conversation Title",
      "timestamp": "2024-04-01T08:00:00+00:00",
      "messages": [
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "..."}
      ]
    }
  ]
}
```

See `docs/architecture.md` for the full schema reference and per-platform quirk notes.

---

## Adding Real API Integrations

Each platform handler (`platforms/openai_handler.py`, etc.) contains `TODO` comments
marking exactly where real API calls should replace mock returns.

### Step-by-step

1. **Add credentials** to `config/config.py` or set environment variables:
   ```bash
   export OPENAI_API_KEY="sk-..."
   export ANTHROPIC_API_KEY="sk-ant-..."
   export GEMINI_API_KEY="AIza..."
   ```

2. **Install the relevant SDK** (uncomment lines in `requirements.txt`):
   ```bash
   pip install openai anthropic google-generativeai
   ```

3. **Replace mock functions** in the platform handler:
   ```python
   # platforms/anthropic_handler.py – fetch_chat_history()
   # BEFORE (mock):
   return [ { "conversation_id": "conv_001", ... } ]

   # AFTER (real):
   import anthropic
   client = anthropic.Anthropic(api_key=auth_token)
   # ... call the actual Anthropic export/conversations endpoint
   ```

4. **Authentication notes:**
   - OpenAI: Bearer token via OAuth or API key
   - Anthropic: API key header `x-api-key`
   - Gemini: API key query param or service account JSON

> **Note:** Chat history import APIs are not yet publicly available on any of the three
> platforms. The import handlers simulate this step. Monitor platform announcements
> for data portability features.

---

## Running Tests

```bash
# Run all tests
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_transformer.py -v

# Run without pytest (stdlib unittest)
python tests/test_extractor.py
python tests/test_transformer.py
python tests/test_importer.py
```

---

## Future Enhancements

| Feature | Notes |
|---------|-------|
| **OAuth Authentication** | Secure token flow for each platform instead of raw API keys |
| **Document Upload Migration** | Re-upload files/attachments referenced in conversations |
| **Fine-tuned Model Export** | Highly platform-specific; requires vendor cooperation |
| **Web UI (React)** | Drag-and-drop interface with live migration progress |
| **Robust Error Handling** | Retry logic, partial migration recovery, conflict resolution |
| **Incremental Sync** | Timestamp-based delta sync to avoid re-importing existing data |
| **Encryption at Rest** | Encrypt exported JSON files containing sensitive conversation data |
| **More Platforms** | Mistral, Cohere, Meta AI, and open-source model platforms |

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Kq5HxMMeotiAoy9wCep14m

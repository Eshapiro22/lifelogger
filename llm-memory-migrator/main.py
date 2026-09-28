#!/usr/bin/env python3
"""
main.py
-------
CLI entry point for the LLM Memory Migration & Portability Tool.

Orchestrates extraction → transformation → import for user data
(chat history, user instructions, response styles) across OpenAI,
Anthropic Claude, and Google Gemini.

Usage examples:
    # Migrate all data types from OpenAI to Anthropic (mock run)
    python main.py --source openai --target anthropic

    # Migrate only chat history from Gemini to OpenAI
    python main.py --source gemini --target openai --data-types chat_history

    # Migrate multiple specific types
    python main.py --source anthropic --target gemini \\
        --data-types user_instructions response_styles

    # Save transformed output to a JSON file
    python main.py --source openai --target anthropic --output migration_result.json
"""

import argparse
import json
import sys
import os
from datetime import datetime, timezone

# Ensure project root is on the path so relative imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.config import SUPPORTED_PLATFORMS, SUPPORTED_DATA_TYPES
from src.extractor import extract_data
from src.transformer import transform_data
from src.importer import import_data


# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="llm-migrator",
        description="LLM Memory Migration & Portability Tool – MVP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--source",
        required=True,
        choices=SUPPORTED_PLATFORMS,
        metavar="PLATFORM",
        help=f"Source platform to extract from. Choices: {SUPPORTED_PLATFORMS}",
    )
    parser.add_argument(
        "--target",
        required=True,
        choices=SUPPORTED_PLATFORMS,
        metavar="PLATFORM",
        help=f"Target platform to import into. Choices: {SUPPORTED_PLATFORMS}",
    )
    parser.add_argument(
        "--data-types",
        nargs="+",
        choices=SUPPORTED_DATA_TYPES,
        default=SUPPORTED_DATA_TYPES,
        metavar="TYPE",
        dest="data_types",
        help=(
            f"One or more data types to migrate. "
            f"Choices: {SUPPORTED_DATA_TYPES}. "
            f"Defaults to all types."
        ),
    )
    parser.add_argument(
        "--auth-token",
        default="mock_token",
        metavar="TOKEN",
        dest="auth_token",
        help="Auth token for platform APIs. Defaults to 'mock_token' for MVP dry-runs.",
    )
    parser.add_argument(
        "--output",
        default=None,
        metavar="FILE",
        help="Optional path to save the full migration result as JSON.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        dest="dry_run",
        help="Extract and transform only; skip the import step.",
    )
    return parser


# ---------------------------------------------------------------------------
# Core migration orchestrator
# ---------------------------------------------------------------------------

def run_migration(
    source: str,
    target: str,
    data_types: list[str],
    auth_token: str = "mock_token",
    dry_run: bool = False,
) -> dict:
    """
    Orchestrate the full Extract → Transform → Import pipeline.

    Parameters
    ----------
    source : str
        Source platform identifier.
    target : str
        Target platform identifier.
    data_types : list[str]
        List of data types to migrate.
    auth_token : str
        Auth token passed to platform handlers (mock by default).
    dry_run : bool
        If True, skip the import step.

    Returns
    -------
    dict
        Full migration report including per-type results.
    """
    if source == target:
        print(
            f"[Warning] Source and target are both '{source}'. "
            "Migration will proceed but may be redundant."
        )

    report = {
        "migration_id": f"migration_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        "source_platform": source,
        "target_platform": target,
        "data_types_requested": data_types,
        "dry_run": dry_run,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "results": {},
    }

    print(f"\n{'='*60}")
    print(f"  LLM Memory Migration Tool – MVP")
    print(f"  {source.upper()} → {target.upper()}")
    print(f"  Data types: {', '.join(data_types)}")
    if dry_run:
        print("  [DRY RUN – import step will be skipped]")
    print(f"{'='*60}\n")

    for data_type in data_types:
        print(f"[{data_type.upper()}]")
        type_result = {"data_type": data_type, "status": "pending"}

        try:
            # Step 1: Extract
            print(f"  Step 1/3 – Extract")
            extracted = extract_data(
                platform=source,
                data_type=data_type,
                auth_token=auth_token,
            )

            # Step 2: Transform
            print(f"  Step 2/3 – Transform")
            transformed = transform_data(
                extracted=extracted,
                source_platform=source,
                target_platform=target,
                data_type=data_type,
            )

            type_result["extracted_count"] = extracted.get("record_count", 0)
            type_result["transformed_count"] = transformed.get("record_count", 0)
            type_result["transformed_data"] = transformed

            # Step 3: Import (unless dry run)
            if dry_run:
                print(f"  Step 3/3 – Import [SKIPPED – dry run]")
                type_result["status"] = "dry_run_complete"
                type_result["import_result"] = None
            else:
                print(f"  Step 3/3 – Import")
                import_result = import_data(
                    transformed=transformed,
                    target_platform=target,
                    auth_token=auth_token,
                )
                type_result["status"] = import_result.get("status", "unknown")
                type_result["import_result"] = import_result

        except Exception as exc:
            print(f"  [ERROR] {exc}")
            type_result["status"] = "error"
            type_result["error"] = str(exc)

        report["results"][data_type] = type_result
        print()

    report["completed_at"] = datetime.now(timezone.utc).isoformat()

    # Print final summary
    _print_final_summary(report)

    return report


# ---------------------------------------------------------------------------
# Summary printer
# ---------------------------------------------------------------------------

def _print_final_summary(report: dict) -> None:
    print(f"{'='*60}")
    print(f"  Migration Complete – {report['migration_id']}")
    print(f"{'='*60}")
    for dtype, result in report["results"].items():
        status = result.get("status", "unknown")
        icon = "OK" if "success" in status or "complete" in status else "FAIL"
        print(f"  [{icon}] {dtype}: {status}")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main():
    parser = build_parser()
    args = parser.parse_args()

    report = run_migration(
        source=args.source,
        target=args.target,
        data_types=args.data_types,
        auth_token=args.auth_token,
        dry_run=args.dry_run,
    )

    if args.output:
        output_path = args.output
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"Migration report saved to: {output_path}\n")


if __name__ == "__main__":
    main()

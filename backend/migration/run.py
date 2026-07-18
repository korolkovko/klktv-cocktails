"""CLI: wire env -> load, then verify.

Usage: python -m migration.run [--verify-only]

`migration.verify` is a separate deliverable (Phase 0 plan, later task); until
it exists this CLI simply reports the load stats and skips verification
rather than failing the whole run.
"""
import argparse
import os

from migration.load import load


def main():
    parser = argparse.ArgumentParser(description="Prod -> v2 migration CLI")
    parser.add_argument("--verify-only", action="store_true",
                         help="Skip the load step; only run verification")
    args = parser.parse_args()

    src = os.environ["SRC_DATABASE_URL"]
    dest = os.environ["DEST_DATABASE_URL"]

    if not args.verify_only:
        stats = load(src, dest)
        print("LOAD:", stats)

    try:
        from migration.verify import verify
    except ImportError:
        print("VERIFY: skipped (migration.verify not implemented yet)")
        return

    verify(src, dest)


if __name__ == "__main__":
    main()

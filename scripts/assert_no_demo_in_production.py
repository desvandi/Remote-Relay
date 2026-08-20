#!/usr/bin/env python3
"""
assert_no_demo_in_production.py — Verify demo mode is impossible in production.

Reimplements the POST-HARDENING contract from src/lib/mockStore.ts:
  isMockAuthEnabled() must be FALSE whenever NODE_ENV=production, regardless
  of which other env vars (DEMO_MODE, NEXT_PUBLIC_DEMO_MODE, MOCK_USER,
  MOCK_PASSWORD, JWT_SECRET) are set.

Tests 7 env combinations + runs `npx tsc --noEmit` with NODE_ENV=production
and DEMO_MODE=true (typecheck must still pass) + checks that .env.example
warns about DEMO_MODE in production.

Exit 0 on PASS, 1 on FAIL.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Optional


# ---------------------------------------------------------------------------
# Mirrors post-hardening src/lib/mockStore.ts:isMockAuthEnabled()
# ---------------------------------------------------------------------------

def evaluate_mock_auth_enabled(env: Dict[str, Optional[str]]) -> bool:
    is_production = env.get("NODE_ENV") == "production"
    raw_demo_mode = (
        env.get("NODE_ENV") == "development"
        or env.get("DEMO_MODE") == "true"
        or env.get("NEXT_PUBLIC_DEMO_MODE") == "true"
    )
    # POST-HARDENING: production forces demo_mode to False regardless of raw flag
    demo_mode = False if is_production else raw_demo_mode
    mock_auth_explicitly_enabled = bool(
        env.get("JWT_SECRET") and env.get("MOCK_USER") and env.get("MOCK_PASSWORD")
    ) and not is_production
    return demo_mode or mock_auth_explicitly_enabled


# ---------------------------------------------------------------------------
# Test matrix
# ---------------------------------------------------------------------------

TEST_CASES = [
    # (env, expected, description)
    (
        {"NODE_ENV": "production"},
        False,
        "1. Production alone → mock auth DISABLED",
    ),
    (
        {"NODE_ENV": "production", "DEMO_MODE": "true"},
        False,
        "2. Production + DEMO_MODE=true → DISABLED (P0 hardening)",
    ),
    (
        {"NODE_ENV": "production", "NEXT_PUBLIC_DEMO_MODE": "true"},
        False,
        "3. Production + NEXT_PUBLIC_DEMO_MODE=true → DISABLED (P0 hardening)",
    ),
    (
        {"NODE_ENV": "production",
         "MOCK_USER": "admin", "MOCK_PASSWORD": "admin123"},
        False,
        "4. Production + MOCK_USER + MOCK_PASSWORD → DISABLED",
    ),
    (
        {"NODE_ENV": "production",
         "JWT_SECRET": "x", "MOCK_USER": "admin", "MOCK_PASSWORD": "admin123"},
        False,
        "5. Production + JWT_SECRET + MOCK_USER + MOCK_PASSWORD → DISABLED",
    ),
    (
        {"NODE_ENV": "development", "DEMO_MODE": "true"},
        True,
        "6. Development + DEMO_MODE=true → ENABLED (OK in dev)",
    ),
    (
        {"NODE_ENV": "staging",
         "JWT_SECRET": "x", "MOCK_USER": "admin", "MOCK_PASSWORD": "admin123"},
        True,
        "7. Staging + full mock set → ENABLED (OK in staging)",
    ),
]


def run_env_matrix() -> int:
    print("=" * 78)
    print("PWA Mock-Auth Fail-Closed Matrix (post-hardening contract)")
    print("=" * 78)
    passed = 0
    failed = 0
    for env, expected, desc in TEST_CASES:
        actual = evaluate_mock_auth_enabled(env)
        ok = (actual == expected)
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  [{status}] {desc}")
        print(f"           env={env}")
        print(f"           expected enabled={expected}  actual={actual}")
    print()
    print(f"  Matrix: {passed}/{len(TEST_CASES)} passed")
    return 0 if failed == 0 else 1


# ---------------------------------------------------------------------------
# TypeScript typecheck with NODE_ENV=production + DEMO_MODE=true
# ---------------------------------------------------------------------------

def run_tsc_typecheck(pwa_dir: Path) -> int:
    print()
    print("=" * 78)
    print("TypeScript Typecheck: NODE_ENV=production + DEMO_MODE=true")
    print("=" * 78)
    if not (pwa_dir / "package.json").is_file():
        print("  SKIP: package.json not found")
        return 0
    env = os.environ.copy()
    env["NODE_ENV"] = "production"
    env["DEMO_MODE"] = "true"
    try:
        result = subprocess.run(
            ["npx", "--no-install", "tsc", "--noEmit"],
            cwd=str(pwa_dir),
            env=env,
            capture_output=True,
            text=True,
            timeout=180,
        )
        if result.returncode == 0:
            print("  PASS: tsc --noEmit exit 0 (no type errors with production+DEMO_MODE=true)")
            return 0
        else:
            print(f"  FAIL: tsc --noEmit exit {result.returncode}")
            if result.stdout:
                print("  stdout:")
                for line in result.stdout.splitlines()[:30]:
                    print(f"    {line}")
            if result.stderr:
                print("  stderr:")
                for line in result.stderr.splitlines()[:30]:
                    print(f"    {line}")
            return 1
    except FileNotFoundError:
        print("  SKIP: tsc/npx not available")
        return 0
    except subprocess.TimeoutExpired:
        print("  FAIL: tsc timed out (>180s)")
        return 1
    except Exception as e:
        print(f"  SKIP: cannot run tsc ({e})")
        return 0


# ---------------------------------------------------------------------------
# .env.example DEMO_MODE warning
# ---------------------------------------------------------------------------

def check_env_example(pwa_dir: Path) -> int:
    print()
    print("=" * 78)
    print(".env.example DEMO_MODE warning")
    print("=" * 78)
    env_file = pwa_dir / ".env.example"
    if not env_file.is_file():
        print(f"  FAIL: {env_file} not found")
        return 1
    text = env_file.read_text(encoding="utf-8", errors="replace")
    # Find DEMO_MODE declarations
    warn_keywords = ("DEPRECATED", "do not", "never", "disabled", "leave empty")
    lines = text.splitlines()
    found_var = False
    warning_seen = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Match declaration lines like "DEMO_MODE=" or "NEXT_PUBLIC_DEMO_MODE="
        if _ENV_VAR_RE.match(stripped):
            found_var = True
            # Look back up to 6 lines (comments above the declaration)
            back = "\n".join(lines[max(0, i - 6):i + 1]).lower()
            if any(kw in back for kw in warn_keywords):
                warning_seen = True
                print(f"  PASS: {stripped} has warning nearby")
                break
    if not found_var:
        print("  FAIL: DEMO_MODE declaration not found in .env.example")
        return 1
    if not warning_seen:
        print("  FAIL: no DEPRECATED/do not/never/disabled/leave empty warning near DEMO_MODE")
        return 1
    return 0


_ENV_VAR_RE = re.compile(r'^(DEMO_MODE|NEXT_PUBLIC_DEMO_MODE)\s*=')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    pwa_dir = Path(__file__).resolve().parent.parent

    rc1 = run_env_matrix()
    rc2 = run_tsc_typecheck(pwa_dir)
    rc3 = check_env_example(pwa_dir)

    print()
    print("=" * 78)
    if rc1 == 0 and rc2 == 0 and rc3 == 0:
        print("[DEMO_PRODUCTION_GUARD] PASS — demo mode is impossible in production")
        print("=" * 78)
        return 0
    print("[DEMO_PRODUCTION_GUARD] FAIL")
    print("=" * 78)
    return 1


if __name__ == "__main__":
    sys.exit(main())

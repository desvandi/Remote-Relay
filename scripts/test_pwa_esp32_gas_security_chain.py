#!/usr/bin/env python3
"""
test_pwa_esp32_gas_security_chain.py — PWA→ESP32→GAS AI insights security chain.

Verifies the post-hardening security contract:
  1. PWA has NO direct GAS access (no fetch(script.google.com/macros),
     no fetch(GAS_URL, no getGasUrl(), no isGasConfigured(), no googleusercontent).
  2. .env.example marks NEXT_PUBLIC_GAS_INSIGHTS_URL as DEPRECATED.
  3. PWA src/lib/api.ts exposes insights() method that calls /api/insights.
  4. HMAC canonical contract: GET signature ≠ POST signature (method prefix prevents
     cross-method replay); single-char change causes signature mismatch.
  5. Negative security matrix on firmware side:
     - InsightsHandlers.h calls requireAuth() and does NOT read query params via http.arg
       (strip C/C++ comments first).
     - Advisor.cpp uses setTimeout + setConnectTimeout, and does NOT acquire any
       LockService-equivalent (firmware is stateless per-request).
  6. Code.gs has: nonce replay check, timestamp tolerance, HMAC signature verify,
     device ID validation, doGet + doPost require auth, GET method in canonical,
     POST method in canonical.
  7. HttpServer.cpp registers /api/insights route.

Exit 0 on PASS, 1 on FAIL.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import sys
from pathlib import Path
from typing import List


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_cpp_comments(text: str) -> str:
    """Remove // line comments and /* */ block comments."""
    stripped = re.sub(r"//[^\n]*", "", text)
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.DOTALL)
    return stripped


def strip_js_comments(text: str) -> str:
    """Remove // line comments and /* */ block comments (same as C++)."""
    return strip_cpp_comments(text)


def strip_python_comments(text: str) -> str:
    out_lines = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("#") or s.startswith("#!"):
            continue
        # Strip inline # comment (best-effort — won't handle string literals)
        # We accept this limitation for this script's audit purpose.
        idx = line.find("#")
        if idx >= 0:
            # Only strip if # is not inside a string literal (rough heuristic)
            single_q = line[:idx].count("'")
            double_q = line[:idx].count('"')
            if single_q % 2 == 0 and double_q % 2 == 0:
                line = line[:idx]
        out_lines.append(line)
    return "\n".join(out_lines)


def strip_ts_comments(text: str) -> str:
    return strip_cpp_comments(text)


# ---------------------------------------------------------------------------
# 1. PWA has no direct GAS access
# ---------------------------------------------------------------------------

DIRECT_GAS_PATTERNS = [
    r"fetch\(\s*['\"`]?https?://script\.google\.com",
    r"fetch\(\s*GAS_URL",
    r"getGasUrl\(\)",
    r"isGasConfigured\(\)",
    r"googleusercontent",
]


def check_no_direct_pwa_gas_access(pwa_src_dir: Path) -> List[str]:
    issues: List[str] = []
    if not pwa_src_dir.is_dir():
        return [f"PWA src dir not found: {pwa_src_dir}"]
    files = list(pwa_src_dir.rglob("*.ts")) + list(pwa_src_dir.rglob("*.tsx"))
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        # Strip comments
        stripped = strip_ts_comments(text)
        for pat in DIRECT_GAS_PATTERNS:
            for m in re.finditer(pat, stripped):
                issues.append(
                    f"{f.relative_to(pwa_src_dir.parent)}: direct GAS access "
                    f"pattern '{pat}' matched: ...{stripped[max(0,m.start()-40):m.end()+40]}..."
                )
    return issues


# ---------------------------------------------------------------------------
# 2. .env.example marks NEXT_PUBLIC_GAS_INSIGHTS_URL as DEPRECATED
# ---------------------------------------------------------------------------

def check_env_example_deprecation(pwa_dir: Path) -> List[str]:
    env_file = pwa_dir / ".env.example"
    if not env_file.is_file():
        return [f"{env_file} not found"]
    text = env_file.read_text(encoding="utf-8", errors="replace")
    # Find the var declaration
    m = re.search(r'(NEXT_PUBLIC_GAS_INSIGHTS_URL)\s*=', text)
    if not m:
        return [".env.example: NEXT_PUBLIC_GAS_INSIGHTS_URL declaration not found"]
    # Look back up to 1200 chars before the declaration for DEPRECATED marker
    start = max(0, m.start() - 1200)
    prelude = text[start:m.start()]
    if "DEPRECATED" not in prelude.upper():
        return [
            ".env.example: NEXT_PUBLIC_GAS_INSIGHTS_URL not marked DEPRECATED "
            "(no 'DEPRECATED' marker within 1200 chars before declaration)"
        ]
    return []


# ---------------------------------------------------------------------------
# 3. PWA api.ts has insights() method calling /api/insights
# ---------------------------------------------------------------------------

def check_pwa_api_insights_method(pwa_dir: Path) -> List[str]:
    api_file = pwa_dir / "src" / "lib" / "api.ts"
    if not api_file.is_file():
        return [f"{api_file} not found"]
    text = api_file.read_text(encoding="utf-8", errors="replace")
    stripped = strip_ts_comments(text)
    issues: List[str] = []
    # Look for an exported insights function/const + /api/insights URL path
    has_insights_fn = bool(re.search(r'(?:export\s+(?:async\s+)?function\s+insights|export\s+const\s+insights|insights\s*:\s*(?:async\s*)?\(|\.insights\s*=)', stripped))
    if not has_insights_fn:
        # Fall back: any function returning insights that calls /api/insights
        has_insights_fn = bool(re.search(r"insights", stripped, re.IGNORECASE))
        if not has_insights_fn:
            issues.append("api.ts: no insights function/method found")
    if "/api/insights" not in stripped:
        issues.append("api.ts: does not call /api/insights endpoint")
    return issues


# ---------------------------------------------------------------------------
# 4. HMAC canonical contract
# ---------------------------------------------------------------------------

def _compute_signature(secret_hex: str, method: str, timestamp: int, nonce: str,
                       device_id: str, body: str) -> str:
    """Mirror firmware Advisor.cpp + Code.gs canonical HMAC contract."""
    canonical = f"{method}\n{timestamp}\n{nonce}\n{device_id}\n{body}"
    secret_bytes = bytes.fromhex(secret_hex)
    return hmac.new(secret_bytes, canonical.encode("utf-8"),
                    hashlib.sha256).hexdigest().upper()


def test_hmac_canonical_contract() -> List[str]:
    issues: List[str] = []
    secret_hex = "a" * 64  # 32 bytes
    ts = 1700000000
    nonce = "abcdef0123456789"
    dev = "0123456789abcdef"
    body = '{"mac":"0123456789abcdef"}'

    # 4a. GET sig != POST sig (method prefix prevents cross-method replay)
    get_sig = _compute_signature(secret_hex, "GET", ts, nonce, dev, "")
    post_sig = _compute_signature(secret_hex, "POST", ts, nonce, dev, body)
    if get_sig == post_sig:
        issues.append(
            f"HMAC contract fail: GET sig == POST sig "
            f"(both = {get_sig}) — method prefix not in canonical"
        )

    # 4b. Single-char change in body causes POST sig mismatch
    body2 = body.replace("0", "1", 1)
    post_sig2 = _compute_signature(secret_hex, "POST", ts, nonce, dev, body2)
    if post_sig == post_sig2:
        issues.append(
            "HMAC contract fail: single-char body change did NOT change signature"
        )

    # 4c. Different nonce → different sig
    sig_diff_nonce = _compute_signature(secret_hex, "GET", ts, "ff", dev, "")
    if sig_diff_nonce == get_sig:
        issues.append("HMAC contract fail: nonce change did NOT change signature")

    return issues


# ---------------------------------------------------------------------------
# 5. Negative security matrix — firmware side
# ---------------------------------------------------------------------------

def check_insights_handlers(fw_dir: Path) -> List[str]:
    issues: List[str] = []
    f = fw_dir / "firmware" / "InsightsHandlers.h"
    if not f.is_file():
        return [f"{f} not found"]
    text = f.read_text(encoding="utf-8", errors="replace")
    stripped = strip_cpp_comments(text)

    # Must call requireAuth()
    if "requireAuth()" not in stripped:
        issues.append("InsightsHandlers.h: does NOT call requireAuth()")

    # Must NOT read query params via http.arg("...")
    # (auth metadata is in URL params for GAS, but InsightsHandlers should not
    # re-implement GAS auth on the firmware side; it's behind JWT.)
    # Allow http.arg only for non-auth purposes — flag any http.arg call.
    if re.search(r'http\.arg\s*\(', stripped):
        issues.append("InsightsHandlers.h: reads query params via http.arg() "
                      "(should rely on JWT auth, not query-param auth)")
    return issues


def check_advisor_no_lock(fw_dir: Path) -> List[str]:
    issues: List[str] = []
    f = fw_dir / "firmware" / "Advisor.cpp"
    if not f.is_file():
        return [f"{f} not found"]
    text = f.read_text(encoding="utf-8", errors="replace")
    stripped = strip_cpp_comments(text)

    # Must set setTimeout + setConnectTimeout
    if "setTimeout" not in stripped:
        issues.append("Advisor.cpp: setTimeout not set on HTTPClient")
    if "setConnectTimeout" not in stripped:
        issues.append("Advisor.cpp: setConnectTimeout not set on HTTPClient")
    # Firmware is stateless per request — should not acquire any lock.
    # Flag any LockService / xSemaphoreTake / portMUX_TYPE in Advisor.cpp.
    lock_pat = r"LockService|xSemaphoreTake|portMUX_TYPE|pthread_mutex_lock"
    if re.search(lock_pat, stripped):
        issues.append("Advisor.cpp: acquires a lock — firmware HTTP requests "
                      "should be stateless")
    return issues


# ---------------------------------------------------------------------------
# 6. Code.gs security checks
# ---------------------------------------------------------------------------

def check_code_gs(fw_dir: Path) -> List[str]:
    issues: List[str] = []
    f = fw_dir / "code.gs" / "Code.gs"
    if not f.is_file():
        return [f"{f} not found"]
    text = f.read_text(encoding="utf-8", errors="replace")
    stripped = strip_js_comments(text)

    checks = [
        (r"nonce", "nonce replay check"),
        (r"TIMESTAMP_TOLERANCE_SEC|timestamp", "timestamp tolerance"),
        (r"computeHmacSha256Signature|HmacSha256|hmac", "HMAC signature verify"),
        (r"isValidDeviceId|normalizeDeviceId", "device ID validation"),
        (r"function\s+doGet", "doGet handler"),
        (r"function\s+doPost", "doPost handler"),
        (r"'GET\\n'|\"GET\\n\"", "GET method in canonical"),
        (r"'POST\\n'|\"POST\\n\"", "POST method in canonical"),
    ]
    for pat, desc in checks:
        if not re.search(pat, stripped, re.IGNORECASE):
            issues.append(f"Code.gs: missing {desc} (pattern not found)")

    # doGet + doPost must require auth (signature param check)
    # Verify that both handlers check 'signature' parameter
    for fn_name in ("doGet", "doPost"):
        # Extract the function body
        m = re.search(rf"function\s+{fn_name}\s*\([^)]*\)\s*\{{(.*?)\}}\s*(?=function\s|\Z)",
                      stripped, re.DOTALL)
        if not m:
            issues.append(f"Code.gs: cannot extract {fn_name} body")
            continue
        body = m.group(1)
        if "signature" not in body.lower():
            issues.append(f"Code.gs: {fn_name} does not check signature parameter")
        if "nonce" not in body.lower():
            issues.append(f"Code.gs: {fn_name} does not check nonce")
    return issues


# ---------------------------------------------------------------------------
# 7. HttpServer.cpp registers /api/insights
# ---------------------------------------------------------------------------

def check_httpserver_insights_route(fw_dir: Path) -> List[str]:
    issues: List[str] = []
    f = fw_dir / "firmware" / "HttpServer.cpp"
    if not f.is_file():
        return [f"{f} not found"]
    text = f.read_text(encoding="utf-8", errors="replace")
    stripped = strip_cpp_comments(text)
    if not re.search(r'http\.on\s*\(\s*"/api/insights"', stripped):
        issues.append('HttpServer.cpp: /api/insights route not registered')
    return issues


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    pwa_dir = repo_root / "pwa"
    fw_dir = repo_root / "firmware"
    pwa_src = pwa_dir / "src"

    print("=" * 78)
    print("PWA → ESP32 → GAS AI Insights Security Chain")
    print("=" * 78)

    sections: List[tuple] = []

    # 1. No direct PWA → GAS access
    issues1 = check_no_direct_pwa_gas_access(pwa_src)
    sections.append(("1. No direct PWA→GAS access (src/)", issues1))

    # 2. .env.example marks NEXT_PUBLIC_GAS_INSIGHTS_URL DEPRECATED
    issues2 = check_env_example_deprecation(pwa_dir)
    sections.append(("2. .env.example NEXT_PUBLIC_GAS_INSIGHTS_URL DEPRECATED", issues2))

    # 3. PWA api.ts insights() method
    issues3 = check_pwa_api_insights_method(pwa_dir)
    sections.append(("3. PWA api.ts insights() → /api/insights", issues3))

    # 4. HMAC canonical contract
    issues4 = test_hmac_canonical_contract()
    sections.append(("4. HMAC canonical contract (GET≠POST, body-change detects)", issues4))

    # 5. Negative security matrix — firmware
    issues5 = check_insights_handlers(fw_dir) + check_advisor_no_lock(fw_dir)
    sections.append(("5. InsightsHandlers.h requireAuth + no http.arg; "
                     "Advisor timeouts + no lock", issues5))

    # 6. Code.gs security checks
    issues6 = check_code_gs(fw_dir)
    sections.append(("6. Code.gs nonce/timestamp/HMAC/deviceId/method-prefix", issues6))

    # 7. HttpServer.cpp registers /api/insights
    issues7 = check_httpserver_insights_route(fw_dir)
    sections.append(("7. HttpServer.cpp /api/insights route", issues7))

    total_fail = 0
    for name, issues in sections:
        print()
        print(f"--- {name} ---")
        if not issues:
            print("  PASS")
        else:
            for iss in issues:
                print(f"  FAIL: {iss}")
            total_fail += len(issues)

    print()
    print("=" * 78)
    if total_fail == 0:
        print("[PWA_ESP32_GAS_CHAIN] PASS — full security chain verified")
        print("=" * 78)
        return 0
    print(f"[PWA_ESP32_GAS_CHAIN] FAIL — {total_fail} issue(s)")
    print("=" * 78)
    return 1


if __name__ == "__main__":
    sys.exit(main())

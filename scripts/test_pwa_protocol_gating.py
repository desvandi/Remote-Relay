#!/usr/bin/env python3
"""
test_pwa_protocol_gating.py — Tests PWA stale-cache / protocol gating contract.

Reimplements compatibility.ts:evaluateCompatibility in Python (post-hardening).

PWA_EXPECTED = { pwaVersion: "4.3.8", firmwareMin: "4.3.0", firmwareMax: None,
                 protocolVersion: 5, configSchemaVersion: 2 }

Tests (6 total):
  1. PWA v1 (protocol v4) + Firmware v2 (protocol v5) → BLOCKED
  2. PWA v2 (protocol v5) + Firmware v2 (protocol v5) → ALLOWED
  3. Firmware 4.2.0 (too old) → BLOCKED (status=firmware_too_old)
  4. Firmware unreachable (null version) → BLOCKED (status=unknown)
  5. Config schema mismatch (3 vs 2) → BLOCKED (status=config_schema_mismatch)
  6. Boundary: Firmware 4.3.0 (== min) → ALLOWED; Firmware 4.2.9 (< min) → BLOCKED

Exit 0 on PASS, 1 on FAIL.
"""
from __future__ import annotations

import re
import sys
from typing import Optional, Tuple


# ---------------------------------------------------------------------------
# Constants — post-hardening PWA expected contract
# ---------------------------------------------------------------------------

PWA_EXPECTED = {
    "pwaVersion": "4.3.8",
    "firmwareMin": "4.3.0",
    "firmwareMax": None,
    "protocolVersion": 5,
    "configSchemaVersion": 2,
}


# ---------------------------------------------------------------------------
# Semver compare (very small, sufficient for X.Y.Z)
# ---------------------------------------------------------------------------

def parse_semver(v: str) -> Optional[Tuple[int, int, int]]:
    if not v or not isinstance(v, str):
        return None
    m = re.match(r"^\s*v?(\d+)\.(\d+)\.(\d+)", v.strip())
    if not m:
        return None
    return tuple(int(x) for x in m.groups())


def semver_ge(a: Optional[Tuple[int, int, int]],
              b: Optional[Tuple[int, int, int]]) -> bool:
    if a is None or b is None:
        return False
    return a >= b


def semver_lt(a: Optional[Tuple[int, int, int]],
              b: Optional[Tuple[int, int, int]]) -> bool:
    if a is None or b is None:
        return False
    return a < b


# ---------------------------------------------------------------------------
# evaluateCompatibility (mirrors post-hardening compatibility.ts)
# ---------------------------------------------------------------------------

STATUS_ALLOWED = "allowed"
STATUS_BLOCKED = "blocked"


def evaluate_compatibility(pwa_expected: dict, *,
                           pwa_version: str,
                           firmware_version: Optional[str],
                           protocol_version: Optional[int],
                           config_schema_version: Optional[int]
                           ) -> Tuple[str, str]:
    """Return (status, reason).

    status ∈ {"allowed", "blocked"}.
    reason is one of: "ok", "pwa_too_old", "firmware_too_old", "firmware_too_new",
                      "protocol_mismatch", "config_schema_mismatch", "unknown".
    """
    # 1. PWA version check (must match expected PWA version)
    if pwa_version != pwa_expected["pwaVersion"]:
        # If PWA is older than expected (e.g., browser cached older PWA), block.
        # If PWA is newer, also block — PWA_EXPECTED is the source of truth.
        return (STATUS_BLOCKED, "pwa_too_old")

    # 2. Protocol version match
    if protocol_version is None or protocol_version != pwa_expected["protocolVersion"]:
        return (STATUS_BLOCKED, "protocol_mismatch")

    # 3. Firmware unreachable → unknown
    if firmware_version is None or not firmware_version:
        return (STATUS_BLOCKED, "unknown")

    # 4. Firmware version range
    fw_v = parse_semver(firmware_version)
    fw_min = parse_semver(pwa_expected["firmwareMin"])
    fw_max = parse_semver(pwa_expected["firmwareMax"]) if pwa_expected["firmwareMax"] else None

    if fw_v is None:
        return (STATUS_BLOCKED, "unknown")

    if fw_min and semver_lt(fw_v, fw_min):
        return (STATUS_BLOCKED, "firmware_too_old")

    if fw_max and fw_v > fw_max:
        return (STATUS_BLOCKED, "firmware_too_new")

    # 5. Config schema version match
    if config_schema_version is None or config_schema_version != pwa_expected["configSchemaVersion"]:
        return (STATUS_BLOCKED, "config_schema_mismatch")

    return (STATUS_ALLOWED, "ok")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_1_pwa_v1_protocol_v4_blocked() -> Tuple[bool, str]:
    # Override PWA_EXPECTED to simulate an older PWA (protocol v4, version 4.2.0)
    pwa_expected_v1 = {
        "pwaVersion": "4.2.0",
        "firmwareMin": "4.3.0",
        "firmwareMax": None,
        "protocolVersion": 4,
        "configSchemaVersion": 2,
    }
    status, reason = evaluate_compatibility(
        pwa_expected_v1,
        pwa_version="4.2.0",
        firmware_version="4.3.8",
        protocol_version=5,
        config_schema_version=2,
    )
    # The PWA itself says protocol v4, but firmware speaks protocol v5
    # → protocol_mismatch (BLOCKED)
    if status != STATUS_BLOCKED:
        return False, f"expected BLOCKED, got {status} ({reason})"
    return True, f"PWA v1 (protocol v4) + Firmware v2 (protocol v5) → BLOCKED ({reason})"


def test_2_pwa_v2_protocol_v5_allowed() -> Tuple[bool, str]:
    status, reason = evaluate_compatibility(
        PWA_EXPECTED,
        pwa_version="4.3.8",
        firmware_version="4.3.8",
        protocol_version=5,
        config_schema_version=2,
    )
    if status != STATUS_ALLOWED:
        return False, f"expected ALLOWED, got {status} ({reason})"
    return True, f"PWA v2 + Firmware v2 (both protocol v5) → ALLOWED ({reason})"


def test_3_firmware_too_old() -> Tuple[bool, str]:
    status, reason = evaluate_compatibility(
        PWA_EXPECTED,
        pwa_version="4.3.8",
        firmware_version="4.2.0",
        protocol_version=5,
        config_schema_version=2,
    )
    if status != STATUS_BLOCKED or reason != "firmware_too_old":
        return False, f"expected BLOCKED/firmware_too_old, got {status}/{reason}"
    return True, "Firmware 4.2.0 (too old) → BLOCKED (firmware_too_old)"


def test_4_firmware_unreachable() -> Tuple[bool, str]:
    status, reason = evaluate_compatibility(
        PWA_EXPECTED,
        pwa_version="4.3.8",
        firmware_version=None,
        protocol_version=5,
        config_schema_version=2,
    )
    if status != STATUS_BLOCKED or reason != "unknown":
        return False, f"expected BLOCKED/unknown, got {status}/{reason}"
    return True, "Firmware unreachable (null version) → BLOCKED (unknown)"


def test_5_config_schema_mismatch() -> Tuple[bool, str]:
    status, reason = evaluate_compatibility(
        PWA_EXPECTED,
        pwa_version="4.3.8",
        firmware_version="4.3.8",
        protocol_version=5,
        config_schema_version=3,
    )
    if status != STATUS_BLOCKED or reason != "config_schema_mismatch":
        return False, f"expected BLOCKED/config_schema_mismatch, got {status}/{reason}"
    return True, "Config schema mismatch (3 vs 2) → BLOCKED (config_schema_mismatch)"


def test_6_boundary() -> Tuple[bool, str]:
    # Boundary: 4.3.0 (== min) → ALLOWED
    s1, _ = evaluate_compatibility(
        PWA_EXPECTED,
        pwa_version="4.3.8",
        firmware_version="4.3.0",
        protocol_version=5,
        config_schema_version=2,
    )
    if s1 != STATUS_ALLOWED:
        return False, f"4.3.0 (== min) should be ALLOWED, got {s1}"
    # Boundary: 4.2.9 (< min) → BLOCKED
    s2, _ = evaluate_compatibility(
        PWA_EXPECTED,
        pwa_version="4.3.8",
        firmware_version="4.2.9",
        protocol_version=5,
        config_schema_version=2,
    )
    if s2 != STATUS_BLOCKED:
        return False, f"4.2.9 (< min) should be BLOCKED, got {s2}"
    return True, "Boundary: 4.3.0 (== min) ALLOWED; 4.2.9 (< min) BLOCKED"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    print("=" * 78)
    print("PWA Protocol Gating — Stale Cache / Compatibility Contract")
    print("=" * 78)

    tests = [
        ("1. PWA v1 (protocol v4) + Firmware v2 (protocol v5) → BLOCKED",
         test_1_pwa_v1_protocol_v4_blocked),
        ("2. PWA v2 + Firmware v2 (both protocol v5) → ALLOWED",
         test_2_pwa_v2_protocol_v5_allowed),
        ("3. Firmware 4.2.0 (too old) → BLOCKED (firmware_too_old)",
         test_3_firmware_too_old),
        ("4. Firmware unreachable (null) → BLOCKED (unknown)",
         test_4_firmware_unreachable),
        ("5. Config schema mismatch (3 vs 2) → BLOCKED",
         test_5_config_schema_mismatch),
        ("6. Boundary: 4.3.0 (== min) ALLOWED; 4.2.9 (< min) BLOCKED",
         test_6_boundary),
    ]

    passed = 0
    failed = 0
    for name, fn in tests:
        try:
            ok, msg = fn()
        except Exception as e:
            ok, msg = False, f"EXCEPTION: {e!r}"
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"\n  [{status}] {name}")
        print(f"           {msg}")

    print()
    print("=" * 78)
    print(f"Results: {passed}/{len(tests)} passed")
    print("=" * 78)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

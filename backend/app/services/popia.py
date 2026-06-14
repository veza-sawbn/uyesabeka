"""POPIA helpers: SA ID numbers are personal information and must be masked in
any export. Signature images are biometric data served only via signed URLs.
"""

from __future__ import annotations


def mask_id_number(id_number: str | None) -> str:
    """Mask the birth-day digits of a 13-digit SA ID for exports.

    9204125086082 -> 9204**5086082
    """
    if not id_number:
        return ""
    digits = id_number.strip()
    if len(digits) != 13:
        # Unknown shape: mask the middle third defensively.
        third = max(1, len(digits) // 3)
        return digits[:third] + "*" * (len(digits) - 2 * third) + digits[-third:]
    return f"{digits[:4]}**{digits[6:]}"

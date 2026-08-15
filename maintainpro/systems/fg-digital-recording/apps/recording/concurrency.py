"""Phase 08C — draft concurrency and save-mode helpers.

Optimistic concurrency: clients send expected draft_version.
Mismatches raise DraftConcurrencyConflict — never silent last-write-wins.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError

DRAFT_CONFLICT_CODE = "draft_concurrency_conflict"

SAVE_MODE_MANUAL = "manual"
SAVE_MODE_AUTOSAVE = "autosave"


class DraftConcurrencyConflict(ValidationError):
    """Raised when expected_draft_version does not match the server token."""

    def __init__(self, *, current_version: int, expected_version: int | None) -> None:
        self.current_version = current_version
        self.expected_version = expected_version
        super().__init__(
            {
                "draft_version": ValidationError(
                    (
                        "This draft was updated elsewhere (or in another tab). "
                        f"Server version is {current_version}; "
                        f"your editor had {expected_version}. "
                        "Reload the draft and re-apply your changes. "
                        "No silent last-write-wins."
                    ),
                    code=DRAFT_CONFLICT_CODE,
                )
            }
        )


def assert_expected_draft_version(
    *,
    record_version: int,
    expected_draft_version: int | None,
) -> None:
    """
    Enforce optimistic concurrency when the client supplies a version.

    ``expected_draft_version is None`` is allowed only for legacy callers;
    UI and autosave always send an explicit version.
    """
    if expected_draft_version is None:
        return
    if int(expected_draft_version) != int(record_version):
        raise DraftConcurrencyConflict(
            current_version=int(record_version),
            expected_version=int(expected_draft_version),
        )


def next_draft_version(current: int) -> int:
    return int(current) + 1

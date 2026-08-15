"""Role-aware landing counts — existing selectors only; no invented KPIs."""

from __future__ import annotations

from typing import Any

from django.urls import reverse

from apps.notifications.selectors import notifications_for_recipient
from apps.quality.selectors import actor_can_access_qa_module, list_qa_reviewable_submissions
from apps.recording.selectors import (
    actor_can_access_recording_module,
    list_recordable_checklist_tasks,
)
from apps.reviews.selectors import (
    actor_can_access_review_module,
    list_supervisor_reviewable_submissions,
)
from apps.scheduling.selectors import (
    actor_can_view_checklist_tasks,
    list_my_checklist_tasks,
    list_overdue_checklist_tasks,
)


def landing_dashboard_cards(actor: Any) -> list[dict[str, Any]]:
    """Return only cards that can be computed from authorized selectors."""
    cards: list[dict[str, Any]] = []
    if actor_can_view_checklist_tasks(actor):
        cards.append(
            {
                "label": "My tasks",
                "value": list_my_checklist_tasks(actor).count(),
                "href": reverse("scheduling:task_list"),
                "hint": "Assigned to you",
            }
        )
        cards.append(
            {
                "label": "Overdue",
                "value": list_overdue_checklist_tasks(actor).count(),
                "href": f"{reverse('scheduling:task_list')}?due=OVERDUE",
                "hint": "Display state only — not an NCR",
            }
        )
    if actor_can_access_recording_module(actor):
        cards.append(
            {
                "label": "Recordable tasks",
                "value": list_recordable_checklist_tasks(actor).count(),
                "href": reverse("recording:task_list"),
                "hint": "Ready for recording",
            }
        )
    if actor_can_access_review_module(actor):
        cards.append(
            {
                "label": "Awaiting Supervisor",
                "value": list_supervisor_reviewable_submissions(actor).count(),
                "href": reverse("reviews:queue"),
                "hint": "Submitted, not yet reviewed",
            }
        )
    if actor_can_access_qa_module(actor):
        cards.append(
            {
                "label": "Awaiting QA",
                "value": list_qa_reviewable_submissions(actor).count(),
                "href": reverse("quality:queue"),
                "hint": "Supervisor approved, no QA disposition",
            }
        )
    cards.append(
        {
            "label": "Unread notifications",
            "value": notifications_for_recipient(recipient=actor, unread_only=True).count(),
            "href": f"{reverse('notifications:list')}?unread=1",
            "hint": "In-app only",
        }
    )
    return cards

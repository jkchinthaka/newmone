"""JSON API for the Next.js FG presentation layer — wraps existing services."""

from __future__ import annotations

import json
from datetime import date

import pytest
from django.test import Client
from django.urls import reverse

from apps.checklists.models import ChecklistItem, ChecklistResponseType
from apps.quality.models import QAReviewDecision
from apps.recording.controlled_form_seed import seed_controlled_form_templates
from apps.recording.services import save_checklist_draft_responses, submit_checklist_record
from apps.recording.synthetic_demo import SyntheticDemoDataset, load_synthetic_demo_data
from apps.reviews.models import SupervisorReviewDecision
from apps.scheduling.services import ensure_controlled_daily_task


def _json(response):
    return json.loads(response.content.decode("utf-8"))


def _submit_cleaning(demo: SyntheticDemoDataset, record_date: date):
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    task = ensure_controlled_daily_task(
        actor=demo.recorder,
        organization_id=demo.organization.id,
        form_code="NMS/PPU/CL/24",
        record_date=record_date,
    )
    from apps.recording.services import start_checklist_recording

    record = start_checklist_recording(actor=demo.recorder, task_id=task.id)
    items = ChecklistItem.objects.filter(section__version=task.checklist_version)
    answers = {}
    for item in items:
        if item.response_type == ChecklistResponseType.YES_NO:
            answers[(item.id, 1)] = "YES"
        elif item.code == "CORR":
            answers[(item.id, 1)] = "DEMO correction note"
    save_checklist_draft_responses(actor=demo.recorder, record_id=record.id, answers=answers)
    return submit_checklist_record(actor=demo.recorder, record_id=record.id)


@pytest.mark.django_db
def test_dashboard_requires_authentication(client: Client) -> None:
    response = client.get(reverse("fg_api:dashboard"))
    assert response.status_code == 401
    body = _json(response)
    assert body["error"]["code"] == "UNAUTHENTICATED"
    assert "traceback" not in response.content.decode("utf-8").lower()


@pytest.mark.django_db
def test_dashboard_returns_source_form_codes_and_real_kpis(client: Client) -> None:
    demo = load_synthetic_demo_data()
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    client.force_login(demo.recorder)
    response = client.get(reverse("fg_api:dashboard"), {"date": "2026-08-11"})
    assert response.status_code == 200
    body = _json(response)
    assert body["error"] is None
    codes = {row["code"] for row in body["data"]["forms"]}
    assert codes == {"NMS/PPU/CL/24", "NMS/PPU/CL/18", "NMS/PPU/CL/30", "NMS/PPU/CL/39"}
    kpis = body["data"]["kpis"]
    assert set(kpis) == {
        "todayRecords",
        "draftInProgress",
        "pendingSupervisor",
        "pendingQa",
        "completed",
        "needsAttention",
    }
    assert all(isinstance(value, int) for value in kpis.values())
    cl18 = next(row for row in body["data"]["forms"] if row["code"] == "NMS/PPU/CL/18")
    cl24 = next(row for row in body["data"]["forms"] if row["code"] == "NMS/PPU/CL/24")
    cl30 = next(row for row in body["data"]["forms"] if row["code"] == "NMS/PPU/CL/30")
    assert cl18["multiplicity"] == "independent_occurrence"
    assert cl24["multiplicity"] == "one_per_day"
    assert cl30["multiplicity"] == "independent_occurrence"
    assert cl18["statusLabel"] == "NOT STARTED"


@pytest.mark.django_db
def test_open_cl24_is_idempotent_per_day(client: Client) -> None:
    demo = load_synthetic_demo_data()
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    client.force_login(demo.recorder)
    first = client.post(
        reverse("fg_api:record_open"),
        data=json.dumps({"formCode": "NMS/PPU/CL/24", "date": "2026-08-11"}),
        content_type="application/json",
    )
    again = client.post(
        reverse("fg_api:record_open"),
        data=json.dumps({"formCode": "NMS/PPU/CL/24", "date": "2026-08-11"}),
        content_type="application/json",
    )
    assert first.status_code == 200
    assert again.status_code == 200
    assert _json(first)["data"]["record"]["id"] == _json(again)["data"]["record"]["id"]


@pytest.mark.django_db
def test_open_cl18_and_cl30_use_occurrence_tokens(client: Client) -> None:
    demo = load_synthetic_demo_data()
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    client.force_login(demo.recorder)
    for code in ("NMS/PPU/CL/18", "NMS/PPU/CL/30"):
        missing = client.post(
            reverse("fg_api:record_open"),
            data=json.dumps({"formCode": code, "date": "2026-08-11"}),
            content_type="application/json",
        )
        assert missing.status_code == 400
        first = client.post(
            reverse("fg_api:record_open"),
            data=json.dumps({"formCode": code, "date": "2026-08-11", "occurrenceToken": "stable-token-1"}),
            content_type="application/json",
        )
        retry = client.post(
            reverse("fg_api:record_open"),
            data=json.dumps({"formCode": code, "date": "2026-08-11", "occurrenceToken": "stable-token-1"}),
            content_type="application/json",
        )
        second = client.post(
            reverse("fg_api:record_open"),
            data=json.dumps({"formCode": code, "date": "2026-08-11", "occurrenceToken": "stable-token-2"}),
            content_type="application/json",
        )
        assert first.status_code == 200
        assert retry.status_code == 200
        assert second.status_code == 200
        first_id = _json(first)["data"]["record"]["id"]
        assert first_id == _json(retry)["data"]["record"]["id"]
        assert first_id != _json(second)["data"]["record"]["id"]


@pytest.mark.django_db
def test_unknown_form_and_invalid_record_id_rejected(client: Client) -> None:
    demo = load_synthetic_demo_data()
    client.force_login(demo.recorder)
    unknown = client.post(
        reverse("fg_api:record_open"),
        data=json.dumps({"formCode": "NMS/PPU/CL/99", "date": "2026-08-11"}),
        content_type="application/json",
    )
    assert unknown.status_code == 404
    missing = client.get(
        reverse("fg_api:record_detail", kwargs={"record_id": "00000000-0000-0000-0000-000000000001"})
    )
    assert missing.status_code == 404


@pytest.mark.django_db
def test_submitted_record_is_immutable_via_json_save(client: Client) -> None:
    demo = load_synthetic_demo_data()
    submission = _submit_cleaning(demo, date(2026, 8, 11))
    client.force_login(demo.recorder)
    saved = client.post(
        reverse("fg_api:record_save", kwargs={"record_id": submission.checklist_record_id}),
        data=json.dumps({"expectedDraftVersion": 1, "fields": {}}),
        content_type="application/json",
    )
    assert saved.status_code == 409
    assert _json(saved)["error"]["code"] == "IMMUTABLE"


@pytest.mark.django_db
def test_supervisor_and_qa_json_workflow_and_sod_surface(client: Client) -> None:
    demo = load_synthetic_demo_data()
    submission = _submit_cleaning(demo, date(2026, 8, 12))
    client.force_login(demo.recorder)
    self_review = client.get(reverse("fg_api:review_detail", kwargs={"submission_id": submission.id}))
    assert self_review.status_code in {200, 403}
    client.force_login(demo.supervisor)
    detail = client.get(reverse("fg_api:review_detail", kwargs={"submission_id": submission.id}))
    assert detail.status_code == 200
    decided = client.post(
        reverse("fg_api:review_decision", kwargs={"submission_id": submission.id}),
        data=json.dumps(
            {
                "decision": SupervisorReviewDecision.APPROVED,
                "reviewNote": "DEMO supervisor approve",
                "idempotencyKey": "json-sup-1",
            }
        ),
        content_type="application/json",
    )
    assert decided.status_code == 200
    duplicate = client.post(
        reverse("fg_api:review_decision", kwargs={"submission_id": submission.id}),
        data=json.dumps(
            {
                "decision": SupervisorReviewDecision.APPROVED,
                "reviewNote": "retry",
                "idempotencyKey": "json-sup-1",
            }
        ),
        content_type="application/json",
    )
    assert duplicate.status_code in {200, 409}
    client.force_login(demo.qa)
    qa = client.post(
        reverse("fg_api:qa_decision", kwargs={"submission_id": submission.id}),
        data=json.dumps(
            {
                "decision": QAReviewDecision.RELEASE,
                "reviewNote": "DEMO qa release",
                "idempotencyKey": "json-qa-1",
            }
        ),
        content_type="application/json",
    )
    assert qa.status_code == 200
    assert _json(qa)["data"]["decision"] == QAReviewDecision.RELEASE


@pytest.mark.django_db
def test_history_is_paginated_and_form_filtered(client: Client) -> None:
    demo = load_synthetic_demo_data()
    _submit_cleaning(demo, date(2026, 8, 11))
    client.force_login(demo.recorder)
    response = client.get(reverse("fg_api:history"), {"formCode": "NMS/PPU/CL/24", "page": "1"})
    assert response.status_code == 200
    body = _json(response)
    assert body["meta"]["pageSize"] == 25
    assert all(row["formCode"] == "NMS/PPU/CL/24" for row in body["data"]["records"])

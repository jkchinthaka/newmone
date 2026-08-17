"""Map Django ScopedRoleAssignment permission codenames → MaintainPro fg.* keys."""

from __future__ import annotations

# Defense-in-depth: service-layer require_permission also enforces MaintainPro keys
# for projected principals. View decorators apply more granular create/edit/submit splits.
DJANGO_PERMISSION_TO_FG: dict[str, str] = {
    # Recording
    "scheduling.record_checklisttask": "fg.recording.edit",
    "scheduling.view_checklisttask": "fg.recording.view",
    # Reviews
    "reviews.review_checklistsubmission": "fg.review.perform",
    "reviews.view_checklistsubmission": "fg.review.view",
    # QA
    "quality.qa_review_checklistsubmission": "fg.qa.disposition",
    "quality.view_qareview": "fg.qa.view",
    # Nonconformance
    "nonconformance.create_nonconformance": "fg.nonconformance.manage",
    "nonconformance.manage_nonconformance": "fg.nonconformance.manage",
    "nonconformance.close_nonconformance": "fg.nonconformance.manage",
    "nonconformance.view_nonconformance": "fg.nonconformance.view",
    # CAPA
    "capa.create_capa": "fg.capa.manage",
    "capa.manage_capa": "fg.capa.manage",
    "capa.close_capa": "fg.capa.manage",
    "capa.view_capa": "fg.capa.view",
    # Laboratory
    "laboratory.register_labsample": "fg.laboratory.manage",
    "laboratory.enter_labresult": "fg.laboratory.manage",
    "laboratory.verify_labresult": "fg.laboratory.manage",
    "laboratory.finalize_labresult": "fg.laboratory.manage",
    "laboratory.manage_laboratory": "fg.laboratory.manage",
    "laboratory.view_labsample": "fg.laboratory.view",
    # HACCP
    "haccp.manage_haccpplan": "fg.haccp.manage",
    "haccp.approve_haccpplan": "fg.haccp.manage",
    "haccp.view_haccp": "fg.haccp.view",
    # Dispatch
    "dispatch.create_dispatchqualityrecord": "fg.dispatch.manage",
    "dispatch.manage_dispatchqualityrecord": "fg.dispatch.manage",
    "dispatch.complete_dispatchqualityrecord": "fg.dispatch.manage",
    "dispatch.view_dispatchqualityrecord": "fg.dispatch.view",
    # Complaints
    "customer_complaints.create_customercomplaint": "fg.complaints.manage",
    "customer_complaints.manage_customercomplaint": "fg.complaints.manage",
    "customer_complaints.close_customercomplaint": "fg.complaints.manage",
    "customer_complaints.view_customercomplaint": "fg.complaints.view",
    # Reports
    "reports.view_reportcatalogue": "fg.reports.view",
    "reports.run_qualityreport": "fg.reports.view",
    "reports.export_qualityreport": "fg.reports.export",
}


def fg_permission_for_django(permission: str) -> str | None:
    key = (permission or "").strip()
    if not key:
        return None
    if key in DJANGO_PERMISSION_TO_FG:
        return DJANGO_PERMISSION_TO_FG[key]
    # Fuzzy fallbacks by app label
    app = key.split(".", 1)[0] if "." in key else ""
    fallback = {
        "scheduling": "fg.recording.edit",
        "recording": "fg.recording.edit",
        "reviews": "fg.review.perform",
        "quality": "fg.qa.disposition",
        "nonconformance": "fg.nonconformance.manage",
        "capa": "fg.capa.manage",
        "laboratory": "fg.laboratory.manage",
        "haccp": "fg.haccp.manage",
        "dispatch": "fg.dispatch.manage",
        "customer_complaints": "fg.complaints.manage",
        "reports": "fg.reports.view",
        "access_control": "fg.admin",
    }.get(app)
    return fallback

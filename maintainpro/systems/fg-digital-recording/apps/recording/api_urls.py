from django.urls import path

from apps.recording import api_views

app_name = "fg_api"

urlpatterns = [
    path("session", api_views.api_session, name="session"),
    path("dashboard", api_views.api_dashboard, name="dashboard"),
    path("records/open", api_views.api_record_open, name="record_open"),
    path("records/<uuid:record_id>", api_views.api_record_detail, name="record_detail"),
    path("records/<uuid:record_id>/save", api_views.api_record_save, name="record_save"),
    path("records/<uuid:record_id>/submit", api_views.api_record_submit, name="record_submit"),
    path("history", api_views.api_history, name="history"),
    path("reviews", api_views.api_review_queue, name="review_queue"),
    path("reviews/<uuid:submission_id>", api_views.api_review_detail, name="review_detail"),
    path(
        "reviews/<uuid:submission_id>/decision",
        api_views.api_review_decision,
        name="review_decision",
    ),
    path("qa", api_views.api_qa_queue, name="qa_queue"),
    path("qa/<uuid:submission_id>", api_views.api_qa_detail, name="qa_detail"),
    path("qa/<uuid:submission_id>/decision", api_views.api_qa_decision, name="qa_decision"),
    path("vehicles", api_views.api_vehicles, name="vehicles"),
]

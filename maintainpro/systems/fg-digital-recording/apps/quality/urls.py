from django.urls import path

from apps.quality import views

app_name = "quality"

urlpatterns = [
    path("quality/", views.qa_queue, name="queue"),
    path(
        "quality/submissions/<uuid:submission_id>/",
        views.submission_detail,
        name="submission_detail",
    ),
    path(
        "quality/submissions/<uuid:submission_id>/<str:decision>/confirm/",
        views.confirm_decision,
        name="confirm_decision",
    ),
    path(
        "quality/reviews/<uuid:review_id>/",
        views.qa_result,
        name="qa_result",
    ),
]

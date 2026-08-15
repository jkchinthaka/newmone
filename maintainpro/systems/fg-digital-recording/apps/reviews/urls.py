from django.urls import path

from apps.reviews import views

app_name = "reviews"

urlpatterns = [
    path("reviews/", views.review_queue, name="queue"),
    path(
        "reviews/submissions/<uuid:submission_id>/",
        views.submission_detail,
        name="submission_detail",
    ),
    path(
        "reviews/submissions/<uuid:submission_id>/<str:decision>/confirm/",
        views.confirm_decision,
        name="confirm_decision",
    ),
    path(
        "reviews/<uuid:review_id>/",
        views.review_result,
        name="review_result",
    ),
]

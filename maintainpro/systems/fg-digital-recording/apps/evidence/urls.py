from django.urls import path

from apps.evidence import views

app_name = "evidence"

urlpatterns = [
    path(
        "evidence/<str:linked_kind>/<uuid:linked_object_id>/",
        views.evidence_list_for_link,
        name="list_for_link",
    ),
    path(
        "evidence/<str:linked_kind>/<uuid:linked_object_id>/upload/",
        views.evidence_upload,
        name="upload",
    ),
    path(
        "evidence/attachments/<uuid:attachment_id>/download/",
        views.evidence_download,
        name="download",
    ),
    path(
        "evidence/attachments/<uuid:attachment_id>/retire/",
        views.evidence_retire,
        name="retire",
    ),
]

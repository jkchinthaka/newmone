from django.urls import path

from apps.quality_quarantine import views

app_name = "quarantine"

urlpatterns = [
    path("quarantine/", views.quarantine_list, name="list"),
    path("quarantine/new/", views.quarantine_create, name="create"),
    path("quarantine/<uuid:quarantine_id>/", views.quarantine_detail, name="detail"),
]

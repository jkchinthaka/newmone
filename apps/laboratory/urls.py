from django.urls import path

from apps.laboratory import views

app_name = "laboratory"

urlpatterns = [
    path("laboratory/", views.lab_sample_list, name="list"),
    path("laboratory/<uuid:sample_id>/", views.lab_sample_detail, name="detail"),
]

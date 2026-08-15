from django.urls import path

from apps.nonconformance import views

app_name = "nonconformance"

urlpatterns = [
    path("ncr/", views.ncr_list, name="list"),
    path("ncr/new/", views.ncr_create, name="create"),
    path("ncr/<uuid:ncr_id>/", views.ncr_detail, name="detail"),
    path("ncr/<uuid:ncr_id>/update/", views.ncr_update, name="update"),
    path("ncr/<uuid:ncr_id>/transition/", views.ncr_transition, name="transition"),
    path("ncr/<uuid:ncr_id>/close/", views.ncr_close, name="close"),
]

"""URL routes for MaintainPro reference autocomplete."""

from __future__ import annotations

from django.urls import path

from apps.integrations.maintainpro import views

app_name = "maintainpro_refs"

urlpatterns = [
    path("vehicles/search/", views.vehicle_search, name="vehicle-search"),
    path("assets/search/", views.asset_search, name="asset-search"),
    path("departments/search/", views.department_search, name="department-search"),
    path("facilities/search/", views.facility_search, name="facility-search"),
]

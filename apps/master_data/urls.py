"""Master data URL routes."""

from __future__ import annotations

from django.urls import path

from apps.master_data import views

app_name = "master_data"

urlpatterns = [
    path("products/", views.product_list, name="product_list"),
    path("products/new/", views.product_create, name="product_create"),
    path("products/<uuid:product_id>/", views.product_detail, name="product_detail"),
    path("products/<uuid:product_id>/edit/", views.product_edit, name="product_edit"),
    path(
        "products/<uuid:product_id>/activate/",
        views.product_activate,
        name="product_activate",
    ),
    path(
        "products/<uuid:product_id>/deactivate/",
        views.product_deactivate,
        name="product_deactivate",
    ),
]

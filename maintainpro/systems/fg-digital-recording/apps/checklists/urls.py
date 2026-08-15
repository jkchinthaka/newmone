"""Checklist definition URL routes."""

from __future__ import annotations

from django.urls import path

from apps.checklists import views

app_name = "checklists"

urlpatterns = [
    path("checklists/", views.template_list, name="template_list"),
    path("checklists/new/", views.template_create, name="template_create"),
    path("checklists/<uuid:template_id>/", views.template_detail, name="template_detail"),
    path("checklists/<uuid:template_id>/edit/", views.template_edit, name="template_edit"),
    path(
        "checklists/<uuid:template_id>/activate/",
        views.template_activate,
        name="template_activate",
    ),
    path(
        "checklists/<uuid:template_id>/deactivate/",
        views.template_deactivate,
        name="template_deactivate",
    ),
    path(
        "checklists/<uuid:template_id>/versions/new/",
        views.version_create,
        name="version_create",
    ),
    path("checklists/versions/<uuid:version_id>/", views.version_detail, name="version_detail"),
    path(
        "checklists/versions/<uuid:version_id>/publish/",
        views.version_publish,
        name="version_publish",
    ),
    path(
        "checklists/versions/<uuid:version_id>/retire/",
        views.version_retire,
        name="version_retire",
    ),
    path(
        "checklists/versions/<uuid:version_id>/sections/add/",
        views.section_add,
        name="section_add",
    ),
    path("checklists/sections/<uuid:section_id>/edit/", views.section_edit, name="section_edit"),
    path(
        "checklists/sections/<uuid:section_id>/delete/",
        views.section_delete,
        name="section_delete",
    ),
    path("checklists/sections/<uuid:section_id>/move/", views.section_move, name="section_move"),
    path("checklists/sections/<uuid:section_id>/items/add/", views.item_add, name="item_add"),
    path("checklists/items/<uuid:item_id>/edit/", views.item_edit, name="item_edit"),
    path("checklists/items/<uuid:item_id>/delete/", views.item_delete, name="item_delete"),
    path("checklists/items/<uuid:item_id>/move/", views.item_move, name="item_move"),
    path(
        "checklists/items/<uuid:item_id>/options/add/",
        views.option_add,
        name="option_add",
    ),
    path("checklists/options/<uuid:option_id>/edit/", views.option_edit, name="option_edit"),
    path(
        "checklists/options/<uuid:option_id>/delete/",
        views.option_delete,
        name="option_delete",
    ),
    path("checklists/options/<uuid:option_id>/move/", views.option_move, name="option_move"),
]

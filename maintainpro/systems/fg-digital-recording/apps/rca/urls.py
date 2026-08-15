from django.urls import path

from apps.rca import views

app_name = "rca"

urlpatterns = [
    path("rca/", views.rca_list, name="list"),
    path("rca/new/", views.rca_create, name="create"),
    path("rca/<uuid:rca_id>/", views.rca_detail, name="detail"),
    path("rca/<uuid:rca_id>/start/", views.rca_start, name="start"),
    path("rca/<uuid:rca_id>/participants/", views.rca_add_participant, name="add_participant"),
    path("rca/<uuid:rca_id>/five-why/", views.rca_add_five_why, name="add_five_why"),
    path("rca/<uuid:rca_id>/fishbone/", views.rca_add_fishbone, name="add_fishbone"),
    path("rca/<uuid:rca_id>/causes/", views.rca_add_cause, name="add_cause"),
    path("rca/<uuid:rca_id>/evidence/", views.rca_add_evidence, name="add_evidence"),
    path("rca/<uuid:rca_id>/verify/", views.rca_verify, name="verify"),
    path("rca/<uuid:rca_id>/close/", views.rca_close, name="close"),
    path("rca/<uuid:rca_id>/cancel/", views.rca_cancel, name="cancel"),
    path("rca/causes/<uuid:cause_id>/support/", views.rca_support_cause, name="support_cause"),
    path("rca/causes/<uuid:cause_id>/confirm/", views.rca_confirm_cause, name="confirm_cause"),
    path("rca/causes/<uuid:cause_id>/capa/", views.rca_link_capa, name="link_capa"),
]

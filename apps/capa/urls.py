from django.urls import path

from apps.capa import views

app_name = "capa"

urlpatterns = [
    path("capa/", views.capa_list, name="list"),
    path("capa/new/", views.capa_create, name="create"),
    path("capa/<uuid:capa_id>/", views.capa_detail, name="detail"),
    path("capa/<uuid:capa_id>/transition/", views.capa_transition, name="transition"),
    path("capa/<uuid:capa_id>/items/", views.capa_add_item, name="add_item"),
    path("capa/<uuid:capa_id>/verify/", views.capa_verify, name="verify"),
    path("capa/<uuid:capa_id>/effectiveness/", views.capa_effectiveness, name="effectiveness"),
    path("capa/<uuid:capa_id>/close/", views.capa_close, name="close"),
]

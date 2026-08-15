from django.urls import path

from apps.haccp import views

app_name = "haccp"

urlpatterns = [
    path("haccp/", views.haccp_plan_list, name="list"),
    path("haccp/<uuid:plan_id>/", views.haccp_plan_detail, name="detail"),
]

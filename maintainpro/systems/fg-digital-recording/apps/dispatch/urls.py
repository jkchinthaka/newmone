from django.urls import path

from apps.dispatch import views

app_name = "dispatch"

urlpatterns = [
    path("dispatch/", views.dispatch_list, name="list"),
    path("dispatch/new/", views.dispatch_create, name="create"),
    path("dispatch/<uuid:record_id>/", views.dispatch_detail, name="detail"),
]

from django.urls import path

from apps.customer_complaints import views

app_name = "complaints"

urlpatterns = [
    path("complaints/", views.complaint_list, name="list"),
    path("complaints/new/", views.complaint_create, name="create"),
    path("complaints/<uuid:case_id>/", views.complaint_detail, name="detail"),
]

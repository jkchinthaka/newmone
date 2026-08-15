from django.urls import path

from apps.scheduling import views

app_name = "scheduling"

urlpatterns = [
    path("scheduling/tasks/", views.task_list, name="task_list"),
    path("scheduling/tasks/create/", views.task_create, name="task_create"),
    path(
        "scheduling/tasks/options/templates/",
        views.task_template_options,
        name="task_template_options",
    ),
    path(
        "scheduling/tasks/options/versions/",
        views.task_version_options,
        name="task_version_options",
    ),
    path("scheduling/tasks/<uuid:task_id>/", views.task_detail, name="task_detail"),
    path(
        "scheduling/tasks/<uuid:task_id>/cancel/",
        views.task_cancel,
        name="task_cancel",
    ),
    path(
        "scheduling/applicability/preview/",
        views.applicability_preview,
        name="applicability_preview",
    ),
]

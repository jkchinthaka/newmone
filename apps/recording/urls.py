from django.urls import path

from apps.recording import daily_views, views

app_name = "recording"

urlpatterns = [
    path("daily-records/", daily_views.daily_records_home, name="daily_home"),
    path("daily-records/history/", daily_views.daily_record_history, name="daily_history"),
    path(
        "daily-records/history/export.csv",
        daily_views.daily_record_export_csv,
        name="daily_export_csv",
    ),
    path(
        "daily-records/<path:form_code>/open/",
        daily_views.daily_record_open,
        name="daily_open",
    ),
    path(
        "daily-records/print/monthly/",
        daily_views.daily_monthly_print,
        name="daily_monthly_print",
    ),
    path(
        "daily-records/print/<uuid:record_id>/",
        daily_views.daily_record_print,
        name="daily_print",
    ),
    path("recording/", views.recordable_task_list, name="task_list"),
    path(
        "recording/tasks/<uuid:task_id>/start/",
        views.start_recording,
        name="start_recording",
    ),
    path(
        "recording/<uuid:record_id>/",
        views.record_detail,
        name="record_detail",
    ),
    path(
        "recording/<uuid:record_id>/autosave/",
        views.record_autosave,
        name="record_autosave",
    ),
    path(
        "recording/<uuid:record_id>/submit/",
        views.submit_confirm,
        name="submit_confirm",
    ),
    path(
        "recording/<uuid:record_id>/submitted/",
        views.record_submitted,
        name="record_submitted",
    ),
    path(
        "recording/<uuid:record_id>/history/",
        views.record_history,
        name="record_history",
    ),
    path(
        "recording/submissions/<uuid:submission_id>/returned/",
        views.returned_submission_detail,
        name="returned_submission",
    ),
    path(
        "recording/submissions/<uuid:submission_id>/correct/",
        views.start_correction,
        name="start_correction",
    ),
    path(
        "recording/corrections/<uuid:correction_id>/",
        views.correction_detail,
        name="correction_detail",
    ),
    path(
        "recording/corrections/<uuid:correction_id>/resubmit/",
        views.correction_resubmit_confirm,
        name="correction_resubmit",
    ),
    path(
        "recording/corrections/<uuid:correction_id>/result/",
        views.correction_result,
        name="correction_result",
    ),
]

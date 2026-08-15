"""Root URL configuration."""

from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("apps.accounts.urls")),
    path("integrations/maintainpro/", include("apps.integrations.maintainpro.urls")),
    path("", include("apps.organizations.urls")),
    path("", include("apps.master_data.urls")),
    path("", include("apps.checklists.urls")),
    path("", include("apps.scheduling.urls")),
    path("", include("apps.recording.urls")),
    path("", include("apps.reviews.urls")),
    path("", include("apps.quality.urls")),
    path("", include("apps.rca.urls")),
    path("", include("apps.nonconformance.urls")),
    path("", include("apps.capa.urls")),
    path("", include("apps.laboratory.urls")),
    path("", include("apps.haccp.urls")),
    path("", include("apps.dispatch.urls")),
    path("", include("apps.customer_complaints.urls")),
    path("", include("apps.quality_quarantine.urls")),
    path("", include("apps.evidence.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.reports.urls")),
    path("", include("apps.core.urls")),
]

handler400 = "apps.core.views.bad_request"
handler403 = "apps.core.views.permission_denied"
handler404 = "apps.core.views.page_not_found"
handler500 = "apps.core.views.server_error"

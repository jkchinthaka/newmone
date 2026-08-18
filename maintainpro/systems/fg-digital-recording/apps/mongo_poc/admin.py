"""Read-only admin class definitions for Mongo POC models.

Registration into django.contrib.admin is intentionally deferred: stock
``auth.User`` uses AutoField, which Django MongoDB Backend rejects.
Treat live AdminSite wiring as PASS_WITH_REFACTOR (custom user / ObjectId PK).
"""

from django.contrib import admin

from apps.mongo_poc.models import (
    PocOrganization,
    PocQAReview,
    PocRecord,
    PocSubmission,
    PocSupervisorReview,
    PocTask,
)


class PocOrganizationAdmin(admin.ModelAdmin):
    list_display = ("code",)
    readonly_fields = ("code",)

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


class PocTaskAdmin(admin.ModelAdmin):
    list_display = ("batch_reference", "organization", "template")
    readonly_fields = ("organization", "template", "batch_reference")

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


class PocRecordAdmin(admin.ModelAdmin):
    list_display = ("status", "task", "organization")
    readonly_fields = ("task", "organization", "status")

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


class PocSubmissionAdmin(admin.ModelAdmin):
    list_display = ("submission_number", "record", "is_immutable", "payload_marker")
    readonly_fields = (
        "record",
        "organization",
        "submission_number",
        "is_immutable",
        "payload_marker",
    )

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


class PocSupervisorReviewAdmin(admin.ModelAdmin):
    list_display = ("decision", "submission")
    readonly_fields = ("submission", "decision")

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


class PocQAReviewAdmin(admin.ModelAdmin):
    list_display = ("decision", "submission", "supervisor_review")
    readonly_fields = ("submission", "supervisor_review", "decision")

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


# Keep symbols referenced for documentation / future AdminSite wiring.
POC_ADMIN_CLASSES = (
    (PocOrganization, PocOrganizationAdmin),
    (PocTask, PocTaskAdmin),
    (PocRecord, PocRecordAdmin),
    (PocSubmission, PocSubmissionAdmin),
    (PocSupervisorReview, PocSupervisorReviewAdmin),
    (PocQAReview, PocQAReviewAdmin),
)

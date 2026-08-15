"""Minimal mirror models for MongoDB integrity/concurrency POC.

These are intentionally simplified stand-ins for production invariants.
They are NOT production schema and MUST NOT be used as the application SoR.
"""

from __future__ import annotations

from django.db import models
from django.db.models import UniqueConstraint
from django_mongodb_backend.fields import ObjectIdAutoField


class PocOrganization(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    code = models.CharField(max_length=64)

    class Meta:
        constraints = [
            UniqueConstraint(fields=["code"], name="mongo_poc_org_code_uniq"),
        ]


class PocEmployee(models.Model):
    """Employee-code uniqueness via normalized stored code (PG uses Lower())."""

    id = ObjectIdAutoField(primary_key=True)
    organization = models.ForeignKey(
        PocOrganization, on_delete=models.PROTECT, related_name="employees"
    )
    employee_code_normalized = models.CharField(max_length=64)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["organization", "employee_code_normalized"],
                name="mongo_poc_employee_code_uniq",
            ),
        ]


class PocChecklistTemplate(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    organization = models.ForeignKey(
        PocOrganization, on_delete=models.PROTECT, related_name="templates"
    )
    key = models.CharField(max_length=64)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["organization", "key"],
                name="mongo_poc_template_key_uniq",
            ),
        ]


class PocChecklistVersion(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    template = models.ForeignKey(
        PocChecklistTemplate, on_delete=models.PROTECT, related_name="versions"
    )
    version_number = models.PositiveIntegerField()

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["template", "version_number"],
                name="mongo_poc_version_number_uniq",
            ),
        ]


class PocTask(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    organization = models.ForeignKey(
        PocOrganization, on_delete=models.PROTECT, related_name="tasks"
    )
    template = models.ForeignKey(
        PocChecklistTemplate, on_delete=models.PROTECT, related_name="tasks"
    )
    batch_reference = models.CharField(max_length=128)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["organization", "template", "batch_reference"],
                name="mongo_poc_task_batch_uniq",
            ),
        ]


class PocRecord(models.Model):
    """One record per task (OneToOne semantics via unique task_id)."""

    id = ObjectIdAutoField(primary_key=True)
    task = models.OneToOneField(PocTask, on_delete=models.PROTECT, related_name="record")
    organization = models.ForeignKey(
        PocOrganization, on_delete=models.PROTECT, related_name="records"
    )
    status = models.CharField(max_length=32, default="draft")


class PocSubmission(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    record = models.ForeignKey(PocRecord, on_delete=models.PROTECT, related_name="submissions")
    organization = models.ForeignKey(
        PocOrganization, on_delete=models.PROTECT, related_name="submissions"
    )
    submission_number = models.PositiveIntegerField()
    is_immutable = models.BooleanField(default=True)
    payload_marker = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["record", "submission_number"],
                name="mongo_poc_submission_number_uniq",
            ),
        ]


class PocResponseSnapshot(models.Model):
    """Child snapshot rows — Option A multi-document style."""

    id = ObjectIdAutoField(primary_key=True)
    submission = models.ForeignKey(
        PocSubmission, on_delete=models.PROTECT, related_name="responses"
    )
    item_key = models.CharField(max_length=64)
    sample_index = models.PositiveIntegerField(default=0)
    value_text = models.CharField(max_length=256, blank=True, default="")
    calculation_context = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["submission", "item_key", "sample_index"],
                name="mongo_poc_response_sample_uniq",
            ),
        ]


class PocSupervisorReview(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    submission = models.OneToOneField(
        PocSubmission, on_delete=models.PROTECT, related_name="supervisor_review"
    )
    decision = models.CharField(max_length=32)


class PocCorrection(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    source_submission = models.OneToOneField(
        PocSubmission, on_delete=models.PROTECT, related_name="correction"
    )
    record = models.ForeignKey(PocRecord, on_delete=models.PROTECT, related_name="corrections")
    status = models.CharField(max_length=32, default="open")


class PocQAReview(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    submission = models.OneToOneField(
        PocSubmission, on_delete=models.PROTECT, related_name="qa_review"
    )
    supervisor_review = models.OneToOneField(
        PocSupervisorReview, on_delete=models.PROTECT, related_name="qa_review"
    )
    decision = models.CharField(max_length=32)


class PocIdempotencyKey(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    scope = models.CharField(max_length=64)
    key = models.CharField(max_length=128)
    result_ref = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["scope", "key"],
                name="mongo_poc_idempotency_uniq",
            ),
        ]

# Phase 09C — Supervisor review governance policy (self-review + optional SLA).

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0003_phase04c_organization_configuration"),
        ("reviews", "0001_phase09a_supervisor_review"),
    ]

    operations = [
        migrations.CreateModel(
            name="SupervisorReviewGovernancePolicy",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "self_review_mode",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending owner decision (not enforced)"),
                            ("PROHIBIT", "Self-review prohibited (owner-approved)"),
                            ("ALLOW", "Self-review allowed (owner-approved)"),
                        ],
                        default="PENDING",
                        help_text="PENDING = SoD open (not enforced). PROHIBIT/ALLOW require evidence_reference.",
                        max_length=16,
                    ),
                ),
                (
                    "review_sla_minutes",
                    models.PositiveIntegerField(
                        blank=True,
                        help_text=(
                            "Optional configured minutes after submission before review is overdue. "
                            "Null = no SLA (EVIDENCE REQUIRED — never invent timing)."
                        ),
                        null=True,
                    ),
                ),
                (
                    "evidence_reference",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Required when self_review_mode is PROHIBIT or ALLOW (APR evidence id/ref).",
                        max_length=255,
                    ),
                ),
                (
                    "notes",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="Governance notes only — not operational limits or invented titles.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="supervisor_review_governance_policy",
                        to="organizations.organization",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="updated_supervisor_review_governance_policies",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Supervisor review governance policy",
                "verbose_name_plural": "Supervisor review governance policies",
            },
        ),
        migrations.AddIndex(
            model_name="supervisorreviewgovernancepolicy",
            index=models.Index(fields=["self_review_mode"], name="rev_gov_self_mode_idx"),
        ),
    ]

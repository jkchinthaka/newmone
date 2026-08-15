import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("organizations", "0003_phase04c_organization_configuration"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AIAssistanceRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "use_case",
                    models.CharField(
                        choices=[
                            ("SUMMARIZE_BATCH_HISTORY", "SUMMARIZE_BATCH_HISTORY"),
                            ("SUMMARIZE_NCR_CAPA", "SUMMARIZE_NCR_CAPA"),
                            ("EXPLAIN_REPORT_METRICS", "EXPLAIN_REPORT_METRICS"),
                            ("ASSIST_SEARCH", "ASSIST_SEARCH"),
                            ("TREND_NARRATION", "TREND_NARRATION"),
                        ],
                        max_length=64,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("SUCCEEDED", "Succeeded"),
                            ("FAILED", "Failed"),
                            ("BLOCKED", "Blocked"),
                            ("DISABLED", "Disabled"),
                            ("FALLBACK", "Safe fallback"),
                        ],
                        default="SUCCEEDED",
                        max_length=16,
                    ),
                ),
                ("provider_name", models.CharField(blank=True, default="", max_length=32)),
                ("correlation_id", models.CharField(blank=True, default="", max_length=64)),
                ("source_ids", models.JSONField(blank=True, default=list)),
                ("reason_code", models.CharField(blank=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="ai_assistance_requests",
                        to="organizations.organization",
                    ),
                ),
                (
                    "requested_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="ai_assistance_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "AI assistance request",
                "verbose_name_plural": "AI assistance requests",
                "ordering": ("-created_at",),
                "permissions": [
                    ("use_aiassistance", "Can use optional quality AI assistance"),
                    ("view_aiassistanceaudit", "Can view AI assistance usage audit"),
                ],
            },
        ),
        migrations.AddIndex(
            model_name="aiassistancerequest",
            index=models.Index(fields=["organization", "use_case", "created_at"], name="ai_assist_org_uc_at_idx"),
        ),
        migrations.AddIndex(
            model_name="aiassistancerequest",
            index=models.Index(fields=["organization", "status"], name="ai_assist_org_status_idx"),
        ),
    ]

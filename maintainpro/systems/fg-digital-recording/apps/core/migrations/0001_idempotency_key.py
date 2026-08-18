# Generated for IdempotencyKey (Mongo + PostgreSQL compatible).

import django.db.models.deletion
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("organizations", "0001_phase03_accounts_rbac"),
    ]

    operations = [
        migrations.CreateModel(
            name="IdempotencyKey",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("scope", models.CharField(max_length=64)),
                ("key", models.CharField(max_length=191)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending"),
                            ("COMPLETED", "Completed"),
                            ("FAILED", "Failed"),
                        ],
                        default="PENDING",
                        max_length=16,
                    ),
                ),
                ("result_reference", models.CharField(blank=True, default="", max_length=64)),
                ("result_payload", models.JSONField(blank=True, default=dict)),
                ("error_code", models.CharField(blank=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="idempotency_keys",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "verbose_name": "Idempotency key",
                "verbose_name_plural": "Idempotency keys",
            },
        ),
        migrations.AddIndex(
            model_name="idempotencykey",
            index=models.Index(
                fields=["organization", "scope", "status"],
                name="core_idem_org_scope_st_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="idempotencykey",
            index=models.Index(fields=["created_at"], name="core_idem_created_idx"),
        ),
        migrations.AddConstraint(
            model_name="idempotencykey",
            constraint=models.UniqueConstraint(
                fields=("organization", "scope", "key"),
                name="core_idempotency_org_scope_key_uniq",
            ),
        ),
    ]

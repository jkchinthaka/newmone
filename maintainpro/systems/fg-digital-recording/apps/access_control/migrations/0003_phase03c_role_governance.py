# Generated manually for Phase 03C Role Governance - empty RoleTemplate catalogue (no seed).

import django.db.models.functions.text
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("access_control", "0002_nulls_not_distinct_assignment_uniq"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoleTemplate",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("code", models.CharField(max_length=64)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                (
                    "business_status",
                    models.CharField(
                        choices=[
                            ("PROPOSED", "Proposed"),
                            ("PENDING_OWNER_APPROVAL", "Pending owner approval"),
                            ("OWNER_APPROVED", "Owner approved"),
                        ],
                        default="PROPOSED",
                        help_text=(
                            "OWNER_APPROVED requires documented APR evidence - never invent. "
                            "PROPOSED and PENDING_OWNER_APPROVAL are not company authority."
                        ),
                        max_length=32,
                    ),
                ),
                (
                    "evidence_reference",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text=(
                            "Required when business_status=OWNER_APPROVED via governance services. "
                            "APR / controlled-document pointer only."
                        ),
                        max_length=512,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "permissions",
                    models.ManyToManyField(
                        blank=True,
                        related_name="access_role_templates",
                        to="auth.permission",
                    ),
                ),
            ],
            options={
                "ordering": ("code",),
            },
        ),
        migrations.AddIndex(
            model_name="roletemplate",
            index=models.Index(fields=["is_active"], name="ac_role_tmpl_active_idx"),
        ),
        migrations.AddIndex(
            model_name="roletemplate",
            index=models.Index(
                django.db.models.functions.text.Lower("code"),
                name="ac_role_tmpl_code_lower_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="roletemplate",
            index=models.Index(fields=["business_status"], name="ac_role_tmpl_biz_idx"),
        ),
        migrations.AddConstraint(
            model_name="roletemplate",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower("code"),
                name="ac_role_template_code_ci_uniq",
            ),
        ),
    ]
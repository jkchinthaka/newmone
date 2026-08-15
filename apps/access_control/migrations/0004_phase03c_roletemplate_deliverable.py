# Phase 03C: align RoleTemplate to business_category_hint (deliverable).
#
# Uses portable schema operations (PostgreSQL + MongoDB). Earlier revisions used
# PostgreSQL-only RunSQL with IF EXISTS; that is incompatible with
# django-mongodb-backend.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0003_phase03c_role_governance"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="roletemplate",
            name="ac_role_tmpl_biz_idx",
        ),
        migrations.RemoveField(
            model_name="roletemplate",
            name="business_status",
        ),
        migrations.RemoveField(
            model_name="roletemplate",
            name="evidence_reference",
        ),
        migrations.AddField(
            model_name="roletemplate",
            name="business_category_hint",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Documentation hint only. Not business approval.",
                max_length=128,
            ),
        ),
    ]

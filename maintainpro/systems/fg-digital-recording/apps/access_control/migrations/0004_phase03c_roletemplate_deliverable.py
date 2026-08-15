# Phase 03C: align RoleTemplate to business_category_hint (deliverable).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0003_phase03c_role_governance"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "DROP INDEX IF EXISTS ac_role_tmpl_biz_idx;",
                "ALTER TABLE access_control_roletemplate DROP COLUMN IF EXISTS business_status;",
                "ALTER TABLE access_control_roletemplate DROP COLUMN IF EXISTS evidence_reference;",
                "ALTER TABLE access_control_roletemplate "
                "ADD COLUMN IF NOT EXISTS business_category_hint "
                "varchar(128) DEFAULT '' NOT NULL;",
            ],
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[
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
            ],
        ),
    ]

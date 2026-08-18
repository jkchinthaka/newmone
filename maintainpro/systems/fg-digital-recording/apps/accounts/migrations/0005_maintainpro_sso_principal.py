# Generated manually for MaintainPro SSO principal projection fields.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_employee_code_normalized_field_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="maintainpro_user_id",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Immutable MaintainPro User ObjectId. Empty for legacy local-only accounts.",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="maintainpro_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="user",
            name="maintainpro_synced_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                condition=~models.Q(maintainpro_user_id=""),
                fields=("maintainpro_user_id",),
                name="acct_user_mp_id_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["maintainpro_user_id"], name="acct_user_mp_id_idx"),
        ),
    ]

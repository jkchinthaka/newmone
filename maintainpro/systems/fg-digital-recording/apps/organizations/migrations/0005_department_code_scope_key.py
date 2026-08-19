from django.db import migrations, models


def backfill_department_scope_keys(apps, schema_editor):
    Department = apps.get_model("organizations", "Department")
    for dept in Department.objects.all().iterator():
        if dept.site_id:
            key = f"site:{dept.site_id}"
        else:
            key = f"org:{dept.organization_id}"
        if dept.code_scope_key != key:
            dept.code_scope_key = key
            dept.save(update_fields=["code_scope_key"])


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0004_maintainpro_tenant_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="code_scope_key",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddConstraint(
            model_name="department",
            constraint=models.UniqueConstraint(
                fields=("code_scope_key", "code"),
                name="org_dept_scope_key_code_uniq",
            ),
        ),
        migrations.RunPython(backfill_department_scope_keys, migrations.RunPython.noop),
    ]

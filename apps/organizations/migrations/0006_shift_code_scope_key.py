from django.db import migrations, models


def backfill_shift_scope_keys(apps, schema_editor):
    Shift = apps.get_model("organizations", "Shift")
    for shift in Shift.objects.all().iterator():
        org = shift.organization_id or ""
        site = shift.site_id or "-"
        dept = shift.department_id or "-"
        key = f"org:{org}|site:{site}|dept:{dept}"
        if shift.code_scope_key != key:
            shift.code_scope_key = key
            shift.save(update_fields=["code_scope_key"])


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0005_department_code_scope_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="shift",
            name="code_scope_key",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddConstraint(
            model_name="shift",
            constraint=models.UniqueConstraint(
                fields=("code_scope_key", "code"),
                name="org_shift_scope_key_code_uniq",
            ),
        ),
        migrations.RunPython(backfill_shift_scope_keys, migrations.RunPython.noop),
    ]

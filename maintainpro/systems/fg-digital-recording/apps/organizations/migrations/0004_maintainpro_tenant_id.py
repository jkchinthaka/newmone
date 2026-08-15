from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0003_phase04c_organization_configuration"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="maintainpro_tenant_id",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "MaintainPro Tenant _id (ObjectId hex). "
                    "Required for shared reference lookups."
                ),
                max_length=24,
            ),
        ),
    ]

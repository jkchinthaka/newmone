# Generated manually for MaintainPro vehicle reference fields on dispatch.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("dispatch", "0001_phase13_dispatch_quality_foundation"),
    ]

    operations = [
        migrations.AddField(
            model_name="dispatchqualityrecord",
            name="maintainpro_vehicle_id",
            field=models.CharField(blank=True, default="", max_length=24),
        ),
        migrations.AddField(
            model_name="dispatchqualityrecord",
            name="vehicle_registration_snapshot",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="dispatchqualityrecord",
            name="vehicle_make_snapshot",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="dispatchqualityrecord",
            name="vehicle_model_snapshot",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="dispatchqualityrecord",
            name="reference_verification_status",
            field=models.CharField(
                blank=True,
                default="",
                help_text="VERIFIED | PENDING | empty when no vehicle linked.",
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name="dispatchqualityrecord",
            index=models.Index(
                fields=["organization", "maintainpro_vehicle_id"],
                name="dispatch_org_mp_vehicle_idx",
            ),
        ),
    ]

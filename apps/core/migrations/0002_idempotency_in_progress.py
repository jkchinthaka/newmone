# Add IN_PROGRESS status for concurrent claim of idempotency keys.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_idempotency_key"),
    ]

    operations = [
        migrations.AlterField(
            model_name="idempotencykey",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("IN_PROGRESS", "In progress"),
                    ("COMPLETED", "Completed"),
                    ("FAILED", "Failed"),
                ],
                default="PENDING",
                max_length=16,
            ),
        ),
    ]

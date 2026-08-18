"""Enforce active assignment uniqueness with PostgreSQL NULLS NOT DISTINCT."""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("access_control", "0001_phase03_accounts_rbac"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="scopedroleassignment",
            name="ac_active_assignment_uniq",
        ),
        migrations.AddConstraint(
            model_name="scopedroleassignment",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_active", True)),
                fields=("user", "role", "organization", "site", "department"),
                name="ac_active_assignment_uniq",
                nulls_distinct=False,
            ),
        ),
    ]

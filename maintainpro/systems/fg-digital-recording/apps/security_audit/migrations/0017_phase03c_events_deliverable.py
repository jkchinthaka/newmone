# Phase 03C deliverable audit event names.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("security_audit", "0016_phase04c_organization_configuration"),
    ]

    operations = [
        migrations.AlterField(
            model_name="securityauditevent",
            name="event_type",
            field=models.CharField(choices=[('LOGIN_SUCCESS', 'Login success'), ('LOGIN_FAILURE', 'Login failure'), ('ACCOUNT_LOCKED', 'Account locked'), ('ACCOUNT_UNLOCKED', 'Account unlocked'), ('LOGOUT', 'Logout'), ('PASSWORD_CHANGED', 'Password changed'), ('PASSWORD_RESET_BY_ADMIN', 'Password reset by admin'), ('USER_ACTIVATED', 'User activated'), ('USER_DEACTIVATED', 'User deactivated'), ('ROLE_ASSIGNED', 'Role assigned'), ('ROLE_REVOKED', 'Role revoked'), ('ROLE_PERMISSIONS_UPDATED', 'Role permissions updated'), ('ROLE_TEMPLATE_CREATED', 'Role template created'), ('ROLE_TEMPLATE_UPDATED', 'Role template updated'), ('ROLE_TEMPLATE_APPLIED', 'Role template applied to role'), ('SHIFT_CREATED', 'Shift created'), ('SHIFT_UPDATED', 'Shift updated'), ('SHIFT_ACTIVATED', 'Shift activated'), ('SHIFT_DEACTIVATED', 'Shift deactivated'), ('ORGANIZATION_CREATED', 'Organization created'), ('ORGANIZATION_UPDATED', 'Organization updated'), ('ORGANIZATION_ACTIVATED', 'Organization activated'), ('ORGANIZATION_DEACTIVATED', 'Organization deactivated'), ('SITE_CREATED', 'Site created'), ('SITE_UPDATED', 'Site updated'), ('SITE_ACTIVATED', 'Site activated'), ('SITE_DEACTIVATED', 'Site deactivated'), ('DEPARTMENT_CREATED', 'Department created'), ('DEPARTMENT_UPDATED', 'Department updated'), ('DEPARTMENT_ACTIVATED', 'Department activated'), ('DEPARTMENT_DEACTIVATED', 'Department deactivated'), ('FG_PRODUCT_CREATED', 'FG Product created'), ('FG_PRODUCT_UPDATED', 'FG Product updated'), ('FG_PRODUCT_ACTIVATED', 'FG Product activated'), ('FG_PRODUCT_DEACTIVATED', 'FG Product deactivated'), ('CHECKLIST_TEMPLATE_CREATED', 'Checklist template created'), ('CHECKLIST_TEMPLATE_UPDATED', 'Checklist template updated'), ('CHECKLIST_VERSION_CREATED', 'Checklist version created'), ('CHECKLIST_VERSION_CLONED', 'Checklist version cloned'), ('CHECKLIST_VERSION_PUBLISHED', 'Checklist version published'), ('CHECKLIST_VERSION_RETIRED', 'Checklist version retired'), ('CHECKLIST_TASK_CREATED', 'Checklist task created'), ('CHECKLIST_TASK_CANCELLED', 'Checklist task cancelled'), ('CHECKLIST_RECORD_STARTED', 'Checklist record started'), ('NONCONFORMANCE_CREATED', 'Nonconformance created'), ('NONCONFORMANCE_CLOSED', 'Nonconformance closed'), ('CAPA_CREATED', 'CAPA created'), ('CAPA_CLOSED', 'CAPA closed')], max_length=64),
        ),
    ]

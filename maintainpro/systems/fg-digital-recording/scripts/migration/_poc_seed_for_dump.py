import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.mongo_same_db_poc")
django.setup()

from django.conf import settings

from apps.accounts.models import User
from apps.accounts.services import create_application_user
from apps.organizations.models import Organization
from apps.organizations.services import create_organization

assert settings.MONGODB_DATABASE == "fg_same_db_poc"
assert settings.MONGODB_DATABASE != "mgintginpro_prod"

org = Organization.objects.filter(code="POCSEED1").first()
if org is None:
    org = create_organization(code="POCSEED1", name="POC Seed Org")

user = User.objects.filter(employee_code="POCSEED01").first()
if user is None:
    user = create_application_user(
        employee_code="POCSEED01",
        password="Complex-Test-Pass-123!",
        is_staff=True,
    )

print("seeded", org.code, user.employee_code, "db", settings.MONGODB_DATABASE)
print("user_count", User.objects.count())

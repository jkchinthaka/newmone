"""Concurrent MaintainPro principal projection — exactly one survivor."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test import TransactionTestCase, override_settings

from apps.accounts.sso import FgSsoClaims, project_maintainpro_principal
from apps.core.persistence import is_mongodb
from apps.security_audit.models import SecurityAuditEvent

User = get_user_model()

SSO_SETTINGS = {
    "FG_SSO_SIGNING_SECRET": "test-only-fg-sso-signing-secret-min-32-chars!!",
}


def _claims(sub: str) -> FgSsoClaims:
    return FgSsoClaims(
        sub=sub,
        email=f"{sub}@example.com",
        first_name="Concurrent",
        last_name="User",
        tenant_id="tenant-1",
        role="ADMIN",
        permissions=("fg.access", "fg.recording.view"),
        jti=str(uuid.uuid4()),
        exp=2_000_000_000,
        iss="maintainpro",
        aud="fg-digital-recording",
    )


@override_settings(**SSO_SETTINGS)
class ConcurrentProjectionPostgresTests(TransactionTestCase):
    """Uses TransactionTestCase so each thread gets a usable DB connection."""

    def setUp(self) -> None:
        cache.clear()

    def test_concurrent_first_projection_single_principal(self) -> None:
        mp_id = uuid.uuid4().hex[:24]
        claims = _claims(mp_id)

        def worker(_: int) -> str:
            # Close inherited connection; Django opens a fresh one per thread.
            connection.close()
            user = project_maintainpro_principal(claims)
            assert user.maintainpro_user_id == mp_id
            assert user.has_usable_password() is False
            return str(user.pk)

        pks: list[str] = []
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(worker, i) for i in range(8)]
            for fut in as_completed(futures):
                pks.append(fut.result())

        self.assertEqual(len(set(pks)), 1)
        self.assertEqual(User.objects.filter(maintainpro_user_id=mp_id).count(), 1)
        principal = User.objects.get(maintainpro_user_id=mp_id)
        # Relation usable for existing FG FK patterns.
        event = SecurityAuditEvent.objects.create(
            event_type=SecurityAuditEvent.EventType.LOGIN_SUCCESS,
            actor=principal,
            subject_user=principal,
            metadata={"maintainpro_user_id": mp_id},
        )
        self.assertEqual(event.actor_id, principal.pk)


@pytest.mark.django_db(transaction=True)
@override_settings(**SSO_SETTINGS)
def test_concurrent_projection_mongo_or_skip() -> None:
    if not is_mongodb():
        pytest.skip("Mongo engine required")
    from django.conf import settings

    db = getattr(settings, "MONGODB_DATABASE", "") or settings.DATABASES["default"]["NAME"]
    assert db not in {"maintainpro_prod", "admin", "config", "local"}

    cache.clear()
    mp_id = uuid.uuid4().hex[:24]
    claims = _claims(mp_id)

    def worker(_: int) -> str:
        connection.close()
        user = project_maintainpro_principal(claims)
        return str(user.pk)

    pks: list[str] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(worker, i) for i in range(8)]
        for fut in as_completed(futures):
            pks.append(fut.result())

    assert len(set(pks)) == 1
    assert User.objects.filter(maintainpro_user_id=mp_id).count() == 1

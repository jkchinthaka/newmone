"""MaintainPro → FG SSO security, projection, replay, and permission bridge tests."""

from __future__ import annotations

import time
from datetime import UTC, datetime
from unittest.mock import patch

import jwt
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import PermissionDenied
from django.test import Client, RequestFactory, TestCase, override_settings
from django.urls import reverse

from apps.access_control.maintainpro_bridge import (
    FG_PERMISSIONS_USER_ATTR,
    assert_fg_permission,
    user_has_fg_permission,
)
from apps.accounts.backends import EmployeeCodeBackend
from apps.accounts.sso import (
    FgSsoClaims,
    project_maintainpro_principal,
    reject_forged_identity_headers,
    verify_fg_sso_assertion,
)

User = get_user_model()

SSO_SECRET = "test-only-fg-sso-signing-secret-min-32-chars!!"
JWT_ACCESS_SECRET = "test-only-maintainpro-jwt-access-secret!!"
SSO_SETTINGS = {
    "FG_SSO_SIGNING_SECRET": SSO_SECRET,
    "FG_SSO_ISSUER": "maintainpro",
    "FG_SSO_AUDIENCE": "fg-digital-recording",
    "MAINTAINPRO_JWT_ACCESS_SECRET": JWT_ACCESS_SECRET,
}


def _mint(
    *,
    sub: str = "507f1f77bcf86cd799439011",
    email: str = "user@example.com",
    permissions: list[str] | None = None,
    iss: str = "maintainpro",
    aud: str = "fg-digital-recording",
    exp_delta: int = 60,
    secret: str = SSO_SECRET,
    jti: str | None = None,
) -> str:
    now = int(time.time())
    payload = {
        "iss": iss,
        "aud": aud,
        "sub": sub,
        "email": email,
        "firstName": "Test",
        "lastName": "User",
        "tenantId": "tenant-1",
        "role": "ADMIN",
        "permissions": permissions if permissions is not None else ["fg.access", "fg.recording.view"],
        "jti": jti or f"jti-{now}-{sub[-4:]}-{time.time_ns()}",
        "iat": now,
        "exp": now + exp_delta,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@override_settings(**SSO_SETTINGS)
class TestFgSsoAssertion(TestCase):
    def setUp(self) -> None:
        cache.clear()

    def test_valid_assertion_accepted(self):
        claims = verify_fg_sso_assertion(_mint(), consume_jti=False)
        self.assertEqual(claims.sub, "507f1f77bcf86cd799439011")
        self.assertIn("fg.access", claims.permissions)

    def test_invalid_signature_rejected(self):
        token = _mint(secret="wrong-secret-wrong-secret-wrong-secret!!")
        with self.assertRaises(PermissionDenied):
            verify_fg_sso_assertion(token, consume_jti=False)

    def test_expired_assertion_rejected(self):
        with self.assertRaises(PermissionDenied):
            verify_fg_sso_assertion(_mint(exp_delta=-30), consume_jti=False)

    def test_wrong_issuer_rejected(self):
        with self.assertRaises(PermissionDenied):
            verify_fg_sso_assertion(_mint(iss="not-maintainpro"), consume_jti=False)

    def test_wrong_audience_rejected(self):
        with self.assertRaises(PermissionDenied):
            verify_fg_sso_assertion(_mint(aud="wrong-aud"), consume_jti=False)

    def test_missing_fg_access_rejected(self):
        with self.assertRaises(PermissionDenied):
            verify_fg_sso_assertion(_mint(permissions=["fg.recording.view"]), consume_jti=False)

    def test_jti_replay_rejected(self):
        token = _mint(jti="replay-jti-unique-001")
        first = verify_fg_sso_assertion(token, consume_jti=True)
        self.assertEqual(first.jti, "replay-jti-unique-001")
        with self.assertRaises(PermissionDenied):
            verify_fg_sso_assertion(token, consume_jti=True)

    def test_jti_cache_outage_fails_closed(self):
        token = _mint(jti="replay-jti-outage-001")
        with patch("apps.accounts.sso.cache.add", side_effect=RuntimeError("redis down")):
            with self.assertRaises(PermissionDenied):
                verify_fg_sso_assertion(token, consume_jti=True)


@override_settings(**SSO_SETTINGS)
class TestPrincipalProjection(TestCase):
    def setUp(self) -> None:
        cache.clear()

    def test_projected_user_has_unusable_password(self):
        claims = verify_fg_sso_assertion(_mint(), consume_jti=False)
        user = project_maintainpro_principal(claims)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.maintainpro_user_id, claims.sub)
        self.assertIsNone(user.employee_code)
        self.assertFalse(user.is_staff)

    def test_fg_admin_sets_staff(self):
        claims = verify_fg_sso_assertion(
            _mint(permissions=["fg.access", "fg.admin"]), consume_jti=False
        )
        user = project_maintainpro_principal(claims)
        self.assertTrue(user.is_staff)

    def test_duplicate_maintainpro_id_updates_same_principal(self):
        claims = verify_fg_sso_assertion(_mint(), consume_jti=False)
        first = project_maintainpro_principal(claims)
        second = project_maintainpro_principal(claims)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(User.objects.filter(maintainpro_user_id=claims.sub).count(), 1)

    def test_employee_code_backend_rejects_projected_user(self):
        claims = verify_fg_sso_assertion(_mint(), consume_jti=False)
        user = project_maintainpro_principal(claims)
        user.employee_code = "EMP999"
        user.set_password("ShouldNeverWork1!")
        user.save()
        backend = EmployeeCodeBackend()
        self.assertIsNone(
            backend.authenticate(None, username="EMP999", password="ShouldNeverWork1!")
        )


@override_settings(
    **SSO_SETTINGS,
    MAINTAINPRO_SSO_GATE_ENABLED=True,
    FG_PASSWORD_LOGIN_ENABLED=False,
)
class TestSsoViewsAndGate(TestCase):
    def setUp(self) -> None:
        cache.clear()

    def test_unauthenticated_redirects_to_handoff(self):
        client = Client()
        response = client.get("/accounts/landing/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/api/fg-sso/handoff", response["Location"])

    def test_forged_identity_headers_rejected(self):
        client = Client()
        response = client.get(
            "/accounts/landing/",
            HTTP_X_USER_ID="attacker",
            HTTP_X_ROLE="SUPER_ADMIN",
        )
        self.assertEqual(response.status_code, 403)

    def test_consume_establishes_session_once(self):
        client = Client()
        token = _mint(jti="consume-once-jti-1")
        client.cookies["fg_sso_assertion"] = token
        response = client.get(reverse("sso_consume") + "?next=/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(client.session.get("maintainpro_user_id"), "507f1f77bcf86cd799439011")

        client2 = Client()
        client2.cookies["fg_sso_assertion"] = token
        response2 = client2.get(reverse("sso_consume") + "?next=/")
        self.assertEqual(response2.status_code, 302)
        self.assertIn("/sso/denied", response2["Location"])

    def test_login_redirects_to_maintainpro(self):
        client = Client()
        response = client.get(reverse("accounts:login"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login", response["Location"])

    def test_reject_helper_raises_on_forged_headers(self):
        request = RequestFactory().get("/", HTTP_X_EMAIL="forged@evil.test")
        with self.assertRaises(PermissionDenied):
            reject_forged_identity_headers(request)

    def test_admin_requires_fg_admin_not_mere_access(self):
        claims = verify_fg_sso_assertion(
            _mint(permissions=["fg.access", "fg.recording.view"]), consume_jti=False
        )
        user = project_maintainpro_principal(claims)
        client = Client()
        client.force_login(user, backend="apps.accounts.backends.MaintainProSsoBackend")
        session = client.session
        session["maintainpro_user_id"] = claims.sub
        session["maintainpro_permissions"] = list(claims.permissions)
        session.save()
        # Valid access JWT matching sub
        now = int(time.time())
        access = jwt.encode(
            {"sub": claims.sub, "exp": now + 600, "iat": now},
            JWT_ACCESS_SECRET,
            algorithm="HS256",
        )
        client.cookies["maintainpro_access"] = access
        response = client.get("/admin/")
        self.assertEqual(response.status_code, 403)


@override_settings(**SSO_SETTINGS)
class TestFgPermissionBridge(TestCase):
    def test_projected_user_denied_without_permission(self):
        user = User(
            username="mp_x",
            email="x@example.com",
            maintainpro_user_id="507f1f77bcf86cd799439099",
        )
        setattr(user, FG_PERMISSIONS_USER_ATTR, frozenset({"fg.access", "fg.recording.view"}))
        self.assertTrue(user_has_fg_permission(user, "fg.recording.view"))
        self.assertFalse(user_has_fg_permission(user, "fg.recording.submit"))
        self.assertFalse(user_has_fg_permission(user, "fg.admin"))

    def test_request_assert_requires_granular_key(self):
        user = User.objects.create(
            username="mp_y",
            email="y@example.com",
            maintainpro_user_id="507f1f77bcf86cd799439088",
        )
        user.set_unusable_password()
        user.save()
        request = RequestFactory().get("/")
        request.user = user
        request.session = self.client.session
        request.session["maintainpro_permissions"] = ["fg.access", "fg.recording.view"]
        with self.assertRaises(PermissionDenied):
            assert_fg_permission(request, "fg.recording.submit")
        assert_fg_permission(request, "fg.recording.view")


@override_settings(**SSO_SETTINGS)
class TestClaimsDataclass(TestCase):
    def test_claims_dataclass_roundtrip(self):
        claims = FgSsoClaims(
            sub="abc",
            email="a@b.c",
            first_name="A",
            last_name="B",
            tenant_id="t",
            role="ADMIN",
            permissions=("fg.access",),
            jti="j",
            exp=int(datetime.now(tz=UTC).timestamp()) + 60,
            iss="maintainpro",
            aud="fg-digital-recording",
        )
        self.assertEqual(claims.permissions[0], "fg.access")

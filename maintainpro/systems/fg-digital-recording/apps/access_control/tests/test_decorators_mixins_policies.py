"""Decorator, mixin, and policy coverage — synthetic permissions only."""

from __future__ import annotations

import pytest
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse, HttpResponseRedirect
from django.test import RequestFactory
from django.views.generic import View
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.access_control.decorators import permission_required
from apps.access_control.mixins import PermissionRequiredMixin
from apps.access_control.policies import assert_can_access, can_access
from apps.access_control.services import Scope
from apps.accounts.models import User


def _attach_user(request: object, user: User | AnonymousUser) -> None:
    request.user = user  # type: ignore[attr-defined]


@pytest.fixture
def rf() -> RequestFactory:
    return RequestFactory()


@pytest.mark.django_db
def test_decorator_redirects_anonymous(rf: RequestFactory) -> None:
    @permission_required("accounts.test_permission")
    def protected(request: object) -> HttpResponse:
        return HttpResponse("ok")

    request = rf.get("/protected/")
    _attach_user(request, AnonymousUser())
    response = protected(request)
    assert isinstance(response, HttpResponseRedirect)
    assert "/accounts/login/" in response.url


@pytest.mark.django_db
def test_decorator_raises_403_without_permission(rf: RequestFactory) -> None:
    make_role_with_permission(code="ROLETEST1")

    @permission_required("accounts.test_permission")
    def protected(request: object) -> HttpResponse:
        return HttpResponse("ok")

    user = make_user(employee_code="TST010")
    request = rf.get("/protected/")
    _attach_user(request, user)
    with pytest.raises(PermissionDenied):
        protected(request)


@pytest.mark.django_db
def test_decorator_allows_with_permission(rf: RequestFactory) -> None:
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST011")
    grant_role(user, role)

    @permission_required("accounts.test_permission")
    def protected(request: object) -> HttpResponse:
        return HttpResponse("ok")

    request = rf.get("/protected/")
    _attach_user(request, user)
    response = protected(request)
    assert response.status_code == 200
    assert response.content == b"ok"


@pytest.mark.django_db
def test_decorator_with_scope_getter(rf: RequestFactory) -> None:
    org = make_org(code="ORGTEST1")
    other = make_org(code="ORGTEST2")
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST012")
    grant_role(user, role, organization=org)

    @permission_required(
        "accounts.test_permission",
        scope_getter=lambda r: Scope(organization_id=other.id),
    )
    def protected(request: object) -> HttpResponse:
        return HttpResponse("ok")

    request = rf.get("/protected/")
    _attach_user(request, user)
    with pytest.raises(PermissionDenied):
        protected(request)


@pytest.mark.django_db
def test_mixin_denies_without_permission(rf: RequestFactory) -> None:
    make_role_with_permission(code="ROLETEST1")

    class ProtectedView(PermissionRequiredMixin, View):
        permission_required = "accounts.test_permission"

        def get(self, request: object) -> HttpResponse:
            return HttpResponse("ok")

    user = make_user(employee_code="TST013")
    request = rf.get("/protected/")
    _attach_user(request, user)
    with pytest.raises(PermissionDenied):
        ProtectedView.as_view()(request)


@pytest.mark.django_db
def test_mixin_redirects_anonymous(rf: RequestFactory) -> None:
    class ProtectedView(PermissionRequiredMixin, View):
        permission_required = "accounts.test_permission"

        def get(self, request: object) -> HttpResponse:
            return HttpResponse("ok")

    request = rf.get("/protected/")
    _attach_user(request, AnonymousUser())
    response = ProtectedView.as_view()(request)
    assert response.status_code == 302


@pytest.mark.django_db
def test_mixin_requires_permission_attribute(rf: RequestFactory) -> None:
    class BrokenView(PermissionRequiredMixin, View):
        permission_required = ""

        def get(self, request: object) -> HttpResponse:
            return HttpResponse("ok")

    user = make_user(employee_code="TST014")
    request = rf.get("/protected/")
    _attach_user(request, user)
    with pytest.raises(ValueError, match="permission_required"):
        BrokenView.as_view()(request)


@pytest.mark.django_db
def test_mixin_allows_with_permission(rf: RequestFactory) -> None:
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST015")
    grant_role(user, role)

    class ProtectedView(PermissionRequiredMixin, View):
        permission_required = "accounts.test_permission"

        def get(self, request: object) -> HttpResponse:
            return HttpResponse("ok")

    request = rf.get("/protected/")
    _attach_user(request, user)
    response = ProtectedView.as_view()(request)
    assert response.status_code == 200


@pytest.mark.django_db
def test_policies_can_access_and_assert() -> None:
    org = make_org(code="ORGTEST1")
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST016")
    grant_role(user, role, organization=org)

    assert can_access(user, "accounts.test_permission", organization_id=org.id) is True
    assert_can_access(user, "accounts.test_permission", organization_id=org.id)

    other = make_org(code="ORGTEST2")
    assert can_access(user, "accounts.test_permission", organization_id=other.id) is False
    with pytest.raises(PermissionDenied):
        assert_can_access(user, "accounts.test_permission", organization_id=other.id)

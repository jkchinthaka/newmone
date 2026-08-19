"""MaintainPro vehicle reference service — unit tests (in-memory client)."""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from django.test import override_settings

from apps.integrations.maintainpro.client import InMemoryReferenceClient
from apps.integrations.maintainpro.exceptions import CrossTenantReferenceError
from apps.integrations.maintainpro.reference_service import MaintainProReferenceService
from apps.integrations.maintainpro.validation import (
    VEHICLE_SELECT_REQUIRED_MESSAGE,
    bind_vehicle_from_post,
)

TENANT_A = "aaaaaaaaaaaaaaaaaaaaaaaa"
TENANT_B = "bbbbbbbbbbbbbbbbbbbbbbbb"
VEHICLE_A = "cccccccccccccccccccccccc"
VEHICLE_B = "dddddddddddddddddddddddd"


def _client() -> InMemoryReferenceClient:
    return InMemoryReferenceClient(
        {
            "Vehicle": [
                {
                    "_id": VEHICLE_A,
                    "tenantId": TENANT_A,
                    "registrationNo": "CAB-1234",
                    "make": "Toyota",
                    "vehicleModel": "Hiace",
                    "status": "AVAILABLE",
                    "assetTag": "AT-1",
                },
                {
                    "_id": VEHICLE_B,
                    "tenantId": TENANT_B,
                    "registrationNo": "CAB-1798",
                    "make": "Isuzu",
                    "vehicleModel": "NPR",
                    "status": "IN_USE",
                    "assetTag": "AT-2",
                },
            ]
        }
    )


def test_partial_and_case_insensitive_vehicle_search() -> None:
    svc = MaintainProReferenceService(_client())
    rows = svc.search_vehicles(tenant_id=TENANT_A, query="cab")
    assert len(rows) == 1
    assert rows[0].registration_no == "CAB-1234"
    assert rows[0].make == "Toyota"


def test_vehicle_search_result_limit() -> None:
    docs = {
        "Vehicle": [
            {
                "_id": f"{i:024x}",
                "tenantId": TENANT_A,
                "registrationNo": f"CAB-{i:04d}",
                "make": "Make",
                "vehicleModel": "Model",
                "status": "AVAILABLE",
            }
            for i in range(30)
        ]
    }
    svc = MaintainProReferenceService(InMemoryReferenceClient(docs))
    rows = svc.search_vehicles(tenant_id=TENANT_A, query="CAB", limit=15)
    assert len(rows) == 15


def test_vehicle_tenant_isolation() -> None:
    svc = MaintainProReferenceService(_client())
    rows = svc.search_vehicles(tenant_id=TENANT_A, query="CAB")
    assert all(r.tenant_id == TENANT_A for r in rows)
    assert VEHICLE_B not in {r.id for r in rows}
    with pytest.raises(Exception):
        svc.get_vehicle(tenant_id=TENANT_A, vehicle_id=VEHICLE_B)


def test_forged_vehicle_id_rejected() -> None:
    svc = MaintainProReferenceService(_client())
    with pytest.raises(Exception):
        svc.validate_vehicle_for_write(tenant_id=TENANT_A, vehicle_id="not-an-objectid")


def test_bind_requires_selection_not_free_text() -> None:
    org = type("Org", (), {"maintainpro_tenant_id": TENANT_A})()
    with override_settings(MAINTAINPRO_REFERENCE_CLIENT=_client()):
        with pytest.raises(ValidationError) as exc:
            bind_vehicle_from_post(
                organization=org,
                maintainpro_vehicle_id="",
                typed_vehicle_text="CAB-1234",
            )
        assert VEHICLE_SELECT_REQUIRED_MESSAGE in str(exc.value)


def test_bind_verified_snapshot() -> None:
    org = type("Org", (), {"maintainpro_tenant_id": TENANT_A})()
    with override_settings(MAINTAINPRO_REFERENCE_CLIENT=_client()):
        binding = bind_vehicle_from_post(
            organization=org,
            maintainpro_vehicle_id=VEHICLE_A,
            typed_vehicle_text="CAB-1234",
        )
    assert binding is not None
    assert binding.maintainpro_vehicle_id == VEHICLE_A
    assert binding.vehicle_registration_snapshot == "CAB-1234"
    assert binding.vehicle_make_snapshot == "Toyota"
    assert binding.vehicle_model_snapshot == "Hiace"
    assert binding.reference_verification_status == "VERIFIED"


def test_empty_query_requires_tenant() -> None:
    svc = MaintainProReferenceService(_client())
    with pytest.raises(CrossTenantReferenceError):
        svc.search_vehicles(tenant_id="", query="CAB")


def test_vehicle_eligibility_uses_maintainpro_statuses_not_active() -> None:
    svc = MaintainProReferenceService(_client())
    available = svc.get_vehicle(tenant_id=TENANT_A, vehicle_id=VEHICLE_A)
    assert available.is_active_for_dispatch is True
    selectable, reason = available.eligibility_for_new_record()
    assert selectable is True
    assert reason is None

    in_use = svc._vehicle_from_doc(
        {
            "_id": VEHICLE_A,
            "tenantId": TENANT_A,
            "registrationNo": "CAB-1234",
            "make": "Toyota",
            "vehicleModel": "Hiace",
            "status": "IN_USE",
            "type": "VAN",
        },
        expected_tenant=TENANT_A,
    )
    assert in_use.is_active_for_dispatch is True

    oos = svc._vehicle_from_doc(
        {
            "_id": VEHICLE_A,
            "tenantId": TENANT_A,
            "registrationNo": "CAB-1234",
            "make": "Toyota",
            "vehicleModel": "Hiace",
            "status": "OUT_OF_SERVICE",
            "type": "VAN",
        },
        expected_tenant=TENANT_A,
    )
    assert oos.is_active_for_dispatch is False
    assert oos.eligibility_for_new_record()[1] == "OUT_OF_SERVICE"


def test_cl30_type_filter_rejects_motorcycle() -> None:
    bike = {
        "_id": VEHICLE_A,
        "tenantId": TENANT_A,
        "registrationNo": "WP-BFJ-9183",
        "make": "Suzuki",
        "vehicleModel": "GN-125H",
        "status": "AVAILABLE",
        "type": "MOTORCYCLE",
    }
    svc = MaintainProReferenceService(InMemoryReferenceClient({"Vehicle": [bike]}))
    rows = svc.search_vehicles(
        tenant_id=TENANT_A,
        query="WP",
        allowed_types=frozenset({"TRUCK"}),
    )
    assert rows == []


def test_allowlisted_collections_only() -> None:
    client = _client()
    with pytest.raises(Exception):
        client.find("WorkOrder", {"tenantId": TENANT_A})

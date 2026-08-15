"""Phase 05C FG Product master foundation — synthetic values only; no Nelna seeds."""

from __future__ import annotations

import datetime
from io import StringIO
from pathlib import Path

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test.utils import CaptureQueriesContext
from tests.factories import grant_role, make_org, make_site, make_user

from apps.access_control.services import create_role
from apps.master_data.historical_safety import refuse_hard_delete_fg_product
from apps.master_data.models import FGProduct
from apps.master_data.product_import import (
    empty_product_import_template_csv,
    format_product_import_error_report,
    import_fg_products,
)
from apps.master_data.selectors import list_fg_products
from apps.master_data.services import (
    create_fg_product,
    deactivate_fg_product,
    update_fg_product,
)
from apps.security_audit.models import SecurityAuditEvent


def _product_perm(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(FGProduct)
    perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": codename},
    )
    return perm


@pytest.mark.django_db
def test_normalized_code_uniqueness_within_org() -> None:
    org = make_org(code="ORG05C1")
    actor = make_user(employee_code="FG05C01", is_superuser=True)
    create_fg_product(actor=actor, organization=org, code=" syn05ca ", name="A")
    with pytest.raises(ValidationError):
        create_fg_product(actor=actor, organization=org, code="SYN05CA", name="Dup")


@pytest.mark.django_db
def test_duplicate_erp_mapping_within_org() -> None:
    org = make_org(code="ORG05C2")
    actor = make_user(employee_code="FG05C02", is_superuser=True)
    create_fg_product(
        actor=actor,
        organization=org,
        code="SYN05CB",
        name="B",
        erp_item_code="erp-100",
    )
    with pytest.raises(ValidationError):
        create_fg_product(
            actor=actor,
            organization=org,
            code="SYN05CC",
            name="C",
            erp_item_code="ERP-100",
        )
    # Empty ERP codes may coexist
    create_fg_product(actor=actor, organization=org, code="SYN05CD", name="D", erp_item_code="")
    create_fg_product(actor=actor, organization=org, code="SYN05CE", name="E", erp_item_code="")


@pytest.mark.django_db
def test_inactive_lifecycle_and_effective_window() -> None:
    org = make_org(code="ORG05C3")
    actor = make_user(employee_code="FG05C03", is_superuser=True)
    product = create_fg_product(
        actor=actor,
        organization=org,
        code="SYN05CF",
        name="F",
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 12, 31),
    )
    deactivate_fg_product(actor=actor, product_id=product.id)
    product.refresh_from_db()
    assert product.is_active is False
    with pytest.raises(ValidationError):
        update_fg_product(
            actor=actor,
            product_id=product.id,
            effective_from=datetime.date(2026, 6, 1),
            effective_to=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_hard_delete_refused() -> None:
    org = make_org(code="ORG05C4")
    actor = make_user(employee_code="FG05C04", is_superuser=True)
    product = create_fg_product(actor=actor, organization=org, code="SYN05CG", name="G")
    with pytest.raises(ValidationError):
        refuse_hard_delete_fg_product(product)
    assert FGProduct.objects.filter(pk=product.pk).exists()


@pytest.mark.django_db
def test_cross_org_and_site_only_denied() -> None:
    org_a = make_org(code="ORG05CA")
    org_b = make_org(code="ORG05CB")
    site_a = make_site(org_a, code="SITE05CA")
    manager = make_user(employee_code="FG05C05", is_staff=True)
    role = create_role(
        code="R05CM",
        name="Site manage only",
        permissions=[_product_perm("manage_fgproduct"), _product_perm("view_fgproduct")],
    )
    grant_role(manager, role, organization=org_a, site=site_a)

    with pytest.raises(PermissionDenied):
        create_fg_product(actor=manager, organization=org_a, code="SYN05CH", name="H")

    org_manager = make_user(employee_code="FG05C06", is_staff=True)
    role2 = create_role(
        code="R05CO",
        name="Org manage",
        permissions=[_product_perm("manage_fgproduct"), _product_perm("view_fgproduct")],
    )
    grant_role(org_manager, role2, organization=org_a)
    create_fg_product(actor=org_manager, organization=org_a, code="SYN05CI", name="I")
    with pytest.raises(PermissionDenied):
        create_fg_product(actor=org_manager, organization=org_b, code="SYN05CJ", name="J")


@pytest.mark.django_db
def test_import_dry_run_commit_and_failure() -> None:
    org = make_org(code="ORG05CIMP")
    actor = make_user(employee_code="FG05C07", is_superuser=True)
    csv_ok = (
        empty_product_import_template_csv()
        + "ORG05CIMP,SYN05CK,Synthetic K,,ERP05CK,CatA,BrandA,1kg,KG,BC05C,"
        "Ambient,SL-REF,ART-REF,2026-01-01,,true\n"
    )
    assert len(empty_product_import_template_csv().strip().splitlines()) == 1

    preview = import_fg_products(actor=actor, source=StringIO(csv_ok), dry_run=True)
    assert preview.ok
    assert FGProduct.objects.filter(code="SYN05CK").count() == 0
    assert SecurityAuditEvent.objects.filter(event_type="FG_PRODUCT_IMPORT_PREVIEWED").exists()

    committed = import_fg_products(actor=actor, source=StringIO(csv_ok), dry_run=False)
    assert committed.ok
    product = FGProduct.objects.get(code="SYN05CK")
    assert product.erp_item_code == "ERP05CK"
    assert product.category == "CatA"
    assert product.organization_id == org.id
    assert SecurityAuditEvent.objects.filter(event_type="FG_PRODUCT_IMPORT_COMPLETED").exists()

    failed = import_fg_products(actor=actor, source=StringIO(csv_ok), dry_run=False)
    assert not failed.ok
    assert failed.duplicate_codes
    assert "row_number,field,message" in format_product_import_error_report(failed)
    assert SecurityAuditEvent.objects.filter(event_type="FG_PRODUCT_IMPORT_FAILED").exists()


@pytest.mark.django_db
def test_search_filter_and_query_bound() -> None:
    org = make_org(code="ORG05CQR")
    actor = make_user(employee_code="FG05C08", is_superuser=True)
    create_fg_product(
        actor=actor,
        organization=org,
        code="SYN05CL",
        name="Searchable",
        category="CatSearch",
        erp_item_code="ERPSEARCH",
        barcode="BCSEARCH",
    )
    qs = list_fg_products(actor, search="ERPSEARCH")
    assert qs.count() == 1
    qs2 = list_fg_products(actor, category="CatSearch")
    assert qs2.count() == 1
    with CaptureQueriesContext(connection) as ctx:
        list(list_fg_products(actor, organization=org, status="active", search="SYN05CL"))
    assert len(ctx) <= 5


@pytest.mark.django_db
def test_management_command_template(tmp_path: Path) -> None:
    template = tmp_path / "fg.csv"
    call_command("import_fg_products", write_template=str(template), stdout=StringIO())
    assert "organization_code" in template.read_text(encoding="utf-8")
    with pytest.raises(CommandError):
        call_command("import_fg_products", csv_path=str(template), actor="bad", stdout=StringIO())


@pytest.mark.django_db
def test_management_command_dry_run_and_commit(tmp_path: Path) -> None:
    org = make_org(code="ORG05CCMD")
    actor = make_user(employee_code="FG05C09", is_superuser=True)
    csv_path = tmp_path / "rows.csv"
    csv_path.write_text(
        empty_product_import_template_csv() + "ORG05CCMD,SYN05CCM,Cmd Product,,,,,,,,,,,\n",
        encoding="utf-8",
    )
    err = tmp_path / "err.csv"
    call_command(
        "import_fg_products",
        csv_path=str(csv_path),
        actor=str(actor.id),
        error_file=str(err),
        stdout=StringIO(),
    )
    assert FGProduct.objects.filter(code="SYN05CCM").count() == 0
    call_command(
        "import_fg_products",
        csv_path=str(csv_path),
        actor=str(actor.id),
        commit=True,
        stdout=StringIO(),
    )
    assert FGProduct.objects.filter(code="SYN05CCM", organization=org).exists()


@pytest.mark.django_db
def test_activate_update_optional_fields_and_admin() -> None:
    from django.contrib.admin.sites import site as admin_site
    from django.http import QueryDict

    from apps.master_data.admin import FGProductAdmin
    from apps.master_data.services import activate_fg_product

    org = make_org(code="ORG05CACT")
    actor = make_user(employee_code="FG05C10", is_superuser=True)
    product = create_fg_product(actor=actor, organization=org, code="SYN05CN", name="N")
    deactivate_fg_product(actor=actor, product_id=product.id)
    activate_fg_product(actor=actor, product_id=product.id)
    updated = update_fg_product(
        actor=actor,
        product_id=product.id,
        brand="BrandX",
        uom="kg",
        storage_category="Ambient-label",
        shelf_life_reference="SL-1",
        label_artwork_reference="ART-1",
        barcode="BC-1",
        pack_size="500g",
    )
    assert updated.brand == "BrandX"
    assert updated.uom == "KG"
    request = type(
        "R",
        (),
        {"user": actor, "GET": QueryDict()},
    )()
    admin = FGProductAdmin(FGProduct, admin_site)
    assert admin.has_delete_permission(request) is False
    assert "delete_selected" not in admin.get_actions(request)


@pytest.mark.django_db
def test_form_effective_window_validation() -> None:
    from apps.master_data.forms import FGProductForm

    org = make_org(code="ORG05CFRM")
    form = FGProductForm(
        data={
            "organization": str(org.id),
            "code": "SYN05CFO",
            "name": "Form",
            "effective_from": "2026-06-01",
            "effective_to": "2026-01-01",
            "is_active": "on",
        },
        organizations=type(org).objects.filter(pk=org.pk),
    )
    assert form.is_valid() is False
    assert "effective_to" in form.errors


@pytest.mark.django_db
def test_no_seeded_nelna_catalogue() -> None:
    assert FGProduct.objects.filter(code__iexact="NELNA").count() == 0
    assert FGProduct.objects.filter(erp_item_code__iexact="BILEETA").count() == 0


@pytest.mark.django_db
def test_admin_blocks_hard_delete() -> None:
    from django.contrib.admin.sites import site as admin_site
    from django.http import QueryDict

    from apps.master_data.admin import FGProductAdmin

    request = type(
        "R",
        (),
        {
            "user": make_user(employee_code="FG05CADM", is_superuser=True),
            "GET": QueryDict(),
        },
    )()
    model_admin = FGProductAdmin(FGProduct, admin_site)
    assert model_admin.has_delete_permission(request) is False
    assert "delete_selected" not in model_admin.get_actions(request)

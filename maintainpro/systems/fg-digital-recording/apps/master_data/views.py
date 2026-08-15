"""FG Product management views — thin HTTP adapters."""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Any

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.models import User
from apps.master_data.forms import FGProductForm
from apps.master_data.models import FGProduct
from apps.master_data.selectors import (
    StatusFilter,
    actor_can_manage_fg_product,
    actor_can_view_fg_products,
    get_fg_product,
    list_fg_products,
    manageable_organization_ids,
    organizations_for_fg_product_actor,
    organizations_for_fg_product_manage,
)
from apps.master_data.services import (
    activate_fg_product,
    create_fg_product,
    deactivate_fg_product,
    update_fg_product,
)
from apps.organizations.models import Organization

PAGE_SIZE = 25


def _actor(request: HttpRequest) -> User:
    return request.user  # type: ignore[return-value]


def _parse_uuid(raw: str | None) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError, AttributeError):
        return None


def _require_view_module(request: HttpRequest) -> None:
    if not actor_can_view_fg_products(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _require_manage_module(request: HttpRequest) -> None:
    # Require at least one Organization where manage_fgproduct applies at org Scope.
    # Site-only manage grants do not escalate to Product create.
    if not manageable_organization_ids(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _get_product_or_404(request: HttpRequest, product_id: uuid.UUID) -> FGProduct:
    try:
        product = get_fg_product(_actor(request), product_id)
    except PermissionDenied:
        raise
    if product is None:
        raise Http404("FG Product not found.")
    return product


def _apply_validation_error(form: FGProductForm, exc: ValidationError) -> None:
    if hasattr(exc, "message_dict"):
        for field, errors in exc.message_dict.items():
            target = field if field in form.fields else None
            for error in errors:
                form.add_error(target, error)
        return
    if hasattr(exc, "error_list"):
        for err in exc.error_list:
            form.add_error(None, err)
        return
    form.add_error(None, "; ".join(str(m) for m in exc.messages))


def _product_form_for_actor(
    request: HttpRequest,
    data: Mapping[str, Any] | None = None,
    *,
    instance: FGProduct | None = None,
) -> FGProductForm:
    orgs = (
        organizations_for_fg_product_manage(_actor(request))
        if instance is None
        else organizations_for_fg_product_actor(_actor(request))
    )
    if instance is not None:
        # Ensure current org remains in queryset for disabled display.
        orgs = Organization.objects.filter(
            pk__in={*orgs.values_list("pk", flat=True), instance.organization_id}
        ).order_by("code")
    return FGProductForm(data, organizations=orgs, instance=instance)


@login_required
@require_GET
def product_list(request: HttpRequest) -> HttpResponse:
    _require_view_module(request)
    search = (request.GET.get("q") or "").strip()
    status_raw = (request.GET.get("status") or "all").strip().lower()
    status: StatusFilter = (
        status_raw if status_raw in {"all", "active", "inactive"} else "all"  # type: ignore[assignment]
    )
    org_id = _parse_uuid(request.GET.get("organization"))
    category = (request.GET.get("category") or "").strip()
    organizations = organizations_for_fg_product_actor(_actor(request))
    organization = organizations.filter(pk=org_id).first() if org_id else None

    products = list_fg_products(
        _actor(request),
        organization=organization,
        status=status,
        search=search or None,
        category=category or None,
    )
    paginator = Paginator(products, PAGE_SIZE)
    page_obj = paginator.get_page(request.GET.get("page"))
    filters_active = bool(search or org_id or status != "all" or category)
    manage_org_ids = manageable_organization_ids(_actor(request))
    context = {
        "page_obj": page_obj,
        "products": page_obj.object_list,
        "search": search,
        "status": status,
        "category": category,
        "organizations": organizations,
        "selected_organization": organization,
        "filters_active": filters_active,
        "manageable_organization_ids": manage_org_ids,
        "can_create": bool(manage_org_ids),
        "total_count": paginator.count,
    }
    if request.headers.get("HX-Request") == "true":
        return render(request, "master_data/products/_list_results.html", context)
    return render(request, "master_data/products/list.html", context)


@login_required
@require_http_methods(["GET", "POST"])
def product_create(request: HttpRequest) -> HttpResponse:
    _require_manage_module(request)
    form = _product_form_for_actor(request, request.POST or None)
    if request.method == "POST" and form.is_valid():
        organization: Organization = form.cleaned_data["organization"]
        try:
            product = create_fg_product(
                actor=_actor(request),
                organization=organization,
                code=form.cleaned_data["code"],
                name=form.cleaned_data["name"],
                description=form.cleaned_data.get("description") or "",
                erp_item_code=form.cleaned_data.get("erp_item_code") or "",
                category=form.cleaned_data.get("category") or "",
                brand=form.cleaned_data.get("brand") or "",
                pack_size=form.cleaned_data.get("pack_size") or "",
                uom=form.cleaned_data.get("uom") or "",
                barcode=form.cleaned_data.get("barcode") or "",
                storage_category=form.cleaned_data.get("storage_category") or "",
                shelf_life_reference=form.cleaned_data.get("shelf_life_reference") or "",
                label_artwork_reference=form.cleaned_data.get("label_artwork_reference") or "",
                effective_from=form.cleaned_data.get("effective_from"),
                effective_to=form.cleaned_data.get("effective_to"),
                is_active=bool(form.cleaned_data.get("is_active")),
            )
        except ValidationError as exc:
            _apply_validation_error(form, exc)
        except PermissionDenied:
            raise
        else:
            messages.success(request, f"FG Product {product.code} created.")
            return redirect("master_data:product_detail", product_id=product.id)

    return render(
        request,
        "master_data/products/form.html",
        {
            "form": form,
            "page_title": "Create FG Product",
            "submit_label": "Create Product",
            "is_create": True,
        },
    )


@login_required
@require_GET
def product_detail(request: HttpRequest, product_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    product = _get_product_or_404(request, product_id)
    return render(
        request,
        "master_data/products/detail.html",
        {
            "product": product,
            "can_manage": actor_can_manage_fg_product(_actor(request), product),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def product_edit(request: HttpRequest, product_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    product = _get_product_or_404(request, product_id)
    if not actor_can_manage_fg_product(_actor(request), product):
        raise PermissionDenied("Permission denied.")

    form = _product_form_for_actor(request, request.POST or None, instance=product)
    if request.method == "POST" and form.is_valid():
        try:
            updated = update_fg_product(
                actor=_actor(request),
                product_id=product.id,
                code=form.cleaned_data["code"],
                name=form.cleaned_data["name"],
                description=form.cleaned_data.get("description") or "",
                erp_item_code=form.cleaned_data.get("erp_item_code") or "",
                category=form.cleaned_data.get("category") or "",
                brand=form.cleaned_data.get("brand") or "",
                pack_size=form.cleaned_data.get("pack_size") or "",
                uom=form.cleaned_data.get("uom") or "",
                barcode=form.cleaned_data.get("barcode") or "",
                storage_category=form.cleaned_data.get("storage_category") or "",
                shelf_life_reference=form.cleaned_data.get("shelf_life_reference") or "",
                label_artwork_reference=form.cleaned_data.get("label_artwork_reference") or "",
                effective_from=form.cleaned_data.get("effective_from"),
                effective_to=form.cleaned_data.get("effective_to"),
            )
            if form.cleaned_data.get("is_active") and not updated.is_active:
                updated = activate_fg_product(actor=_actor(request), product_id=updated.id)
            elif not form.cleaned_data.get("is_active") and updated.is_active:
                updated = deactivate_fg_product(actor=_actor(request), product_id=updated.id)
        except ValidationError as exc:
            _apply_validation_error(form, exc)
        else:
            messages.success(request, f"FG Product {updated.code} updated.")
            return redirect("master_data:product_detail", product_id=updated.id)

    return render(
        request,
        "master_data/products/form.html",
        {
            "form": form,
            "product": product,
            "page_title": f"Edit FG Product {product.code}",
            "submit_label": "Save changes",
            "is_create": False,
        },
    )


@login_required
@require_POST
def product_activate(request: HttpRequest, product_id: uuid.UUID) -> HttpResponse:
    product = _get_product_or_404(request, product_id)
    if not actor_can_manage_fg_product(_actor(request), product):
        raise PermissionDenied("Permission denied.")
    try:
        activate_fg_product(actor=_actor(request), product_id=product.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    else:
        messages.success(request, f"FG Product {product.code} activated.")
    return redirect("master_data:product_detail", product_id=product.id)


@login_required
@require_POST
def product_deactivate(request: HttpRequest, product_id: uuid.UUID) -> HttpResponse:
    product = _get_product_or_404(request, product_id)
    if not actor_can_manage_fg_product(_actor(request), product):
        raise PermissionDenied("Permission denied.")
    try:
        deactivate_fg_product(actor=_actor(request), product_id=product.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    else:
        messages.success(request, f"FG Product {product.code} deactivated.")
    return redirect("master_data:product_detail", product_id=product.id)

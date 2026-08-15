"""Checklist definition management views — thin HTTP adapters."""

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
from apps.checklists.forms import (
    ChecklistItemForm,
    ChecklistItemOptionForm,
    ChecklistSectionForm,
    ChecklistTemplateForm,
    CreateVersionForm,
)
from apps.checklists.models import (
    ChecklistItem,
    ChecklistItemOption,
    ChecklistResponseType,
    ChecklistSection,
    ChecklistTemplate,
    ChecklistVersion,
)
from apps.checklists.proposal_loader import is_fg_qa_001_proposal_template
from apps.checklists.selectors import (
    StatusFilter,
    actor_can_manage_template,
    actor_can_manage_version,
    actor_can_view_checklists,
    get_checklist_template,
    get_version_with_structure,
    list_checklist_templates,
    list_checklist_versions,
    manageable_organization_ids,
    organizations_for_checklist_manage,
    organizations_for_checklist_view,
    products_for_checklist_manage,
)
from apps.checklists.services import (
    activate_checklist_template,
    add_checklist_item,
    add_checklist_item_option,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    deactivate_checklist_template,
    move_checklist_item,
    move_checklist_item_option,
    move_checklist_section,
    publish_checklist_version,
    remove_checklist_item,
    remove_checklist_item_option,
    remove_checklist_section,
    retire_checklist_version,
    update_checklist_item,
    update_checklist_item_option,
    update_checklist_section,
    update_checklist_template,
)
from apps.core.persistence import prefetch_related_compat
from apps.master_data.models import FGProduct
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
    if not actor_can_view_checklists(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _require_manage_module(request: HttpRequest) -> None:
    if not manageable_organization_ids(_actor(request)):
        raise PermissionDenied("Permission denied.")


def _get_template_or_404(request: HttpRequest, template_id: uuid.UUID) -> ChecklistTemplate:
    try:
        template = get_checklist_template(_actor(request), template_id)
    except PermissionDenied:
        raise
    if template is None:
        raise Http404("Checklist template not found.")
    return template


def _get_version_or_404(request: HttpRequest, version_id: uuid.UUID) -> ChecklistVersion:
    try:
        version = get_version_with_structure(_actor(request), version_id)
    except PermissionDenied:
        raise
    if version is None:
        raise Http404("Checklist version not found.")
    return version


def _apply_validation_error(form: Any, exc: ValidationError) -> None:
    if hasattr(exc, "message_dict"):
        for field, errors in exc.message_dict.items():
            target = field if field in getattr(form, "fields", {}) else None
            for error in errors:
                form.add_error(target, error)
        return
    if hasattr(exc, "error_list"):
        for err in exc.error_list:
            form.add_error(None, err)
        return
    form.add_error(None, "; ".join(str(m) for m in exc.messages))


def _template_form(
    request: HttpRequest,
    data: Mapping[str, Any] | None = None,
    *,
    instance: ChecklistTemplate | None = None,
) -> ChecklistTemplateForm:
    orgs = (
        organizations_for_checklist_manage(_actor(request))
        if instance is None
        else organizations_for_checklist_view(_actor(request))
    )
    products = products_for_checklist_manage(_actor(request))
    if instance is not None:
        orgs = Organization.objects.filter(
            pk__in={*orgs.values_list("pk", flat=True), instance.organization_id}
        ).order_by("code")
        product_ids = set(products.values_list("pk", flat=True))
        if instance.product_id:
            product_ids.add(instance.product_id)
        products = FGProduct.objects.filter(pk__in=product_ids).select_related("organization")
    return ChecklistTemplateForm(
        data,
        organizations=orgs,
        products=products,
        instance=instance,
    )


@login_required
@require_GET
def template_list(request: HttpRequest) -> HttpResponse:
    _require_view_module(request)
    search = (request.GET.get("q") or "").strip()
    status_raw = (request.GET.get("status") or "all").strip().lower()
    status: StatusFilter = (
        status_raw if status_raw in {"all", "active", "inactive"} else "all"  # type: ignore[assignment]
    )
    org_id = _parse_uuid(request.GET.get("organization"))
    product_id = _parse_uuid(request.GET.get("product"))
    organizations = organizations_for_checklist_view(_actor(request))
    organization = organizations.filter(pk=org_id).first() if org_id else None
    view_org_ids = set(organizations.values_list("pk", flat=True))
    filter_products = (
        FGProduct.objects.filter(organization_id__in=view_org_ids)
        .select_related("organization")
        .order_by("organization__code", "code")
    )
    product = filter_products.filter(pk=product_id).first() if product_id else None

    templates = list_checklist_templates(
        _actor(request),
        organization=organization,
        product=product,
        status=status,
        search=search or None,
    )
    paginator = Paginator(templates, PAGE_SIZE)
    page_obj = paginator.get_page(request.GET.get("page"))
    manage_org_ids = manageable_organization_ids(_actor(request))
    context = {
        "page_obj": page_obj,
        "templates": page_obj.object_list,
        "search": search,
        "status": status,
        "organizations": organizations,
        "selected_organization": organization,
        "products": filter_products,
        "selected_product": product,
        "filters_active": bool(search or org_id or product_id or status != "all"),
        "manageable_organization_ids": manage_org_ids,
        "can_create": bool(manage_org_ids),
        "total_count": paginator.count,
    }
    if request.headers.get("HX-Request") == "true":
        return render(request, "checklists/templates/_list_results.html", context)
    return render(request, "checklists/templates/list.html", context)


@login_required
@require_http_methods(["GET", "POST"])
def template_create(request: HttpRequest) -> HttpResponse:
    _require_manage_module(request)
    form = _template_form(request, request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            template = create_checklist_template(
                actor=_actor(request),
                organization=form.cleaned_data["organization"],
                code=form.cleaned_data["code"],
                name=form.cleaned_data["name"],
                description=form.cleaned_data.get("description") or "",
                product=form.cleaned_data.get("product"),
                is_active=bool(form.cleaned_data.get("is_active")),
            )
        except ValidationError as exc:
            _apply_validation_error(form, exc)
        except PermissionDenied:
            raise
        else:
            messages.success(request, f"Checklist template {template.code} created.")
            return redirect("checklists:template_detail", template_id=template.id)
    return render(
        request,
        "checklists/templates/form.html",
        {
            "form": form,
            "page_title": "Create checklist template",
            "submit_label": "Create template",
            "is_create": True,
        },
    )


@login_required
@require_GET
def template_detail(request: HttpRequest, template_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    template = _get_template_or_404(request, template_id)
    versions = list_checklist_versions(_actor(request), template)
    return render(
        request,
        "checklists/templates/detail.html",
        {
            "template": template,
            "versions": versions,
            "can_manage": actor_can_manage_template(_actor(request), template),
        },
    )


@login_required
@require_http_methods(["GET", "POST"])
def template_edit(request: HttpRequest, template_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    template = _get_template_or_404(request, template_id)
    if not actor_can_manage_template(_actor(request), template):
        raise PermissionDenied("Permission denied.")
    form = _template_form(request, request.POST or None, instance=template)
    if request.method == "POST" and form.is_valid():
        try:
            updated = update_checklist_template(
                actor=_actor(request),
                template_id=template.id,
                code=form.cleaned_data["code"],
                name=form.cleaned_data["name"],
                description=form.cleaned_data.get("description") or "",
                product=form.cleaned_data.get("product"),
            )
            if form.cleaned_data.get("is_active") and not updated.is_active:
                updated = activate_checklist_template(actor=_actor(request), template_id=updated.id)
            elif not form.cleaned_data.get("is_active") and updated.is_active:
                updated = deactivate_checklist_template(
                    actor=_actor(request), template_id=updated.id
                )
        except ValidationError as exc:
            _apply_validation_error(form, exc)
        else:
            messages.success(request, f"Checklist template {updated.code} updated.")
            return redirect("checklists:template_detail", template_id=updated.id)
    return render(
        request,
        "checklists/templates/form.html",
        {
            "form": form,
            "template": template,
            "page_title": f"Edit checklist template {template.code}",
            "submit_label": "Save changes",
            "is_create": False,
        },
    )


@login_required
@require_POST
def template_activate(request: HttpRequest, template_id: uuid.UUID) -> HttpResponse:
    template = _get_template_or_404(request, template_id)
    if not actor_can_manage_template(_actor(request), template):
        raise PermissionDenied("Permission denied.")
    activate_checklist_template(actor=_actor(request), template_id=template.id)
    messages.success(request, f"Checklist template {template.code} activated.")
    return redirect("checklists:template_detail", template_id=template.id)


@login_required
@require_POST
def template_deactivate(request: HttpRequest, template_id: uuid.UUID) -> HttpResponse:
    template = _get_template_or_404(request, template_id)
    if not actor_can_manage_template(_actor(request), template):
        raise PermissionDenied("Permission denied.")
    deactivate_checklist_template(actor=_actor(request), template_id=template.id)
    messages.success(request, f"Checklist template {template.code} deactivated.")
    return redirect("checklists:template_detail", template_id=template.id)


@login_required
@require_http_methods(["GET", "POST"])
def version_create(request: HttpRequest, template_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    template = _get_template_or_404(request, template_id)
    if not actor_can_manage_template(_actor(request), template):
        raise PermissionDenied("Permission denied.")
    versions = ChecklistVersion.objects.filter(template=template).order_by("-version_number")
    form = CreateVersionForm(
        request.POST if request.method == "POST" else None,
        versions=versions,
    )
    if request.method == "POST" and form.is_valid():
        source = form.cleaned_data.get("source_version")
        try:
            version = create_checklist_version(
                actor=_actor(request),
                template_id=template.id,
                source_version_id=source.id if source else None,
            )
        except ValidationError as exc:
            _apply_validation_error(form, exc)
        else:
            messages.success(request, f"Draft version v{version.version_number} created.")
            return redirect("checklists:version_detail", version_id=version.id)
    return render(
        request,
        "checklists/versions/create.html",
        {"form": form, "template": template},
    )


@login_required
@require_GET
def version_detail(request: HttpRequest, version_id: uuid.UUID) -> HttpResponse:
    _require_view_module(request)
    version = _get_version_or_404(request, version_id)
    can_manage = actor_can_manage_version(_actor(request), version)
    is_proposal_draft = is_fg_qa_001_proposal_template(version.template) and version.is_draft
    context = {
        "version": version,
        "template": version.template,
        "sections": version.sections.all(),
        "can_manage": can_manage,
        "can_edit_structure": can_manage and version.is_draft,
        "section_form": ChecklistSectionForm(),
        "is_fg_qa_001_proposal_draft": is_proposal_draft,
        "show_proposal_review_banner": is_fg_qa_001_proposal_template(version.template),
    }
    return render(request, "checklists/versions/detail.html", context)


@login_required
@require_POST
def version_publish(request: HttpRequest, version_id: uuid.UUID) -> HttpResponse:
    version = _get_version_or_404(request, version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    try:
        publish_checklist_version(actor=_actor(request), version_id=version.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    else:
        messages.success(request, f"Version v{version.version_number} published.")
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_POST
def version_retire(request: HttpRequest, version_id: uuid.UUID) -> HttpResponse:
    version = _get_version_or_404(request, version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    try:
        retire_checklist_version(actor=_actor(request), version_id=version.id)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    else:
        messages.success(request, f"Version v{version.version_number} retired.")
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_POST
def section_add(request: HttpRequest, version_id: uuid.UUID) -> HttpResponse:
    version = _get_version_or_404(request, version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    if not version.is_draft:
        raise PermissionDenied("Permission denied.")
    form = ChecklistSectionForm(request.POST)
    if form.is_valid():
        try:
            add_checklist_section(
                actor=_actor(request),
                version_id=version.id,
                title=form.cleaned_data["title"],
                description=form.cleaned_data.get("description") or "",
            )
            messages.success(request, "Section added.")
        except ValidationError as exc:
            messages.error(
                request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
            )
    else:
        messages.error(request, "Section could not be added. Check the title.")
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_http_methods(["GET", "POST"])
def section_edit(request: HttpRequest, section_id: uuid.UUID) -> HttpResponse:
    section = (
        ChecklistSection.objects.select_related("version", "version__template")
        .filter(pk=section_id)
        .first()
    )
    if section is None:
        raise Http404("Section not found.")
    version = _get_version_or_404(request, section.version_id)
    if not actor_can_manage_version(_actor(request), version) or not version.is_draft:
        raise PermissionDenied("Permission denied.")
    form = ChecklistSectionForm(request.POST or None, instance=section)
    if request.method == "POST" and form.is_valid():
        try:
            update_checklist_section(
                actor=_actor(request),
                section_id=section.id,
                title=form.cleaned_data["title"],
                description=form.cleaned_data.get("description") or "",
            )
            messages.success(request, "Section updated.")
            return redirect("checklists:version_detail", version_id=version.id)
        except ValidationError as exc:
            _apply_validation_error(form, exc)
    return render(
        request,
        "checklists/versions/section_form.html",
        {"form": form, "section": section, "version": version},
    )


@login_required
@require_POST
def section_delete(request: HttpRequest, section_id: uuid.UUID) -> HttpResponse:
    section = (
        ChecklistSection.objects.select_related("version", "version__template")
        .filter(pk=section_id)
        .first()
    )
    if section is None:
        raise Http404("Section not found.")
    version = _get_version_or_404(request, section.version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    if not version.is_draft:
        raise PermissionDenied("Permission denied.")
    try:
        remove_checklist_section(actor=_actor(request), section_id=section.id)
        messages.success(request, "Section removed.")
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_POST
def section_move(request: HttpRequest, section_id: uuid.UUID) -> HttpResponse:
    section = (
        ChecklistSection.objects.select_related("version", "version__template")
        .filter(pk=section_id)
        .first()
    )
    if section is None:
        raise Http404("Section not found.")
    version = _get_version_or_404(request, section.version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    if not version.is_draft:
        raise PermissionDenied("Permission denied.")
    direction = (request.POST.get("direction") or "").strip().lower()
    try:
        move_checklist_section(actor=_actor(request), section_id=section.id, direction=direction)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_POST
def item_add(request: HttpRequest, section_id: uuid.UUID) -> HttpResponse:
    section = (
        ChecklistSection.objects.select_related("version", "version__template")
        .filter(pk=section_id)
        .first()
    )
    if section is None:
        raise Http404("Section not found.")
    version = _get_version_or_404(request, section.version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    if not version.is_draft:
        raise PermissionDenied("Permission denied.")
    form = ChecklistItemForm(request.POST)
    if form.is_valid():
        try:
            add_checklist_item(
                actor=_actor(request),
                section_id=section.id,
                code=form.cleaned_data["code"],
                label=form.cleaned_data["label"],
                help_text=form.cleaned_data.get("help_text") or "",
                is_required=bool(form.cleaned_data.get("is_required")),
                response_type=form.cleaned_data.get("response_type") or "",
                unit=form.cleaned_data.get("unit") or "",
                minimum_value=form.cleaned_data.get("minimum_value"),
                maximum_value=form.cleaned_data.get("maximum_value"),
                decimal_precision=form.cleaned_data.get("decimal_precision"),
                rounding_mode=form.cleaned_data.get("rounding_mode") or "",
                min_inclusive=bool(form.cleaned_data.get("min_inclusive", True)),
                max_inclusive=bool(form.cleaned_data.get("max_inclusive", True)),
                control_point_class=form.cleaned_data.get("control_point_class") or "NONE",
                criticality=form.cleaned_data.get("criticality") or "",
            )
            messages.success(request, "Item added.")
        except ValidationError as exc:
            messages.error(
                request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
            )
    else:
        messages.error(request, "Item could not be added. Check required fields.")
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_http_methods(["GET", "POST"])
def item_edit(request: HttpRequest, item_id: uuid.UUID) -> HttpResponse:
    item = prefetch_related_compat(
        ChecklistItem.objects.select_related(
            "section", "section__version", "section__version__template"
        ).filter(pk=item_id),
        "options",
    ).first()
    if item is None:
        raise Http404("Item not found.")
    version = _get_version_or_404(request, item.section.version_id)
    if not actor_can_manage_version(_actor(request), version) or not version.is_draft:
        raise PermissionDenied("Permission denied.")
    form = ChecklistItemForm(request.POST or None, instance=item)
    option_form = ChecklistItemOptionForm()
    if request.method == "POST" and form.is_valid():
        try:
            update_checklist_item(
                actor=_actor(request),
                item_id=item.id,
                code=form.cleaned_data["code"],
                label=form.cleaned_data["label"],
                help_text=form.cleaned_data.get("help_text") or "",
                is_required=bool(form.cleaned_data.get("is_required")),
                response_type=form.cleaned_data.get("response_type") or "",
                unit=form.cleaned_data.get("unit") or "",
                minimum_value=form.cleaned_data.get("minimum_value"),
                maximum_value=form.cleaned_data.get("maximum_value"),
                decimal_precision=form.cleaned_data.get("decimal_precision"),
                rounding_mode=form.cleaned_data.get("rounding_mode") or "",
                min_inclusive=bool(form.cleaned_data.get("min_inclusive", True)),
                max_inclusive=bool(form.cleaned_data.get("max_inclusive", True)),
                control_point_class=form.cleaned_data.get("control_point_class") or "NONE",
                criticality=form.cleaned_data.get("criticality") or "",
            )
            messages.success(request, "Item updated.")
            return redirect("checklists:item_edit", item_id=item.id)
        except ValidationError as exc:
            _apply_validation_error(form, exc)
    item.refresh_from_db()
    return render(
        request,
        "checklists/versions/item_form.html",
        {
            "form": form,
            "option_form": option_form,
            "item": item,
            "version": version,
            "is_select": item.response_type == ChecklistResponseType.SELECT,
            "show_number_fields": item.response_type == ChecklistResponseType.NUMBER
            or (form.data.get("response_type") == ChecklistResponseType.NUMBER),
            "options": list(item.options.order_by("position")),
        },
    )


@login_required
@require_POST
def item_delete(request: HttpRequest, item_id: uuid.UUID) -> HttpResponse:
    item = (
        ChecklistItem.objects.select_related(
            "section", "section__version", "section__version__template"
        )
        .filter(pk=item_id)
        .first()
    )
    if item is None:
        raise Http404("Item not found.")
    version = _get_version_or_404(request, item.section.version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    if not version.is_draft:
        raise PermissionDenied("Permission denied.")
    try:
        remove_checklist_item(actor=_actor(request), item_id=item.id)
        messages.success(request, "Item removed.")
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_POST
def item_move(request: HttpRequest, item_id: uuid.UUID) -> HttpResponse:
    item = (
        ChecklistItem.objects.select_related(
            "section", "section__version", "section__version__template"
        )
        .filter(pk=item_id)
        .first()
    )
    if item is None:
        raise Http404("Item not found.")
    version = _get_version_or_404(request, item.section.version_id)
    if not actor_can_manage_version(_actor(request), version):
        raise PermissionDenied("Permission denied.")
    if not version.is_draft:
        raise PermissionDenied("Permission denied.")
    direction = (request.POST.get("direction") or "").strip().lower()
    try:
        move_checklist_item(actor=_actor(request), item_id=item.id, direction=direction)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    return redirect("checklists:version_detail", version_id=version.id)


@login_required
@require_POST
def option_add(request: HttpRequest, item_id: uuid.UUID) -> HttpResponse:
    item = (
        ChecklistItem.objects.select_related(
            "section", "section__version", "section__version__template"
        )
        .filter(pk=item_id)
        .first()
    )
    if item is None:
        raise Http404("Item not found.")
    version = _get_version_or_404(request, item.section.version_id)
    if not actor_can_manage_version(_actor(request), version) or not version.is_draft:
        raise PermissionDenied("Permission denied.")
    form = ChecklistItemOptionForm(request.POST)
    if form.is_valid():
        try:
            add_checklist_item_option(
                actor=_actor(request),
                item_id=item.id,
                value=form.cleaned_data["value"],
                label=form.cleaned_data["label"],
            )
            messages.success(request, "Option added.")
        except ValidationError as exc:
            messages.error(
                request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
            )
    else:
        messages.error(request, "Option could not be added.")
    return redirect("checklists:item_edit", item_id=item.id)


@login_required
@require_http_methods(["GET", "POST"])
def option_edit(request: HttpRequest, option_id: uuid.UUID) -> HttpResponse:
    option = (
        ChecklistItemOption.objects.select_related(
            "item",
            "item__section",
            "item__section__version",
            "item__section__version__template",
        )
        .filter(pk=option_id)
        .first()
    )
    if option is None:
        raise Http404("Option not found.")
    version = _get_version_or_404(request, option.item.section.version_id)
    if not actor_can_manage_version(_actor(request), version) or not version.is_draft:
        raise PermissionDenied("Permission denied.")
    form = ChecklistItemOptionForm(request.POST or None, instance=option)
    if request.method == "POST" and form.is_valid():
        try:
            update_checklist_item_option(
                actor=_actor(request),
                option_id=option.id,
                value=form.cleaned_data["value"],
                label=form.cleaned_data["label"],
            )
            messages.success(request, "Option updated.")
            return redirect("checklists:item_edit", item_id=option.item_id)
        except ValidationError as exc:
            _apply_validation_error(form, exc)
    return render(
        request,
        "checklists/versions/option_form.html",
        {"form": form, "option": option, "item": option.item, "version": version},
    )


@login_required
@require_POST
def option_delete(request: HttpRequest, option_id: uuid.UUID) -> HttpResponse:
    option = (
        ChecklistItemOption.objects.select_related(
            "item",
            "item__section",
            "item__section__version",
            "item__section__version__template",
        )
        .filter(pk=option_id)
        .first()
    )
    if option is None:
        raise Http404("Option not found.")
    version = _get_version_or_404(request, option.item.section.version_id)
    if not actor_can_manage_version(_actor(request), version) or not version.is_draft:
        raise PermissionDenied("Permission denied.")
    item_id = option.item_id
    try:
        remove_checklist_item_option(actor=_actor(request), option_id=option.id)
        messages.success(request, "Option removed.")
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    return redirect("checklists:item_edit", item_id=item_id)


@login_required
@require_POST
def option_move(request: HttpRequest, option_id: uuid.UUID) -> HttpResponse:
    option = (
        ChecklistItemOption.objects.select_related(
            "item",
            "item__section",
            "item__section__version",
            "item__section__version__template",
        )
        .filter(pk=option_id)
        .first()
    )
    if option is None:
        raise Http404("Option not found.")
    version = _get_version_or_404(request, option.item.section.version_id)
    if not actor_can_manage_version(_actor(request), version) or not version.is_draft:
        raise PermissionDenied("Permission denied.")
    direction = (request.POST.get("direction") or "").strip().lower()
    try:
        move_checklist_item_option(actor=_actor(request), option_id=option.id, direction=direction)
    except ValidationError as exc:
        messages.error(request, "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc))
    return redirect("checklists:item_edit", item_id=option.item_id)

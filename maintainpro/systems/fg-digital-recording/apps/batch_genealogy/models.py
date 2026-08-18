"""Batch / product genealogy — Phase 36.

Authoritative ERP/integration-sourced genealogy only. No invented links.
PostgreSQL stores SoR nodes/edges; Mongo uses flat edge documents (never
unbounded embedded trees).
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class GenealogyNodeKind(models.TextChoices):
    RAW_MATERIAL_LOT = "RAW_MATERIAL_LOT", "Raw material lot"
    SUPPLIER_LOT = "SUPPLIER_LOT", "Supplier lot"
    PRODUCTION_BATCH = "PRODUCTION_BATCH", "Production batch"
    REWORK_BATCH = "REWORK_BATCH", "Rework batch"
    FG_BATCH = "FG_BATCH", "Finished goods batch"
    SUB_LOT_PALLET = "SUB_LOT_PALLET", "Sub-lot / pallet"
    SHIPMENT_CUSTOMER = "SHIPMENT_CUSTOMER", "Shipment / customer reference"


class GenealogyRelationKind(models.TextChoices):
    """Directed: from_node contributes into / becomes to_node."""

    CONSUMED_INTO = "CONSUMED_INTO", "Consumed into"
    PRODUCED_AS = "PRODUCED_AS", "Produced as"
    REWORKED_FROM = "REWORKED_FROM", "Reworked from (parent → rework child)"
    PACKED_AS = "PACKED_AS", "Packed as sub-lot/pallet"
    SHIPPED_AS = "SHIPPED_AS", "Shipped as"


class GenealogyNode(models.Model):
    """
    Opaque genealogy node keyed by ERP/external identity.

    Partner fields (supplier/customer) are restricted — redacted unless the
    caller holds view_genealogy_partner.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="batch_genealogy_nodes",
    )
    kind = models.CharField(max_length=32, choices=GenealogyNodeKind.choices)
    external_key = models.CharField(
        max_length=128,
        help_text="Opaque ERP/external lot/batch/shipment key — not invented.",
    )
    display_label = models.CharField(max_length=255, blank=True, default="")
    # Restricted partner references (supplier / customer) — never invent.
    supplier_reference = models.CharField(max_length=128, blank=True, default="")
    customer_reference = models.CharField(max_length=128, blank=True, default="")
    receipt_reference = models.CharField(max_length=128, blank=True, default="")
    product_reference = models.CharField(max_length=128, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Genealogy node"
        verbose_name_plural = "Genealogy nodes"
        constraints = [
            models.UniqueConstraint(
                Lower("external_key"),
                "organization",
                "kind",
                name="batch_gen_node_org_kind_key_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "kind"]),
            models.Index(fields=["organization", "external_key"]),
        ]
        permissions = [
            ("view_batchgenealogy", "Can view batch genealogy traces"),
            ("ingest_batchgenealogy", "Can ingest ERP genealogy edges"),
            ("view_genealogy_partner", "Can view supplier/customer genealogy refs"),
            ("manage_batchgenealogypolicy", "Can manage genealogy policy stubs"),
        ]

    def __str__(self) -> str:
        return f"{self.kind}:{self.external_key}"

    def clean(self) -> None:
        super().clean()
        key = (self.external_key or "").strip()
        if not key:
            raise ValidationError({"external_key": "External key is required (ERP/opaque)."})
        self.external_key = key


class GenealogyEdge(models.Model):
    """
    Directed ERP-sourced genealogy edge.

    Must cite source_system + source_event_id — genealogy is never invented.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="batch_genealogy_edges",
    )
    from_node = models.ForeignKey(
        GenealogyNode,
        on_delete=models.PROTECT,
        related_name="outgoing_edges",
    )
    to_node = models.ForeignKey(
        GenealogyNode,
        on_delete=models.PROTECT,
        related_name="incoming_edges",
    )
    relation = models.CharField(max_length=32, choices=GenealogyRelationKind.choices)
    source_system = models.CharField(max_length=64)
    source_event_id = models.CharField(max_length=128)
    integration_attempt_id = models.UUIDField(null=True, blank=True)
    external_batch_event_id = models.UUIDField(null=True, blank=True)
    quantity_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque quantity/UOM reference from ERP — no invented math.",
    )
    is_rework = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    ingested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="batch_genealogy_edges_ingested",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Genealogy edge"
        verbose_name_plural = "Genealogy edges"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "source_system", "source_event_id"],
                name="batch_gen_edge_org_source_event_uniq",
            ),
            models.CheckConstraint(
                condition=~models.Q(from_node=models.F("to_node")),
                name="batch_gen_edge_no_self_loop",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "from_node"]),
            models.Index(fields=["organization", "to_node"]),
            models.Index(fields=["organization", "relation"]),
            models.Index(fields=["organization", "is_rework"]),
        ]

    def __str__(self) -> str:
        return f"{self.from_node_id}->{self.to_node_id}:{self.relation}"

    def clean(self) -> None:
        super().clean()
        if self.from_node_id and self.to_node_id and self.from_node_id == self.to_node_id:
            raise ValidationError({"to_node": "Self-loop edges are not allowed."})
        if self.from_node_id and self.organization_id:
            if self.from_node.organization_id != self.organization_id:
                raise ValidationError({"from_node": "Node organization mismatch."})
        if self.to_node_id and self.organization_id:
            if self.to_node.organization_id != self.organization_id:
                raise ValidationError({"to_node": "Node organization mismatch."})
        if not (self.source_system or "").strip() or not (self.source_event_id or "").strip():
            raise ValidationError(
                {
                    "source_system": (
                        "ERP/integration source_system and source_event_id are required."
                    ),
                    "source_event_id": (
                        "ERP/integration source_system and source_event_id are required."
                    ),
                }
            )


class GenealogyPolicy(models.Model):
    """Org policy stubs — Mongo projection dual-gated OFF (APR-061)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="batch_genealogy_policy",
    )
    mongo_projection_enabled = models.BooleanField(
        default=False,
        help_text="Org stub only — still requires BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED.",
    )
    max_trace_depth = models.PositiveIntegerField(
        default=25,
        help_text="Technical bound only — not a company SLA invent.",
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="batch_genealogy_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Genealogy policy"
        verbose_name_plural = "Genealogy policies"

    def __str__(self) -> str:
        return f"{self.organization.code} genealogy policy"

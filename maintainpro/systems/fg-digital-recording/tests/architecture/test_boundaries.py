"""Architecture boundary tests."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APPS = ROOT / "apps"
ALLOWED_APPS = {
    "core",
    "accounts",
    "organizations",
    "master_data",
    "instruments",
    "training",
    "checklists",
    "scheduling",
    "recording",
    "reviews",
    "quality",
    "evidence",
    "nonconformance",
    "capa",
    "dispatch",
    "notifications",
    "reports",
    "integrations",
    "ai_assistance",
    "laboratory",
    "haccp",
    "sampling",
    "foreign_body",
    "sanitation",
    "environmental",
    "packaging",
    "changeover",
    "receiving",
    "iqc",
    "ipqc",
    "batch_dossier",
    "batch_genealogy",
    "recall",
    "customer_complaints",
    "product_returns",
    "quality_quarantine",
    "rework",
    "document_control",
    "change_control",
    "quality_audits",
    "compliance_mapping",
    "quality_risks",
    "process_fmea",
    "rca",
    "supplier_quality",
    "access_control",
    "security_audit",
}
# Isolated technical POC scaffolding (not production INSTALLED_APPS / SoR).
OPTIONAL_TECHNICAL_APPS = {
    "mongo_poc",
}
# Concurrent uncommitted local WIP directories must not fail this boundary check,
# and are not authorized production apps by this assertion alone.
OPTIONAL_LOCAL_WIP_APPS = {
    "analytics",
    "feature_flags",
}
FORBIDDEN_APPS = {
    "tasks",
    "records",
    "reporting",
    "schedules",
}


def test_apps_namespace_exists() -> None:
    assert (APPS / "__init__.py").exists()
    for name in ALLOWED_APPS:
        assert (APPS / name).is_dir(), f"Expected app directory missing: {name}"


def test_no_future_business_apps() -> None:
    present = {p.name for p in APPS.iterdir() if p.is_dir() and not p.name.startswith("_")}
    assert ALLOWED_APPS.issubset(present)
    assert FORBIDDEN_APPS.isdisjoint(present)
    unknown = present - ALLOWED_APPS - OPTIONAL_TECHNICAL_APPS - OPTIONAL_LOCAL_WIP_APPS
    assert unknown == set(), f"Unexpected app directories (classify or remove): {sorted(unknown)}"


def test_no_sqlite_engine_configured_in_settings_modules() -> None:
    settings_dir = ROOT / "config" / "settings"
    packaging_only = {"release_build.py"}
    for path in settings_dir.glob("*.py"):
        if path.name in packaging_only:
            continue
        text = path.read_text(encoding="utf-8")
        assert "django.db.backends.sqlite3" not in text
        assert "backends.sqlite" not in text


def test_config_has_no_business_models() -> None:
    config_dir = ROOT / "config"
    for path in config_dir.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        assert "class Meta:" not in text or "settings" in str(path)


def test_core_does_not_import_accounts_business_logic() -> None:
    core_dir = APPS / "core"
    for path in core_dir.rglob("*.py"):
        if "migrations" in path.parts or "tests" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        assert "from apps.accounts" not in text
        assert "import apps.accounts" not in text


def test_redis_not_modeled_as_orm_repository() -> None:
    models = (APPS / "core" / "models.py").read_text(encoding="utf-8").lower()
    assert "redis" not in models


def test_no_microservices_layout_claimed() -> None:
    assert not (ROOT / "services").exists()

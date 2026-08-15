"""Shared Django settings for all environments."""

from __future__ import annotations

from pathlib import Path

import environ
import structlog

from config.settings.database import build_caches, build_databases

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    DJANGO_CSRF_TRUSTED_ORIGINS=(list, []),
    POSTGRES_PORT=(int, 5432),
    DB_CONN_MAX_AGE=(int, 60),
    DB_CONNECT_TIMEOUT=(int, 10),
    DB_CONN_HEALTH_CHECKS=(bool, True),
    REDIS_CACHE_TIMEOUT=(int, 300),
    CELERY_TASK_TIME_LIMIT=(int, 300),
    CELERY_TASK_SOFT_TIME_LIMIT=(int, 240),
    CELERY_TASK_TRACK_STARTED=(bool, True),
    CELERY_WORKER_SEND_TASK_EVENTS=(bool, True),
    APP_VERSION=(str, "0.2.0"),
    ENVIRONMENT_LABEL=(str, "unspecified"),
    DJANGO_TIME_ZONE=(str, "Asia/Colombo"),
    DJANGO_LANGUAGE_CODE=(str, "en"),
    LOG_LEVEL=(str, "INFO"),
    AUTH_MAX_FAILED_ATTEMPTS=(int, 5),
    AUTH_LOCKOUT_MINUTES=(int, 15),
    AUTH_LOGIN_RATE_LIMIT_WINDOW=(int, 300),
    AUTH_LOGIN_RATE_LIMIT_MAX=(int, 40),
    AUTH_PASSWORD_CHANGE_REQUIRED_ON_ADMIN_RESET=(bool, True),
)

# Intentionally do not read .env here. Local/test settings may load .env.
# Production must receive configuration from the process environment only.

SECRET_KEY = env("DJANGO_SECRET_KEY", default="")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

APP_VERSION = env.str("APP_VERSION", default="0.2.0")
ENVIRONMENT_LABEL = env.str("ENVIRONMENT_LABEL", default="unspecified")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_htmx",
    "apps.core",
    "apps.accounts",
    "apps.organizations",
    "apps.master_data",
    "apps.instruments",
    "apps.training",
    "apps.checklists",
    "apps.scheduling",
    "apps.recording",
    "apps.reviews",
    "apps.quality",
    "apps.evidence",
    "apps.laboratory",
    "apps.haccp",
    "apps.sampling",
    "apps.foreign_body",
    "apps.sanitation",
    "apps.environmental",
    "apps.packaging",
    "apps.changeover",
    "apps.receiving",
    "apps.iqc",
    "apps.ipqc",
    "apps.batch_dossier",
    "apps.batch_genealogy",
    "apps.recall",
    "apps.customer_complaints",
    "apps.product_returns",
    "apps.quality_quarantine",
    "apps.rework",
    "apps.document_control",
    "apps.change_control",
    "apps.quality_audits",
    "apps.compliance_mapping",
    "apps.quality_risks",
    "apps.process_fmea",
    "apps.rca",
    "apps.nonconformance",
    "apps.capa",
    "apps.dispatch",
    "apps.notifications",
    "apps.reports",
    "apps.integrations",
    "apps.ai_assistance",
    "apps.supplier_quality",
    "apps.access_control",
    "apps.security_audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.ForcedPasswordChangeMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_htmx.middleware.HtmxMiddleware",
    "apps.core.middleware.CorrelationIdMiddleware",
    "apps.core.middleware.RequestLoggingMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
]

AUTHENTICATION_BACKENDS = [
    "apps.accounts.backends.EmployeeCodeBackend",
    "django.contrib.auth.backends.ModelBackend",
]

AUTH_MAX_FAILED_ATTEMPTS = env.int("AUTH_MAX_FAILED_ATTEMPTS", default=5)
AUTH_LOCKOUT_MINUTES = env.int("AUTH_LOCKOUT_MINUTES", default=15)
AUTH_LOGIN_RATE_LIMIT_WINDOW = env.int("AUTH_LOGIN_RATE_LIMIT_WINDOW", default=300)
AUTH_LOGIN_RATE_LIMIT_MAX = env.int("AUTH_LOGIN_RATE_LIMIT_MAX", default=40)
AUTH_PASSWORD_CHANGE_REQUIRED_ON_ADMIN_RESET = env.bool(
    "AUTH_PASSWORD_CHANGE_REQUIRED_ON_ADMIN_RESET",
    default=True,
)

LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "accounts:landing"
LOGOUT_REDIRECT_URL = "accounts:login"

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.core.context_processors.foundation",
            ],
        },
    },
]

DATABASES = build_databases(env)

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = env.str("DJANGO_LANGUAGE_CODE", default="en")
TIME_ZONE = env.str("DJANGO_TIME_ZONE", default="Asia/Colombo")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static" / "dist"]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Email — optional. No credentials in repo; set via environment when SMTP is approved.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@localhost")
SERVER_EMAIL = env("SERVER_EMAIL", default=DEFAULT_FROM_EMAIL)

# Phase 11 — private evidence storage (never mapped as world-readable MEDIA_URL).
# Production object-store IAM/lifecycle remain EVIDENCE REQUIRED (DEC-008 / ASM-017).
EVIDENCE_STORAGE_ROOT = Path(
    env("EVIDENCE_STORAGE_ROOT", default=str(BASE_DIR / "media" / "evidence_private"))
)
EVIDENCE_MAX_UPLOAD_BYTES = env.int("EVIDENCE_MAX_UPLOAD_BYTES", default=10 * 1024 * 1024)
EVIDENCE_MALWARE_SCANNER = env("EVIDENCE_MALWARE_SCANNER", default="")
# Empty scanner path => NullMalwareScanner (NOT_CONFIGURED). Do not claim scanning active.

# Phase 17 — Bileeta / ERP adapter boundary (live HTTP OFF by default).
# Do not invent base URLs or enable live calls without APR-011/APR-012 evidence.
BILEETA_LIVE_ENABLED = env.bool("BILEETA_LIVE_ENABLED", default=False)
BILEETA_BASE_URL = env("BILEETA_BASE_URL", default="")
BILEETA_HTTP_TIMEOUT_SECONDS = env.float("BILEETA_HTTP_TIMEOUT_SECONDS", default=10.0)
BILEETA_VERIFY_TLS = env.bool("BILEETA_VERIFY_TLS", default=True)
# Auth material must come from env/vault only — never commit real secrets.
BILEETA_CLIENT_ID = env("BILEETA_CLIENT_ID", default="")
BILEETA_CLIENT_SECRET = env("BILEETA_CLIENT_SECRET", default="")

# Phase 18 — optional AI assistance (OFF by default; advisory only).
AI_ASSISTANCE_ENABLED = env.bool("AI_ASSISTANCE_ENABLED", default=False)
AI_ASSISTANCE_PROVIDER = env("AI_ASSISTANCE_PROVIDER", default="null")  # null|mock
AI_ASSISTANCE_TIMEOUT_SECONDS = env.float("AI_ASSISTANCE_TIMEOUT_SECONDS", default=15.0)
AI_ASSISTANCE_STORE_PROMPTS = env.bool("AI_ASSISTANCE_STORE_PROMPTS", default=False)
OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", default="")
OLLAMA_MODEL = env("OLLAMA_MODEL", default="")

REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6379/0")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHE_KEY_PREFIX = "nelna_fg"

CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_ENABLE_UTC = True
CELERY_TASK_TRACK_STARTED = env.bool("CELERY_TASK_TRACK_STARTED", default=True)
CELERY_WORKER_SEND_TASK_EVENTS = env.bool("CELERY_WORKER_SEND_TASK_EVENTS", default=True)
CELERY_TASK_TIME_LIMIT = env.int("CELERY_TASK_TIME_LIMIT", default=300)
CELERY_TASK_SOFT_TIME_LIMIT = env.int("CELERY_TASK_SOFT_TIME_LIMIT", default=240)
CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
# Infrastructure poll only — not a Nelna checklist frequency (Phase 07E).
from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    "generate-due-checklist-tasks": {
        "task": "apps.scheduling.tasks.generate_due_checklist_tasks",
        "schedule": crontab(minute="*/5"),
        "options": {"expires": 240},
    },
}

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"

# Phase 19 — browser security headers (middleware). Style inline retained for current UI.
CONTENT_SECURITY_POLICY = env(
    "CONTENT_SECURITY_POLICY",
    default=(
        "default-src 'self'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "img-src 'self' data:; "
        "font-src 'self' data:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; "
        "connect-src 'self'; "
        "object-src 'none'"
    ),
)
PERMISSIONS_POLICY = env(
    "PERMISSIONS_POLICY",
    default="camera=(), microphone=(), geolocation=(), payment=(), usb=()",
)
# Session absolute timeout — idle/absolute policy values remain OWNER/IT DECISION REQUIRED.
SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=28800)  # 8 hours technical default
SESSION_SAVE_EVERY_REQUEST = env.bool("SESSION_SAVE_EVERY_REQUEST", default=True)
HEALTHCHECK_MONGODB_ENABLED = env.bool("HEALTHCHECK_MONGODB_ENABLED", default=False)
# Phase 22 — positive-release runtime blocking remains OFF until company QA approval.
LAB_POSITIVE_RELEASE_BLOCKING_APPROVED = env.bool(
    "LAB_POSITIVE_RELEASE_BLOCKING_APPROVED",
    default=False,
)
# Phase 25 — calibration enforcement for measurement devices.
# OFF (default) | WARN | BLOCK. Do not invent company blocking policy.
INSTRUMENTS_CALIBRATION_ENFORCEMENT = env(
    "INSTRUMENTS_CALIBRATION_ENFORCEMENT",
    default="OFF",
)
# Manual override of BLOCK only when company policy explicitly approves.
INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED = env.bool(
    "INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED",
    default=False,
)
# Phase 26 — foreign-body FAIL auto-HOLD remains OFF until company HACCP evidence.
FOREIGN_BODY_AUTO_HOLD_APPROVED = env.bool(
    "FOREIGN_BODY_AUTO_HOLD_APPROVED",
    default=False,
)
# Phase 27 — sanitation FAIL production-stop remains OFF until company SOP approval.
SANITATION_FAIL_STOP_PRODUCTION_APPROVED = env.bool(
    "SANITATION_FAIL_STOP_PRODUCTION_APPROVED",
    default=False,
)
# Phase 28 — environmental excursion auto-HOLD remains OFF until company approval.
ENVIRONMENTAL_AUTO_HOLD_APPROVED = env.bool(
    "ENVIRONMENTAL_AUTO_HOLD_APPROVED",
    default=False,
)
# Phase 30 — allergen matrix / changeover production-block remains OFF until company approval.
CHANGEOVER_ALLERGEN_BLOCK_APPROVED = env.bool(
    "CHANGEOVER_ALLERGEN_BLOCK_APPROVED",
    default=False,
)
# Phase 33 — IQC ERP outbound remains OFF until Phase 17 contract + company approval.
IQC_ERP_OUTBOUND_APPROVED = env.bool(
    "IQC_ERP_OUTBOUND_APPROVED",
    default=False,
)
# Phase 34 — IPQC fail → production stop remains OFF until company policy approval.
IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED = env.bool(
    "IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED",
    default=False,
)
# Phase 35 — batch dossier PDF evidence-pack export remains OFF until company approval.
BATCH_DOSSIER_PDF_EXPORT_APPROVED = env.bool(
    "BATCH_DOSSIER_PDF_EXPORT_APPROVED",
    default=False,
)
# Phase 36 — genealogy Mongo projection remains OFF until company / ERP evidence approval.
BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED = env.bool(
    "BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED",
    default=False,
)
# Phase 37 — recall external notification / ERP distribution pull remain OFF.
RECALL_EXTERNAL_NOTIFICATION_APPROVED = env.bool(
    "RECALL_EXTERNAL_NOTIFICATION_APPROVED",
    default=False,
)
RECALL_ERP_DISTRIBUTION_PULL_APPROVED = env.bool(
    "RECALL_ERP_DISTRIBUTION_PULL_APPROVED",
    default=False,
)
# Phase 39 — customer complaint auto-response remains OFF until company approval.
COMPLAINT_CUSTOMER_RESPONSE_AUTO_SEND_APPROVED = env.bool(
    "COMPLAINT_CUSTOMER_RESPONSE_AUTO_SEND_APPROVED",
    default=False,
)

# Phase 40 -- return ERP stock movement remains OFF until company approval.
PRODUCT_RETURNS_ERP_STOCK_MOVEMENT_APPROVED = env.bool(
    "PRODUCT_RETURNS_ERP_STOCK_MOVEMENT_APPROVED",
    default=False,
)
# Phase 41 — quality quarantine release / ERP sync remain OFF until company approval.
QUALITY_QUARANTINE_RELEASE_APPROVED = env.bool(
    "QUALITY_QUARANTINE_RELEASE_APPROVED",
    default=False,
)
QUALITY_QUARANTINE_ERP_SYNC_APPROVED = env.bool(
    "QUALITY_QUARANTINE_ERP_SYNC_APPROVED",
    default=False,
)
# Phase 42 — rework ERP quantity/status updates remain OFF until company approval.
REWORK_ERP_STOCK_MOVEMENT_APPROVED = env.bool(
    "REWORK_ERP_STOCK_MOVEMENT_APPROVED",
    default=False,
)

CORRELATION_ID_HEADER = "HTTP_X_REQUEST_ID"
CORRELATION_ID_RESPONSE_HEADER = "X-Request-ID"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "console": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.dev.ConsoleRenderer(colors=False),
            "foreign_pre_chain": [
                structlog.contextvars.merge_contextvars,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso", utc=True),
            ],
        },
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.processors.JSONRenderer(),
            "foreign_pre_chain": [
                structlog.contextvars.merge_contextvars,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso", utc=True),
            ],
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env.str("LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "celery": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Django Contrib Mongo Configuration Plan

**Status:** Design for migration branch — not activated on `main`  
**Backend:** `django-mongodb-backend==5.2.3`  
**Production database:** `mgintginpro_prod` with FG `fg_` collections only

---

## Goal

Configure Mongo-compatible Django contrib apps without colliding with MaintainPro
and without breaking the PostgreSQL baseline on `main`.

## Apps requiring Mongo variants

| Django app | Concern | Mongo approach |
| --- | --- | --- |
| `django.contrib.contenttypes` | AutoField PK, migrations | Use Mongo backend AppConfig / migration modules per django-mongodb-backend docs |
| `django.contrib.auth` | Permission / Group AutoFields if used | Prefer FG custom User (UUID) already; configure contrib leftovers for ObjectIdAutoField |
| `django.contrib.admin` | LogEntry AutoField | Mongo-compatible admin migrations |
| `django.contrib.sessions` | Session store | Prefer cache/signed cookies or Mongo session backend if required |

## Constraints

1. Do **not** enable ObjectIdAutoField as global default on PostgreSQL `main`.
2. Mongo settings modules already set:
   `DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"`
3. FG domain models with explicit UUID PKs must **keep** UUID identity.
4. Contrib / through / Celery Beat models need explicit review before cutover
   (see `MONGODB_PRIMARY_KEY_PLAN.md` / `MONGO_PRIMARY_KEY_MATRIX.md`).

## Proposed settings pattern (Mongo only)

```python
# conceptual — implement in config.settings.mongo_same_db* only
INSTALLED_APPS = [
    "django_mongodb_backend.admin.MongoAdminConfig",  # if required by backend version
    # ... remaining apps ...
]
```

Exact AppConfig class names must match **5.2.3** documentation — verify before enabling.

## Verification checklist

- [ ] Login / logout / lockout
- [ ] Permission / role assignment
- [ ] ContentType resolution for FG permissions
- [ ] Admin LogEntry write path (if admin used)
- [ ] Sessions stable across requests
- [ ] No MaintainPro collection collision for contrib tables (`fg_*` namespace)

## Explicit non-goals this checkpoint

- Do not switch `main` INSTALLED_APPS
- Do not write to `mgintginpro_prod`
- Do not invent a second FG production database

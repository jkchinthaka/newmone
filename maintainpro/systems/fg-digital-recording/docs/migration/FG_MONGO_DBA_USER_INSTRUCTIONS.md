# FG MongoDB Database User — DBA Instructions (placeholders only)

**Status:** Prepared for later DBA execution — **do not create now**.  
**Database:** `mgintginpro_prod` (same logical DB as MaintainPro)  
**Do not** rotate or reuse MaintainPro root/admin credentials for the FG app.

---

## Principle

FG and MaintainPro may share the logical database `mgintginpro_prod`, but must use
**separate application database users**.

| Concern | Guidance |
| --- | --- |
| MaintainPro user | Unchanged — do not rotate for FG cutover |
| FG user | Dedicated principal, least privilege |
| Root / atlasAdmin | Never used by FG application runtime |

---

## Proposed FG user (placeholders)

```text
Username: <FG_MONGO_APP_USER>          # OWNER REQUIRED
Password: <FROM_VAULT_ONLY>            # NEVER commit
Authentication DB: admin               # or company standard — OWNER REQUIRED
Target database: mgintginpro_prod
Role: readWrite on mgintginpro_prod
```

Optional tighter scope (if company policy allows collection-prefix grants later):

```text
# Prefer database-level readWrite first; collection-prefix custom roles are optional
# and must be designed by DBA without breaking MaintainPro.
```

---

## Example role grant (DO NOT RUN YET — placeholder)

```javascript
// AUTHORIZATION REQUIRED — example only
use mgintginpro_prod
db.createUser({
  user: "<FG_MONGO_APP_USER>",
  pwd: passwordPrompt(),  // do not paste passwords into scripts committed to git
  roles: [
    { role: "readWrite", db: "mgintginpro_prod" }
  ]
})
```

---

## Application configuration (env only)

```text
MONGODB_URI=mongodb://<FG_MONGO_APP_USER>:<FROM_VAULT>@127.0.0.1:27018/mgintginpro_prod?authSource=admin
MONGODB_DATABASE=mgintginpro_prod
```

Never commit real URI/password values.

---

## Explicit non-actions for this phase

- Do not create the user now
- Do not connect FG app to company Mongo with root credentials
- Do not modify MaintainPro users/roles
- Do not grant FG user rights outside `mgintginpro_prod`

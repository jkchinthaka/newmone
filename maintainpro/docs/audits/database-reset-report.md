# Database reset report

Generated: 2026-07-21T05:18:52.412Z
Commit SHA: fcc206030bc3edd177448fdc9e42d1640beb7a44

## Environment

- NODE_ENV: (unset)
- APP_ENVIRONMENT: (unset)
- Classification: unknown
- Provider: mongodb
- Database name: unknown
- Host: unknown
- Identity fingerprint: db87e5821678
- Loaded env files: (none)

## Safety outcome

- Success: false
- Error: Refusing reset: ALLOW_DATABASE_RESET must be exactly 'true'.
- Bootstrap admin created: false

## Backup

```json
null
```

## Counts before

```json
null
```

## Counts after

```json
null
```

## Redis / queues

```json
null
```

## Object storage

```json
{
  "skipped": true,
  "reason": "run npm run storage:clear:test-data separately"
}
```

## Production verdict

NO-GO — reset did not complete successfully. Source data may still be intact.

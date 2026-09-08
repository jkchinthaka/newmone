# OpenAPI / contracts status

## Goal

```
NestJS DTOs / Swagger → contracts/openapi.json → Dart + TS clients
```

## Blocker (documented)

Swagger is **runtime-only** in `maintainpro/apps/api/src/main.ts`:

- `SwaggerModule.createDocument` after `NestFactory.create`
- UI at `/api/docs`, JSON at `/api/docs-json`
- Prod gated by `SWAGGER_ENABLED` + basic auth

There is **no** offline/static OpenAPI export script today. Generating `contracts/openapi.json` requires booting the API against a configured environment.

## Decision for Mobile V2 (safe)

1. Do **not** invent a hand-written OpenAPI that could diverge from Nest.
2. Do **not** change production Swagger behavior just to emit a file.
3. Continue Mobile V2 with hand-mapped Dio repositories for auth + work orders.
4. Track additive follow-up: `npm run openapi:export` in a **dev** bootstrap that writes `contracts/openapi.json` without mutating production DB.

## Interim contract notes

Envelope: `{ success, data, message, meta? }`  
Auth JSON tokens (mobile): `accessToken`, `refreshToken`, `user`  
Tenant header: `X-Tenant-Id`  
Idempotency header allowed by CORS; enforced mainly on inventory mutations.

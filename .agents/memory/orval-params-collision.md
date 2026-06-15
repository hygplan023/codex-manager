---
name: Orval Params collision fix
description: When an operation has BOTH path params AND query params, Orval generates colliding type names in both generated/api.ts and generated/types/, causing TS2308.
---

## The Rule

If an OpenAPI operation has both a path parameter (e.g. `{id}`) AND query parameters (e.g. `?tail=100`), Orval generates `{OperationIdPascal}Params` in BOTH `generated/api.ts` (Zod schema) and `generated/types/{operationIdCamel}Params.ts` (TypeScript type). When `lib/api-zod/src/index.ts` re-exports both with `export *`, it hits TS2308.

**Why:** Operations with only path params OR only query params do NOT collide. Only the mixed case.

**How to apply:** When writing the OpenAPI spec, for any operation that has a path param, remove its query params and hard-code the defaults in the backend instead. Alternatively, rename the operationId so the generated `Params` name doesn't clash — but this doesn't actually help since both files get the same name regardless.

## Concrete fix

- `deleteContainer` had `{id}` path + `?force` query → removed `force`, hard-code `force: true` in route
- `deleteImage` had `{id}` path + `?force` query → same fix
- `fetchContainerLogs` had `{id}` path + `?tail` query → removed `tail`, hard-code `tail: 100` in route
- `getOllamaLogs` had only `?tail` query (no path param) → NOT a collision, fine to keep

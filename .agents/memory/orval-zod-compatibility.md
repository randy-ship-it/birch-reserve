---
name: Orval Zod compatibility
description: OpenAPI schema constraints that avoid incompatible helpers in this workspace's generated Zod validators.
---

Prefer broadly compatible OpenAPI string and number primitives when adding contract fields; do not introduce UUID/URI/integer shortcuts without regenerating and typechecking the libraries immediately.

**Why:** This workspace's Orval/Zod combination generated calls to newer Zod helpers that the installed runtime did not support, even though the OpenAPI formats were otherwise valid.

**How to apply:** After any OpenAPI format change—or after merging work that touched API contracts or generated clients—run contract code generation and the library typecheck before trusting generated hooks. If generated helpers are unavailable, express the constraint with supported primitives plus route-level validation.

This workspace's OpenAPI mixes origin-root buying surfaces with `/api` application routes. Orval's explicit output `baseUrl` overrides operation-level servers, while omitting it ignores the global server in generated paths.

**Why:** A global `/api` output base silently generated invalid `/api/v1/...` buying URLs; removing it also generated invalid unprefixed private application URLs.

**How to apply:** Keep the generation transformer authoritative: root buying paths remain unchanged and all other paths receive `/api` before generation. Assert one URL from each class whenever route generation changes.
---
name: Shared UCP merge validation
description: Why UCP routes and generated contracts need focused validation after concurrent work is rebased.
---

Treat a clean source-control merge as insufficient evidence when concurrent work touches UCP routes, their OpenAPI contract, or generated clients. Regenerate the contract and validate the rebased machine-buying flow before completion.

**Why:** Neighboring UCP discovery, header-validation, and checkout-lifecycle edits can auto-merge without textual conflicts while leaving control flow or generated contracts semantically interleaved. A replay may even report clean completion while duplicating declarations or splicing one handler body into another.

**How to apply:** After rebasing concurrent UCP work, regenerate clients from the merged OpenAPI source, typecheck the API, and run the focused public-buying conformance tests.
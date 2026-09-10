---
name: API project-reference declarations
description: Why API typechecks can report stale database schema types after shared-library source changes.
---

The API TypeScript project can resolve shared database types through emitted project-reference declarations that lag behind the current schema source. A direct API typecheck may therefore report many missing tables or columns even when those exports exist in source.

**Why:** This produced a broad set of misleading schema errors until the database composite project was rebuilt; the unchanged API typecheck then passed. The database build-info file lives outside its declaration output directory, so an ordinary incremental build can also report success when the declaration directory itself is missing.

**How to apply:** Force the database declaration build before diagnosing API errors about missing shared schema members, then incrementally validate the remaining referenced libraries and rerun the API check.
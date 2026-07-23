---
name: lgs-1920-studio-browser-persistence
description: Design or debug feature-level LGS1920 browser persistence for settings, widget positions, hydration, legacy payload normalization, and recovery from storage failures. Use when a product feature consumes the existing persistence APIs. Use the lgs-1920-studio-internal-database skill instead for LocalDB internals, database schemas, export/import, or linked-folder synchronization.
---

# Browser Persistence

Use for feature-owned persisted state such as local settings, widget positions, profile hydration, and consumer-side migrations. Inspect the owning module, initialization order, and contract tests first.

For changes under `src/core/db/`, database inventory or versions, JSON/ZIP formats, and persistent-folder synchronization, use `$lgs-1920-studio-internal-database`.

Workflow:

1. Identify the persisted record, schema, owner, version, and reset behavior.
2. Validate data before writing and normalize missing or legacy fields on read.
3. Make async writes ordered so stale results cannot overwrite newer state.
4. Keep hydration separate from default initialization and expose safe fallback behavior.
5. Handle unavailable storage, corrupt records, quota errors, and database upgrades.
6. Test round trips, replacement, migration, concurrent writes, and recovery.

Never store secrets in general UI persistence and never let persistence errors break rendering.

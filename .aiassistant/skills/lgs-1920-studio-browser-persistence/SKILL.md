---
name: lgs-1920-studio-browser-persistence
description: Design or debug LGS1920 browser persistence using IndexedDB, local synchronization, widget positions, settings, migrations, hydration, and recovery from storage failures.
---

# Browser Persistence

Use for IndexedDB, local settings, widget positions, profile persistence, synchronization, and migrations. Inspect `src/core/ui/widget-manager/WidgetDBManager.js`, stores, initialization, and contract tests first.

Workflow:

1. Identify the persisted record, schema, owner, version, and reset behavior.
2. Validate data before writing and normalize missing or legacy fields on read.
3. Make async writes ordered so stale results cannot overwrite newer state.
4. Keep hydration separate from default initialization and expose safe fallback behavior.
5. Handle unavailable storage, corrupt records, quota errors, and database upgrades.
6. Test round trips, replacement, migration, concurrent writes, and recovery.

Never store secrets in general UI persistence and never let persistence errors break rendering.

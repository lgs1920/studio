---
name: lgs-1920-studio-internal-database
description: Maintain and explain the LGS1920 Studio internal IndexedDB layer, LocalDB API, database schemas, JSON and ZIP backup formats, persistent-folder synchronization, migrations, diagnostics, and recovery behavior. Use when changing files under src/core/db, adding or migrating a database or store, modifying persisted record formats, debugging data loss or stale reads, changing import/export or linked-folder sync, or reviewing the security and lifecycle of local data.
---

# LGS1920 Studio Internal Database

Work from `/home/christian/devs/assets/lgs1920/studio` and read `PROJECT_RULES.md` completely before acting.

Read `tech-doc/specs/data/CORE-INTERNAL-DATABASE-ARCHITECTURE.md` before any non-trivial database or synchronization change. Use `tech-doc/specs/data/CORE-LOCALDB-API-REFERENCE.md` for the low-level `LocalDB` contract and `tech-doc/specs/data/SETTINGS_SYNC_GUIDE.md` for the user-facing local workflow.

## Scope

Treat the internal database as four related layers:

- `src/core/db/LocalDB.js`: IndexedDB wrapper, record envelope, cache, TTL, indexes, retries, and mutation events
- `src/core/LGS1920Context.js`: application database names, versions, stores, indexes, and sync-manager wiring
- `src/core/db/DatabaseExportImportUtils.js`: JSON and ZIP serialization
- `src/core/db/DatabaseSyncManager.js`: File System Access integration, sync state, manifests, conflicts, and debounce

Do not look for an Elysia, HTTP, or IPC database API. The implemented API is browser-side JavaScript over IndexedDB.

## Workflow

1. Identify the database scope, store, key, value owner, runtime hydration path, and reset behavior.
2. Trace every reader and writer before changing a persisted contract.
3. Use `LocalDB.put`, `delete`, or `clear` for application records so mutation subscribers and folder sync observe the change.
4. Keep structural and data migrations separate:
   - Increment the IndexedDB version for store or index changes.
   - Define indexes against the stored envelope, normally `data.<field>`.
   - Normalize legacy payloads in the owning domain reader.
5. Evaluate backup and synchronization compatibility for every schema or serializer change.
6. Preserve old archives when practical and reject unsupported input before destructive clearing.
7. Add focused tests for the smallest affected layer, then update the canonical technical documentation.

## Storage Rules

- Keep keys as non-empty strings and stores declared explicitly in `LGS1920Context.createDB`.
- Treat `put` values as payloads. `LocalDB` owns the `{data, _ct_, _mt_, _ttl_, _exp_}` envelope.
- Express `LocalDB.put` TTL values in seconds. Check imported time constants before passing them.
- Use `vault` only for sensitive provider credentials, while remembering that it is not encrypted.
- Treat the raw `lgs1920-sync-state` database as sync-manager infrastructure, not application storage.
- Do not use the declared `set` or `update` aliases until they are fixed and directly tested; use `put`.
- Do not add direct `indexedDB` or `idb` access outside the sync-state implementation without an explicit architectural reason.

## Synchronization Safety

- Treat linked-folder import as destructive. At bootstrap and when linking, the folder wins and every application store is cleared before import.
- Never test folder linking with valuable local data without first creating and checking a backup.
- Preserve unrelated files in a selected folder. Cleanup must remain restricted to managed JSON roots.
- Keep conflict resolution explicit. `overwritePersistentDirectory` bypasses conflict detection and must remain a confirmed user action.
- Do not describe the two-second debounce as a durable queue. There is no unload flush, lock, rollback, or record-level merge.
- Treat ZIP and folder exports as sensitive because they include the unencrypted `vault`.
- Keep cloud synchronization separate from the implemented local folder mirror unless the user explicitly approves an architectural expansion.

## Change Matrix

| Change | Inspect and update |
|---|---|
| Store or index | `constants.js`, `LGS1920Context.js`, DB version, domain readers/writers, export/import behavior, migration tests |
| Persisted payload | Owning serializer/deserializer, legacy normalization, fixtures, backup compatibility |
| `LocalDB` API | `LocalDB.js`, direct IndexedDB tests, API reference, all consumers |
| Backup format | `DatabaseExportImportUtils.js`, round-trip and invalid-input tests, architecture document |
| Folder sync | `DatabaseSyncManager.js`, sync UI, startup order, manifest/conflict tests, sync guide |
| Reset or recovery | Profile settings UI, all four databases, linked handle, reload and rehydration behavior |

## Verification

Run the focused persistence tests first:

```bash
bunx --bun vitest run \
  src/__tests__/unit/data/database-export-import-utils.test.js \
  src/__tests__/unit/data/database-sync-manager.test.js
```

Add or run domain tests for settings, vault, journeys, POIs, groups, or widgets when their records change. For JavaScript changes, run `bun run lint`; for cross-layer changes, run an allowed production build. Never run `bun run dev`.

## Completion Checklist

- Database names, versions, stores, keys, and index paths remain coherent
- Runtime hydration still occurs after the required import or migration
- Writes emit mutations and do not bypass sync unintentionally
- Empty, partial, corrupt, and legacy imports have defined behavior
- Sensitive vault data and destructive source-of-truth rules are disclosed
- Targeted tests pass
- `tech-doc/specs/data/CORE-INTERNAL-DATABASE-ARCHITECTURE.md` and nearby references match the implementation

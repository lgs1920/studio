# LocalDB API Reference

`LocalDB` is the browser-side IndexedDB wrapper used by LGS1920 Studio. It owns store creation, the persisted record envelope, key and index reads, optional record TTL, a short-lived memory cache, transaction retries, diagnostics, and mutation notifications.

For the application database inventory, backup formats, and persistent-folder synchronization, read the [internal database architecture](CORE-INTERNAL-DATABASE-ARCHITECTURE.md).

## Construction

```javascript
import { LocalDB } from '@Core/db/LocalDB'

const db = new LocalDB({
    name: 'example',
    stores: [
        'records',
        {
            name: 'indexed-records',
            indexes: [
                {
                    name: 'group',
                    keyPath: 'data.group'
                }
            ]
        }
    ],
    manageTransients: false,
    version: 1
})
```

Constructor options:

| Option | Default | Meaning |
|---|---|---|
| `name` | `mydb` | Physical IndexedDB name |
| `stores` | `mystore` | Store name or array of store descriptors |
| `manageTransients` | `false` | Add a `transients` store |
| `version` | `1` | IndexedDB schema version |

Stores use out-of-line keys. Index paths must include the `data.` prefix when they target payload fields because `LocalDB` wraps each value.

## Persisted Envelope

```javascript
{
    data: value,
    _ct_: Date.now(),
    _mt_: Date.now(),
    _ttl_: ttlInMilliseconds,
    _exp_: expirationTimestamp
}
```

`_ttl_` and `_exp_` are omitted when no positive TTL is supplied. The public TTL parameter is expressed in seconds. Both timestamps are recreated on every `put`.

## Properties

### `dbName`

Return the physical IndexedDB name.

```javascript
const name = db.dbName
```

### `storeNames`

Return a copy of the configured store names.

```javascript
const stores = db.storeNames
```

### `transientStore`

Return `transients` when `manageTransients` is enabled, otherwise `null`.

## CRUD API

### `put(key, value, store, ttl = null)`

Write a payload under a non-empty string key. A positive TTL is interpreted as seconds.

```javascript
await db.put('record-1', {group: 'primary'}, 'indexed-records', 60)
```

`put` resolves after the transaction succeeds and emits a mutation event.

Use `put` directly. The currently declared `set` and `update` aliases are initialized before the arrow-field implementation of `put` and are therefore undefined.

### `get(key, store, full = false)`

Return the payload, the complete envelope when `full` is true, or `null` when the record is missing or expired.

```javascript
const value = await db.get('record-1', 'indexed-records')
const envelope = await db.get('record-1', 'indexed-records', true)
```

Expired key reads attempt to delete the stored record.

### `delete(key, store)`

Delete an existing record and return `true`. Return `false` when the record does not exist or another deletion of the same key is already in progress.

```javascript
const deleted = await db.delete('record-1', 'indexed-records')
```

An effective deletion emits a mutation event.

### `clear(store)`

Remove every record from a store, clear matching key-cache entries, and emit a `clear` mutation.

```javascript
await db.clear('records')
```

### `keys(store)`

Return all IndexedDB keys from the store.

```javascript
const keys = await db.keys('records')
```

Application callers should use string keys even though IndexedDB can return other valid key types.

### `hasKey(key, store)`

Return whether `get` resolves to a non-null value.

```javascript
const exists = await db.hasKey('record-1', 'records')
```

This method converts read failures to `false`.

## Index API

### `findByIndex(indexName, indexValue, store, full = false)`

Return matching payloads, or complete envelopes when `full` is true.

```javascript
const records = await db.findByIndex('group', 'primary', 'indexed-records')
```

Null or undefined index values return an empty array.

The implementation attempts a one-time record rewrite when an index is missing, has the wrong key path, or contains no indexed records. A rewrite cannot create an index outside an IndexedDB version upgrade. Always increment the database version when adding or changing an index.

## Mutation API

### `subscribeMutations(listener)`

Register a listener and return an unsubscribe function.

```javascript
const unsubscribe = db.subscribeMutations(mutation => {
    console.log(mutation)
})

unsubscribe()
```

Mutation payload:

```javascript
{
    database,
    timestamp,
    action: 'put' | 'delete' | 'clear',
    store,
    key,
    value
}
```

`key` and `value` are included only when relevant. Listener failures are logged and do not fail the completed database operation.

Persistent-folder synchronization depends on these events. Do not bypass `LocalDB` for application writes unless the synchronization consequences are intentional.

## Maintenance API

### `forceOneTimeRebuild(store)`

Rewrite every record in a store so configured indexes are repopulated.

```javascript
await db.forceOneTimeRebuild('indexed-records')
```

This is a repair tool. It does not replace a versioned schema upgrade.

### `diagnose()`

Return database version, store counts, sample keys, index definitions and counts, and cache activity.

```javascript
const diagnostic = await db.diagnose()
```

Failures are returned as `{error: message}` instead of being thrown.

### `clearMemoryCache()`

Remove every cached read.

```javascript
db.clearMemoryCache()
```

### `deleteDB()`

Close the wrapper connection and request complete IndexedDB deletion.

```javascript
const result = await db.deleteDB()
```

Return codes:

| Code | Meaning |
|---:|---|
| `0` | Error |
| `1` | Success |
| `2` | Deletion blocked by another connection |

## Transactions And Validation

- Keys must be non-empty strings.
- Store names must be declared at construction.
- Each operation creates its own transaction.
- Failed transactions are attempted up to three times.
- Retry delay is 10 milliseconds multiplied by the attempt number.
- There is no public transaction spanning multiple operations, stores, or databases.

## Cache And TTL Constraints

The memory cache has a 60-second lifetime and a maximum size of 1,000 entries.

Current constraints:

- A cached key read checks cache age before checking the record expiry timestamp.
- Index cache entries are not invalidated by `put` or `delete`.
- A recently expired record or changed index result can therefore remain visible until the cache entry expires.
- `findByIndex` omits expired envelopes but does not delete them.

Clear the memory cache when a maintenance or migration path requires an immediate uncached read.

## Schema Upgrade Rules

The IndexedDB upgrade callback:

- Creates missing stores.
- Creates missing configured indexes.
- Replaces an index whose key path changed.
- Schedules a post-upgrade record rewrite for affected stores.

It does not remove obsolete stores or indexes and does not migrate domain payloads based on `oldVersion`. Domain owners such as `Journey`, `SettingsSection`, `WidgetCache`, and `IonTokenManager` normalize legacy records when reading them.

For every store or index change:

1. Update the constructor configuration.
2. Increment the database version.
3. Add an upgrade test with pre-existing records.
4. Verify JSON and ZIP round trips.
5. Update the [internal database architecture](CORE-INTERNAL-DATABASE-ARCHITECTURE.md).

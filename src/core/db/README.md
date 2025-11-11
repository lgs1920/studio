# LocalDB

A modern, feature-rich wrapper around IndexedDB for JavaScript/TypeScript applications, providing simplified database
operations with advanced caching, TTL support, robust transaction management, and index-based search capabilities.

## Features

- **High Performance**: Built-in memory caching with automatic expiration
- **TTL Support**: Automatic data expiration with Time-To-Live functionality
- **Transaction Management**: Automatic retry logic and transaction handling
- **Multiple Stores**: Support for multiple object stores with optional indexes
- **Index-Based Search**: Efficient querying of data by indexed attributes
- **Transient Data**: Optional support for temporary data storage
- **Diagnostics**: Built-in database inspection and debugging tools
- **Memory Efficient**: Configurable cache size with automatic cleanup

## Installation

Ensure you have the `idb` library installed, as it is a dependency for `LocalDB.js`. You can include it via a CDN or
install it using npm:

```bash
npm install idb
```

Include `LocalDB.js` in your project:

```javascript
import { LocalDB } from './LocalDB.js'
```

Or, if using a module bundler, ensure `idb` is available in your environment.

## Usage

### Initialization

Create an instance of `LocalDB` with optional configuration, including support for stores with indexes:

```javascript
const db = new LocalDB({
                           name:             'myDatabase', // Database name (default: 'mydb')
                           stores: [
                               {name: 'store1', indexes: [{name: 'group', keyPath: 'group'}]}, // Store with index
                               'store2' // Store without index
                           ],
                           manageTransients: true, // Enable transient store (default: false)
                           version:          1 // Database version (default: 1)
                       })
```

### Basic Operations

#### Storing Data

Use `put` (or its aliases `set` and `update`) to store data:

```javascript
await db.put('key1', {data: 'value', group: 'group1'}, 'store1', 60) // Stores with 60-second TTL
```

#### Retrieving Data

Use `get` to retrieve data:

```javascript
const value = await db.get('key1', 'store1') // Returns the data: { data: 'value', group: 'group1' }
const fullValue = await db.get('key1', 'store1', true) // Returns full object with metadata
```

#### Deleting Data

Delete a specific key:

```javascript
const deleted = await db.delete('key1', 'store1') // Returns true if deleted, false if not found
```

#### Clearing a Store

Clear all keys in a store:

```javascript
await db.clear('store1')
```

#### Listing Keys

Retrieve all keys in a store:

```javascript
const keys = await db.keys('store1') // Returns array of keys
```

#### Checking Key Existence

Check if a key exists:

```javascript
const exists = await db.hasKey('key1', 'store1') // Returns true/false
```

#### Searching by Index

Find items in a store by an indexed attribute:

```javascript
const items = await db.findByIndex('group', 'group1', 'store1') // Returns [{ data: 'value', group: 'group1' }, ...]
const fullItems = await db.findByIndex('group', 'group1', 'store1', true) // Returns full objects with metadata
```

#### Deleting the Database

Delete the entire database:

```javascript
const result = await db.deleteDB() // Returns 1 (success), 0 (error), or 2 (blocked)
```

### Advanced Features

#### Cache Management

- **Clear Memory Cache**:
  ```javascript
  db.clearMemoryCache()
  ```
- **Get Cache Statistics**:
  ```javascript
  const stats = db.getCacheStats() // Returns size, maxSize, and sample entries
  ```
- **Clean Expired Cache Entries**:
  ```javascript
  db.cleanExpiredCache()
  ```

#### Diagnostics

Retrieve diagnostic information about the database, including store and index details:

```javascript
const diagnostics = await db.diagnose()
console.log(diagnostics)
// Example output:
// {
//   name: 'myDatabase',
//   version: 1,
//   stores: {
//     store1: { count: 5, keys: ['key1', 'key2', ...], indexes: ['group'] },
//     store2: { count: 0, keys: [], indexes: [] }
//   },
//   cacheState: { writing: 0, deleting: 0, memory: 2 }
// }
```

#### Transient Store

If `manageTransients` is enabled, a transient store is available:

```javascript
const transientStore = db.transientStore // Returns 'transients' or null
await db.put('tempKey', 'tempValue', transientStore, 30) // Store with 30-second TTL
```

## Public Methods

Below is a detailed list of all public methods available in the `LocalDB` class, including their parameters, return
values, and usage examples.

### set(key, value, store, ttl = null)

Alias for the `put` method, provided for API compatibility.

- **Parameters**:
    - `key` (string): The key to store the data under.
    - `value` (any): The data to store.
    - `store` (string): The name of the store to use.
    - `ttl` (number|null, optional): Time-to-live in seconds; null for no expiration.
- **Returns**: `Promise<void>` - Resolves when the operation completes.
- **Throws**: Error if the key or store is invalid, or if the operation fails.
- **Example**:
  ```javascript
  await db.set('user1', { name: 'John' }, 'users', 60)
  ```

### update(key, value, store, ttl = null)

Alias for the `put` method, provided for API compatibility.

- **Parameters**: Same as `set`.
- **Returns**: Same as `set`.
- **Throws**: Same as `set`.
- **Example**:
  ```javascript
  await db.update('user1', { name: 'John Updated' }, 'users', 60)
  ```

### get(key, store, full = false)

Retrieves a value from the specified store.

- **Parameters**:
    - `key` (string): The key to retrieve.
    - `store` (string): The name of the store.
    - `full` (boolean, optional): If true, returns the full object with metadata (`_ct_`, `_mt_`, `_ttl_`, `_exp_`);
      otherwise, returns only the data.
- **Returns**: `Promise<any>` - The stored value or null if not found or expired.
- **Throws**: Error if the key or store is invalid, or if the operation fails.
- **Example**:
  ```javascript
  const value = await db.get('user1', 'users') // { name: 'John' }
  const fullValue = await db.get('user1', 'users', true) // { data: { name: 'John' }, _ct_: 1697054700000, _mt_: 1697054700000, _ttl_: 60000, _exp_: 1697054760000 }
  ```

### put(key, value, store, ttl = null)

Stores a key-value pair in the specified store with an optional TTL.

- **Parameters**:
    - `key` (string): The key to store the data under.
    - `value` (any): The data to store.
    - `store` (string): The name of the store.
    - `ttl` (number|null, optional): Time-to-live in seconds; null for no expiration.
- **Returns**: `Promise<void>` - Resolves when the operation completes.
- **Throws**: Error if the key or store is invalid, or if the operation fails.
- **Example**:
  ```javascript
  await db.put('user1', { name: 'John', group: 'admin' }, 'users', 60)
  ```

### delete(key, store)

Deletes a key from the specified store.

- **Parameters**:
    - `key` (string): The key to delete.
    - `store` (string): The name of the store.
- **Returns**: `Promise<boolean>` - True if the key was deleted, false if it didn’t exist or was already being deleted.
- **Throws**: Error if the key or store is invalid, or if the operation fails.
- **Example**:
  ```javascript
  const deleted = await db.delete('user1', 'users') // true
  ```

### clear(store)

Clears all keys from the specified store.

- **Parameters**:
    - `store` (string): The name of the store to clear.
- **Returns**: `Promise<void>` - Resolves when the operation completes.
- **Throws**: Error if the store is invalid or the operation fails.
- **Example**:
  ```javascript
  await db.clear('users')
  ```

### keys(store)

Retrieves all keys in the specified store.

- **Parameters**:
    - `store` (string): The name of the store.
- **Returns**: `Promise<string[]>` - Array of keys in the store.
- **Throws**: Error if the store is invalid or the operation fails.
- **Example**:
  ```javascript
  const keys = await db.keys('users') // ['user1', 'user2']
  ```

### hasKey(key, store)

Checks if a key exists in the specified store.

- **Parameters**:
    - `key` (string): The key to check.
    - `store` (string): The name of the store.
- **Returns**: `Promise<boolean>` - True if the key exists and is valid, false otherwise.
- **Throws**: Error if the key or store is invalid.
- **Example**:
  ```javascript
  const exists = await db.hasKey('user1', 'users') // true
  ```

### findByIndex(indexName, indexValue, store, full = false)

Finds items in a store by an indexed attribute.

- **Parameters**:
    - `indexName` (string): The name of the index to search.
    - `indexValue` (any): The value to match in the index.
    - `store` (string): The name of the store.
    - `full` (boolean, optional): If true, returns full objects with metadata; otherwise, returns only the data.
- **Returns**: `Promise<Object[]>` - Array of matching items.
- **Throws**: Error if the store or index is invalid, or if the operation fails.
- **Example**:
  ```javascript
  const admins = await db.findByIndex('group', 'admin', 'users') // [{ name: 'John', group: 'admin' }, { name: 'Jane', group: 'admin' }]
  const fullAdmins = await db.findByIndex('group', 'admin', 'users', true) // [{ data: { name: 'John', group: 'admin' }, _ct_: ..., ... }, ...]
  ```

### deleteDB()

Deletes the entire database.

- **Parameters**: None.
- **Returns**: `Promise<number>` - 0 (error), 1 (success), or 2 (blocked).
- **Throws**: Error if the operation fails.
- **Example**:
  ```javascript
  const result = await db.deleteDB() // 1
  ```

### diagnose()

Diagnoses the database state and returns diagnostic information.

- **Parameters**: None.
- **Returns**: `Promise<Object>` - Diagnostic information including database name, version, store details (key count and
  indexes), and cache state.
- **Throws**: Error if the operation fails.
- **Example**:
  ```javascript
  const diagnostics = await db.diagnose()
  console.log(diagnostics)
  // {
  //   name: 'myDatabase',
  //   version: 1,
  //   stores: {
  //     users: { count: 2, keys: ['user1', 'user2'], indexes: ['group'] },
  //     other: { count: 0, keys: [], indexes: [] }
  //   },
  //   cacheState: { writing: 0, deleting: 0, memory: 2 }
  // }
  ```

### clearMemoryCache()

Clears the in-memory cache.

- **Parameters**: None.
- **Returns**: None.
- **Example**:
  ```javascript
  db.clearMemoryCache() // Logs: "Memory cache cleared"
  ```

### getCacheStats()

Retrieves statistics about the in-memory cache.

- **Parameters**: None.
- **Returns**: `Object` - Cache statistics including size, max size, and sample entries.
- **Example**:
  ```javascript
  const stats = db.getCacheStats()
  console.log(stats) // { size: 2, maxSize: 1000, entries: ['users:user1', 'users:user2'] }
  ```

### cleanExpiredCache()

Removes expired entries from the in-memory cache.

- **Parameters**: None.
- **Returns**: None.
- **Example**:
  ```javascript
  db.cleanExpiredCache()
  ```

## Configuration

- **CACHE_TTL**: Cache entries expire after 60 seconds (configurable via `CACHE_TTL` constant).
- **DEFAULT_RETRY_DELAY**: 10ms delay between transaction retries.
- **DEFAULT_MAX_RETRIES**: Up to 3 retries for failed transactions.
- **cacheMaxSize**: Maximum of 1000 entries in the in-memory cache.

## Example

```javascript
const db = new LocalDB({
                           name:             'exampleDB',
                           stores: [
                               {name: 'data', indexes: [{name: 'group', keyPath: 'group'}]},
                               'otherData'
                           ],
                           manageTransients: true
                       })

// Store data with indexable attribute
await db.put('user1', {name: 'John', group: 'admin'}, 'data', 120)
await db.put('user2', {name: 'Jane', group: 'admin'}, 'data', 120)
await db.put('user3', {name: 'Bob', group: 'user'}, 'data', 120)

// Retrieve data by key
const user = await db.get('user1', 'data')
console.log(user) // { name: 'John', group: 'admin' }

// Find data by index
const adminUsers = await db.findByIndex('group', 'admin', 'data')
console.log(adminUsers) // [{ name: 'John', group: 'admin' }, { name: 'Jane', group: 'admin' }]

// Check if key exists
const exists = await db.hasKey('user1', 'data')
console.log(exists) // true

// Delete data
await db.delete('user1', 'data')

// Clear store
await db.clear('data')

// Delete database
await db.deleteDB()
```

## Error Handling

All methods throw errors if operations fail (e.g., invalid key, store, or index). Use try-catch blocks:

```javascript
try {
    await db.findByIndex('invalidIndex', 'value', 'data')
}
catch (error) {
    console.error(error.message) // "Index 'invalidIndex' does not exist in store 'data'."
}
```

## Notes

- Ensure `idb` is loaded before using `LocalDB`.
- The library uses an in-memory cache to improve performance but respects TTLs.
- Transient stores are useful for temporary data with automatic expiration.
- Always validate store names, keys, and index names to avoid errors.
- Indexes must be defined at store creation and cannot be modified without incrementing the database version.
- Mixed store configurations (with and without indexes) are supported, e.g.,
  `[{ name: 'store1', indexes: [...] }, 'store2']`.

## License

Copyright © 2025 LGS1920. All rights reserved.

## Contact

For issues or inquiries, contact the LGS1920 Team at contact@lgs1920.fr.
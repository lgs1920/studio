# LocalDB

A modern, feature-rich wrapper around IndexedDB for JavaScript/TypeScript applications, providing simplified database
operations with advanced caching, TTL support, and robust transaction management.

## Features

- **High Performance**: Built-in memory caching with automatic expiration
- **TTL Support**: Automatic data expiration with Time-To-Live functionality
- **Transaction Management**: Automatic retry logic and transaction handling
- **Multiple Stores**: Support for multiple object stores in a single database
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
import { LocalDB } from './LocalDB.js';
```

Or, if using a module bundler, ensure `idb` is available in your environment.

## Usage

### Initialization

Create an instance of `LocalDB` with optional configuration:

```javascript
const db = new LocalDB({
                           name:             'myDatabase', // Database name (default: 'mydb')
                           stores:           ['store1', 'store2'], // Array of store names (default: ['mystore'])
                           manageTransients: true, // Enable transient store (default: false)
                           version:          1 // Database version (default: 1)
                       });
```

### Basic Operations

#### Storing Data

Use `put` (or its aliases `set` and `update`) to store data:

```javascript
await db.put('key1', {data: 'value'}, 'store1', 60); // Stores with 60-second TTL
```

#### Retrieving Data

Use `get` to retrieve data:

```javascript
const value = await db.get('key1', 'store1'); // Returns the data
const fullValue = await db.get('key1', 'store1', true); // Returns full object with metadata
```

#### Deleting Data

Delete a specific key:

```javascript
const deleted = await db.delete('key1', 'store1'); // Returns true if deleted, false if not found
```

#### Clearing a Store

Clear all keys in a store:

```javascript
await db.clear('store1');
```

#### Listing Keys

Retrieve all keys in a store:

```javascript
const keys = await db.keys('store1'); // Returns array of keys
```

#### Checking Key Existence

Check if a key exists:

```javascript
const exists = await db.hasKey('key1', 'store1'); // Returns true/false
```

#### Deleting the Database

Delete the entire database:

```javascript
const result = await db.deleteDB(); // Returns 1 (success), 0 (error), or 2 (blocked)
```

### Advanced Features

#### Cache Management

- **Clear Memory Cache**:
  ```javascript
  db.clearMemoryCache();
  ```
- **Get Cache Statistics**:
  ```javascript
  const stats = db.getCacheStats(); // Returns size, maxSize, and sample entries
  ```
- **Clean Expired Cache Entries**:
  ```javascript
  db.cleanExpiredCache();
  ```

#### Diagnostics

Retrieve diagnostic information about the database:

```javascript
const diagnostics = await db.diagnose();
console.log(diagnostics);
// Example output:
// {
//   name: 'myDatabase',
//   version: 1,
//   stores: {
//     store1: { count: 5, keys: ['key1', 'key2', ...] },
//     store2: { count: 0, keys: [] }
//   },
//   cacheState: { writing: 0, deleting: 0, memory: 2 }
// }
```

#### Transient Store

If `manageTransients` is enabled, a transient store is available:

```javascript
const transientStore = db.transientStore; // Returns 'transients' or null
await db.put('tempKey', 'tempValue', transientStore, 30); // Store with 30-second TTL
```

## Error Handling

All methods throw errors if operations fail (e.g., invalid key, store, or database issues). Use try-catch blocks:

```javascript
try {
    await db.put('key1', 'value', 'invalidStore');
}
catch (error) {
    console.error(error.message); // "Invalid store: 'invalidStore' is not a valid store."
}
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
                           stores:           ['data'],
                           manageTransients: true
                       });

// Store data
await db.put('user1', {name: 'John'}, 'data', 120);

// Retrieve data
const user = await db.get('user1', 'data');
console.log(user); // { name: 'John' }

// Check if key exists
const exists = await db.hasKey('user1', 'data');
console.log(exists); // true

// Delete data
await db.delete('user1', 'data');

// Clear store
await db.clear('data');

// Delete database
await db.deleteDB();
```

## Notes

- Ensure `idb` is loaded before using `LocalDB`.
- The library uses an in-memory cache to improve performance but respects TTLs.
- Transient stores are useful for temporary data with automatic expiration.
- Always validate store names and keys to avoid errors.

## License

Copyright © 2025 LGS1920. All rights reserved.

## Contact

For issues or inquiries, contact the LGS1920 Team at contact@lgs1920.fr.
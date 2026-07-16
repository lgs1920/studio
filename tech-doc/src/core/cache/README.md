# LGS1920 Cache Management System

## Overview

This project uses a unified Service Worker architecture to manage two distinct caching strategies, ensuring high
performance for both application code and heavy 3D assets.

1. **Application Assets**: Version-aware caching (Stale-while-revalidate) with automatic cleanup on build updates via
   metadata tracking.
2. **Cesium Assets**: Persistent, high-capacity caching for 3D tiles, managed via a dedicated `CacheManager` class.

## Architecture & Components

### 1. Service Worker (service-worker-pwa.js)

* **Versioning**: Tracks `build.json`, `version.json`, and `branch.json` to trigger application cache invalidation upon
  deployment updates.
* **Fetch Logic**: Splits requests based on origin. Requests to `assets.ion.cesium.com` are handled by a persistent
  strategy, while standard HTTP GET requests use stale-while-revalidate.
* **Storage Management**: Calculates cache usage dynamically by iterating through cached Blobs to provide precise
  storage reporting, bypassing CORS restrictions on headers.

### 2. CacheManager (CacheManager.js)

The `CacheManager` acts as the client-side interface to the persistent Cesium cache.

* **getUsage()**: Asynchronously returns the current byte-size of the Cesium cache via `MessageChannel`.
* **clear()**: Requests a cache purge from the Service Worker and broadcasts a `lgs:cache-cleared` event upon
  completion.
* **Event Handling**: Automatically listens for Service Worker messages and dispatches `CustomEvent` objects to the
  global window scope for UI reactivity.

## Quota Management & Storage

To prevent browser storage exhaustion:

* **Quota Enforcement**: The `maxQuota` parameter passed to `CacheManager` acts as an advisory limit for UI-level
  monitoring.
* **Automatic Cleanup**: During Service Worker activation, old caches matching the `lgs-studio-` prefix are
  automatically purged.
* **Manual Purge**: The `clear()` method allows users to explicitly release disk space without affecting the core PWA
  application files.

## Integration

### Initialization

Ensure the `CacheManager` is initialized after the Service Worker registration:

```javascript
import { CacheManager } from './CacheManager'

// Global application object setup
window.__ = window.__ || {app: {}, ui: {}}

__.app.cesiumCache = new CacheManager('cesium-ion-assets', 524288000)

```

### UI Monitoring

Monitor cache growth periodically:

```javascript
setInterval(async () => {
    const bytes = await __.app.cesiumCache.getUsage()
    const mb = (bytes / (1024 * 1024)).toFixed(2)

    if (__.ui?.updateCacheStats) {
        __.ui.updateCacheStats({used: mb})
    }
}, 30000)

```

### Events

The system dispatches global events that can be captured anywhere in the application:

```javascript
window.addEventListener('lgs:cache-cleared', (e) => {
    console.log('Cache successfully cleared:', e.detail.cacheName)
})

```

## Error Handling & Debugging

* **SW Unavailable**: If `navigator.serviceWorker.controller` is null, methods resolve silently to prevent UI breakage.
* **CORS & Opaque Responses**: Calculation via `blob.size` prevents `SecurityError` when accessing cross-origin assets.
* **Cache Corruption**: The system strictly enforces string-based identifiers. If a cache named `[object Object]`
  appears, ensure `CacheManager` methods are not passing full object instances.
* **Communication Isolation**: Every request via `MessageChannel` is isolated, ensuring the main thread remains stable
  even if a background process fails.
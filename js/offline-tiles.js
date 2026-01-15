/**
 * Offline tile caching using IndexedDB and Service Worker
 * @module offline-tiles
 */

import { CONFIG, BASEMAP_CONFIGS } from './config.js';

// IndexedDB configuration
const DB_NAME = 'cycling-feedback-tiles';
const DB_VERSION = 1;
const TILE_STORE = 'tiles';

// Cache configuration
const CACHE_NAME = 'cycling-feedback-cache-v1';
const MAX_CACHED_TILES = 5000;
const TILE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// State
let db = null;
let isOfflineMode = false;
let cachedTileCount = 0;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function initTileDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            db = request.result;
            updateCacheStats();
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(TILE_STORE)) {
                const store = database.createObjectStore(TILE_STORE, { keyPath: 'url' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('basemap', 'basemap', { unique: false });
            }
        };
    });
}

/**
 * Store a tile in the cache
 * @param {string} url - Tile URL
 * @param {Blob} blob - Tile data
 * @param {string} basemap - Basemap identifier
 */
export async function cacheTile(url, blob, basemap = 'unknown') {
    if (!db) await initTileDB();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const transaction = db.transaction([TILE_STORE], 'readwrite');
            const store = transaction.objectStore(TILE_STORE);

            const tile = {
                url,
                data: reader.result,
                basemap,
                timestamp: Date.now()
            };

            const request = store.put(tile);
            request.onsuccess = () => {
                cachedTileCount++;
                resolve();
            };
            request.onerror = () => reject(request.error);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Get a tile from the cache
 * @param {string} url - Tile URL
 * @returns {Promise<Blob|null>}
 */
export async function getCachedTile(url) {
    if (!db) await initTileDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([TILE_STORE], 'readonly');
        const store = transaction.objectStore(TILE_STORE);
        const request = store.get(url);

        request.onsuccess = () => {
            if (request.result) {
                // Check if tile has expired
                if (Date.now() - request.result.timestamp > TILE_EXPIRY_MS) {
                    deleteTile(url);
                    resolve(null);
                    return;
                }

                // Convert data URL back to blob
                fetch(request.result.data)
                    .then(res => res.blob())
                    .then(resolve)
                    .catch(() => resolve(null));
            } else {
                resolve(null);
            }
        };
        request.onerror = () => resolve(null);
    });
}

/**
 * Delete a tile from cache
 * @param {string} url - Tile URL
 */
async function deleteTile(url) {
    if (!db) return;

    return new Promise((resolve) => {
        const transaction = db.transaction([TILE_STORE], 'readwrite');
        const store = transaction.objectStore(TILE_STORE);
        store.delete(url);
        transaction.oncomplete = () => {
            cachedTileCount = Math.max(0, cachedTileCount - 1);
            resolve();
        };
    });
}

/**
 * Update cache statistics
 */
async function updateCacheStats() {
    if (!db) return;

    return new Promise((resolve) => {
        const transaction = db.transaction([TILE_STORE], 'readonly');
        const store = transaction.objectStore(TILE_STORE);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
            cachedTileCount = countRequest.result;
            resolve(cachedTileCount);
        };
    });
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
    return {
        tileCount: cachedTileCount,
        maxTiles: MAX_CACHED_TILES,
        isOffline: isOfflineMode
    };
}

/**
 * Clear all cached tiles
 */
export async function clearTileCache() {
    if (!db) await initTileDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([TILE_STORE], 'readwrite');
        const store = transaction.objectStore(TILE_STORE);
        const request = store.clear();

        request.onsuccess = () => {
            cachedTileCount = 0;
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clear expired tiles
 */
export async function clearExpiredTiles() {
    if (!db) await initTileDB();

    return new Promise((resolve) => {
        const transaction = db.transaction([TILE_STORE], 'readwrite');
        const store = transaction.objectStore(TILE_STORE);
        const index = store.index('timestamp');
        const cutoff = Date.now() - TILE_EXPIRY_MS;

        const range = IDBKeyRange.upperBound(cutoff);
        const request = index.openCursor(range);

        let deletedCount = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                deletedCount++;
                cursor.continue();
            } else {
                cachedTileCount = Math.max(0, cachedTileCount - deletedCount);
                resolve(deletedCount);
            }
        };
    });
}

/**
 * Cache tiles for a given area
 * @param {L.LatLngBounds} bounds - Area bounds
 * @param {number} minZoom - Minimum zoom level
 * @param {number} maxZoom - Maximum zoom level
 * @param {string} basemap - Basemap to cache
 * @param {Function} onProgress - Progress callback
 */
export async function cacheAreaTiles(bounds, minZoom, maxZoom, basemap = 'streets', onProgress) {
    const config = BASEMAP_CONFIGS[basemap];
    if (!config) {
        throw new Error(`Unknown basemap: ${basemap}`);
    }

    const tiles = getTilesForBounds(bounds, minZoom, maxZoom);
    const total = tiles.length;
    let completed = 0;
    let failed = 0;

    for (const tile of tiles) {
        try {
            const url = config.url
                .replace('{z}', tile.z)
                .replace('{x}', tile.x)
                .replace('{y}', tile.y)
                .replace('{s}', 'a');

            // Check if already cached
            const existing = await getCachedTile(url);
            if (!existing) {
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    await cacheTile(url, blob, basemap);
                } else {
                    failed++;
                }
            }

            completed++;
            if (onProgress) {
                onProgress({ completed, total, failed, percent: Math.round((completed / total) * 100) });
            }
        } catch (error) {
            failed++;
            completed++;
            console.warn('Failed to cache tile:', error);
        }

        // Check cache limit
        if (cachedTileCount >= MAX_CACHED_TILES) {
            await clearExpiredTiles();
        }
    }

    return { completed, total, failed };
}

/**
 * Calculate tiles needed for given bounds
 * @param {L.LatLngBounds} bounds - Area bounds
 * @param {number} minZoom - Minimum zoom
 * @param {number} maxZoom - Maximum zoom
 * @returns {Array} Array of tile coordinates
 */
function getTilesForBounds(bounds, minZoom, maxZoom) {
    const tiles = [];

    for (let z = minZoom; z <= maxZoom; z++) {
        const nwTile = latLngToTile(bounds.getNorthWest(), z);
        const seTile = latLngToTile(bounds.getSouthEast(), z);

        for (let x = nwTile.x; x <= seTile.x; x++) {
            for (let y = nwTile.y; y <= seTile.y; y++) {
                tiles.push({ x, y, z });
            }
        }
    }

    return tiles;
}

/**
 * Convert lat/lng to tile coordinates
 * @param {L.LatLng} latlng - Coordinates
 * @param {number} zoom - Zoom level
 * @returns {Object} Tile x, y coordinates
 */
function latLngToTile(latlng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((latlng.lng + 180) / 360 * n);
    const latRad = latlng.lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: Math.max(0, x), y: Math.max(0, y) };
}

/**
 * Create a custom tile layer with offline support
 * @param {string} basemapName - Basemap name
 * @returns {L.TileLayer} Leaflet tile layer with caching
 */
export function createCachedTileLayer(basemapName) {
    const config = BASEMAP_CONFIGS[basemapName];
    if (!config) return null;

    const CachedTileLayer = L.TileLayer.extend({
        createTile: function(coords, done) {
            const tile = document.createElement('img');
            const url = this.getTileUrl(coords);

            L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
            L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

            if (this.options.crossOrigin || this.options.crossOrigin === '') {
                tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
            }

            tile.alt = '';
            tile.setAttribute('role', 'presentation');

            // Try to get from cache first
            getCachedTile(url).then(cachedBlob => {
                if (cachedBlob) {
                    tile.src = URL.createObjectURL(cachedBlob);
                } else {
                    // Fetch and cache
                    tile.src = url;
                    fetch(url)
                        .then(response => {
                            if (response.ok) {
                                return response.blob();
                            }
                        })
                        .then(blob => {
                            if (blob) {
                                cacheTile(url, blob, basemapName);
                            }
                        })
                        .catch(() => {});
                }
            }).catch(() => {
                tile.src = url;
            });

            return tile;
        }
    });

    return new CachedTileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: 19,
        crossOrigin: true
    });
}

/**
 * Set offline mode
 * @param {boolean} offline - Enable offline mode
 */
export function setOfflineMode(offline) {
    isOfflineMode = offline;
}

/**
 * Check if online
 * @returns {boolean}
 */
export function isOnline() {
    return navigator.onLine && !isOfflineMode;
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        isOfflineMode = false;
        console.log('Back online');
    });

    window.addEventListener('offline', () => {
        console.log('Gone offline - using cached tiles');
    });
}

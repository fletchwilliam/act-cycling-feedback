/**
 * GPS Location integration for mobile devices
 * @module gps-location
 */

import * as state from './state.js';
import { CONFIG } from './config.js';

// GPS state
let watchId = null;
let currentPosition = null;
let locationMarker = null;
let accuracyCircle = null;
let isTracking = false;
let onLocationUpdate = null;

// GPS configuration
const GPS_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000
};

/**
 * Check if geolocation is supported
 * @returns {boolean}
 */
export function isGeolocationSupported() {
    return 'geolocation' in navigator;
}

/**
 * Request location permission
 * @returns {Promise<boolean>}
 */
export async function requestLocationPermission() {
    if (!isGeolocationSupported()) {
        return false;
    }

    try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state === 'granted' || result.state === 'prompt';
    } catch {
        // Permissions API not supported, try direct request
        return true;
    }
}

/**
 * Get current position once
 * @returns {Promise<GeolocationPosition>}
 */
export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!isGeolocationSupported()) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentPosition = position;
                resolve(position);
            },
            (error) => {
                reject(error);
            },
            GPS_OPTIONS
        );
    });
}

/**
 * Start watching position
 * @param {Function} callback - Called on each position update
 * @returns {boolean} Whether watching started
 */
export function startWatching(callback) {
    if (!isGeolocationSupported()) {
        return false;
    }

    if (watchId !== null) {
        stopWatching();
    }

    onLocationUpdate = callback;
    isTracking = true;

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            currentPosition = position;
            updateLocationDisplay(position);
            if (onLocationUpdate) {
                onLocationUpdate(position);
            }
        },
        (error) => {
            console.warn('GPS error:', error.message);
            handleGPSError(error);
        },
        GPS_OPTIONS
    );

    return true;
}

/**
 * Stop watching position
 */
export function stopWatching() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    isTracking = false;
    removeLocationMarker();
}

/**
 * Get last known position
 * @returns {GeolocationPosition|null}
 */
export function getLastPosition() {
    return currentPosition;
}

/**
 * Check if currently tracking
 * @returns {boolean}
 */
export function isCurrentlyTracking() {
    return isTracking;
}

/**
 * Update the location display on map
 * @param {GeolocationPosition} position
 */
function updateLocationDisplay(position) {
    const map = state.getMap();
    if (!map) return;

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Update or create marker
    if (locationMarker) {
        locationMarker.setLatLng([lat, lng]);
    } else {
        locationMarker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: '#4285F4',
            color: '#fff',
            weight: 3,
            fillOpacity: 1,
            className: 'gps-marker pulse'
        }).addTo(map);

        locationMarker.bindPopup('Your location');
    }

    // Update or create accuracy circle
    if (accuracyCircle) {
        accuracyCircle.setLatLng([lat, lng]);
        accuracyCircle.setRadius(accuracy);
    } else {
        accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            fillColor: '#4285F4',
            fillOpacity: 0.1,
            color: '#4285F4',
            weight: 1,
            opacity: 0.3
        }).addTo(map);
    }
}

/**
 * Remove location marker from map
 */
function removeLocationMarker() {
    const map = state.getMap();
    if (!map) return;

    if (locationMarker) {
        map.removeLayer(locationMarker);
        locationMarker = null;
    }

    if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
        accuracyCircle = null;
    }
}

/**
 * Handle GPS errors
 * @param {GeolocationPositionError} error
 */
function handleGPSError(error) {
    let message;

    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable. Please check your GPS signal.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
        default:
            message = 'Unknown location error.';
    }

    showGPSError(message);
}

/**
 * Show GPS error to user
 * @param {string} message
 */
function showGPSError(message) {
    const statusEl = document.getElementById('gpsStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'gps-status error';
        setTimeout(() => {
            statusEl.className = 'gps-status';
        }, 5000);
    }
}

/**
 * Center map on current location
 * @param {number} zoom - Optional zoom level
 */
export async function centerOnLocation(zoom = 16) {
    const map = state.getMap();
    if (!map) return;

    try {
        const position = await getCurrentPosition();
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        map.setView([lat, lng], zoom);
        updateLocationDisplay(position);
    } catch (error) {
        handleGPSError(error);
    }
}

/**
 * Use current GPS location for feedback
 * @returns {Object|null} Location data or null
 */
export async function useGPSForFeedback() {
    try {
        const position = await getCurrentPosition();
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        };
    } catch (error) {
        handleGPSError(error);
        return null;
    }
}

/**
 * Calculate distance from current location to a point
 * @param {number} lat - Target latitude
 * @param {number} lng - Target longitude
 * @returns {number|null} Distance in meters or null
 */
export function distanceFromCurrentLocation(lat, lng) {
    if (!currentPosition) return null;

    const R = 6371000; // Earth's radius in meters
    const lat1 = currentPosition.coords.latitude * Math.PI / 180;
    const lat2 = lat * Math.PI / 180;
    const dLat = (lat - currentPosition.coords.latitude) * Math.PI / 180;
    const dLng = (lng - currentPosition.coords.longitude) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Format accuracy for display
 * @param {number} accuracy - Accuracy in meters
 * @returns {string} Formatted accuracy string
 */
export function formatAccuracy(accuracy) {
    if (accuracy < 10) {
        return `${Math.round(accuracy)}m (excellent)`;
    } else if (accuracy < 30) {
        return `${Math.round(accuracy)}m (good)`;
    } else if (accuracy < 100) {
        return `${Math.round(accuracy)}m (moderate)`;
    } else {
        return `${Math.round(accuracy)}m (poor)`;
    }
}

/**
 * Initialize GPS button and UI
 */
export function initGPSUI() {
    // Add GPS button to toolbar if not exists
    const toolbar = document.getElementById('selectionToolbar');
    if (toolbar && !document.getElementById('gpsBtn')) {
        const gpsBtn = document.createElement('button');
        gpsBtn.id = 'gpsBtn';
        gpsBtn.innerHTML = '📍 GPS';
        gpsBtn.title = 'Center on your location';
        gpsBtn.onclick = () => {
            centerOnLocation();
        };

        const divider = toolbar.querySelector('.divider');
        if (divider) {
            toolbar.insertBefore(gpsBtn, divider);
        } else {
            toolbar.appendChild(gpsBtn);
        }
    }
}

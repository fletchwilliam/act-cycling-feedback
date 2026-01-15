/**
 * Feedback system
 * @module feedback
 */

import * as state from './state.js';
import { CONFIG, FEEDBACK_CATEGORIES } from './config.js';
import { findNearestPointOnFeature, downloadFile } from './utils.js';
import { applyFeedbackFilters, updateFilterPanel } from './filters.js';

// Callbacks for cross-module communication
let setModeCallback = null;
let updateSelectionStatusCallback = null;

/**
 * Set callback functions for cross-module communication
 */
export function setFeedbackCallbacks(callbacks) {
    if (callbacks.setMode) setModeCallback = callbacks.setMode;
    if (callbacks.updateSelectionStatus) updateSelectionStatusCallback = callbacks.updateSelectionStatus;
}

/**
 * Close the feedback panel
 */
export function closeFeedbackPanel() {
    document.getElementById('feedbackPanel').classList.remove('visible');
    if (state.getSelectionMode() === 'feedback' && setModeCallback) {
        setModeCallback('pan');
    }
    resetFeedbackForm();
}

/**
 * Reset the feedback form
 */
export function resetFeedbackForm() {
    const map = state.getMap();
    const feedbackState = state.getFeedbackState();

    // Clear marker
    if (feedbackState.marker) {
        map.removeLayer(feedbackState.marker);
        feedbackState.marker = null;
    }

    // Reset state
    feedbackState.latlng = null;
    feedbackState.pathInfo = null;
    feedbackState.rating = null;

    // Reset form UI
    document.getElementById('feedbackLocation').style.display = 'none';
    document.getElementById('feedbackForm').style.display = 'none';
    document.getElementById('feedbackCategory').value = '';
    document.getElementById('feedbackComment').value = '';
    document.getElementById('feedbackName').value = '';
    document.getElementById('feedbackEmail').value = '';
    document.querySelectorAll('.feedback-rating button').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('sendFeedbackBtn').disabled = true;

    // Update instructions
    document.querySelector('.feedback-instructions').textContent = 'Click on any path to select a location for your feedback.';
}

/**
 * Handle a feedback click on a path
 * @param {Object} e - Click event
 * @param {Object} feature - GeoJSON feature
 * @param {L.Layer} layer - Leaflet layer
 */
export function handleFeedbackClick(e, feature, layer) {
    if (state.getSelectionMode() !== 'feedback') return;

    const map = state.getMap();
    const feedbackState = state.getFeedbackState();

    // Remove previous marker
    if (feedbackState.marker) {
        map.removeLayer(feedbackState.marker);
    }

    // Store location and path info
    feedbackState.latlng = e.latlng;
    feedbackState.pathInfo = {
        name: feature.properties.ASSET_NAME || feature.properties.LOCATION || 'Unknown path',
        type: feature.properties.ASSET_SUB_TYPE || feature.properties.ASSET_TYPE || 'Path',
        surface: feature.properties.PATH_SURFACE || feature.properties.SURFACE_TYPE || 'Unknown',
        suburb: feature.properties.SUBURB || 'Unknown'
    };

    // Add marker at click location
    feedbackState.marker = L.circleMarker(e.latlng, {
        radius: CONFIG.FEEDBACK_MARKER_RADIUS,
        fillColor: '#2196F3',
        color: '#fff',
        weight: 3,
        fillOpacity: 1
    }).addTo(map);

    // Update UI
    document.getElementById('feedbackLocation').style.display = 'block';
    document.getElementById('feedbackLocationText').textContent =
        `${feedbackState.pathInfo.name} (${feedbackState.pathInfo.suburb})`;
    document.getElementById('feedbackForm').style.display = 'block';
    document.querySelector('.feedback-instructions').textContent = 'Rate this location and provide your feedback.';

    if (updateSelectionStatusCallback) {
        updateSelectionStatusCallback('Location selected - fill in feedback form');
    }
}

/**
 * Set the feedback rating
 * @param {string} rating - 'good' or 'bad'
 */
export function setFeedbackRating(rating) {
    const feedbackState = state.getFeedbackState();
    feedbackState.rating = rating;

    // Update button styles
    document.querySelectorAll('.feedback-rating button').forEach(btn => btn.classList.remove('selected'));
    if (rating === 'good') {
        document.querySelector('.feedback-rating .thumbs-up').classList.add('selected');
    } else {
        document.querySelector('.feedback-rating .thumbs-down').classList.add('selected');
    }

    validateFeedbackForm();
}

/**
 * Validate the feedback form
 */
export function validateFeedbackForm() {
    const feedbackState = state.getFeedbackState();
    const rating = feedbackState.rating;
    const category = document.getElementById('feedbackCategory').value;

    const isValid = rating && category && feedbackState.latlng;
    document.getElementById('sendFeedbackBtn').disabled = !isValid;
}

/**
 * Download the feedback as GeoJSON
 */
export function downloadFeedback() {
    const feedbackState = state.getFeedbackState();

    if (!feedbackState.latlng || !feedbackState.rating) {
        alert('Please select a location and rating');
        return;
    }

    const category = document.getElementById('feedbackCategory').value;
    if (!category) {
        alert('Please select a reason for your rating');
        return;
    }

    const comment = document.getElementById('feedbackComment').value;
    const name = document.getElementById('feedbackName').value;
    const email = document.getElementById('feedbackEmail').value;

    // Create GeoJSON feature
    const feedbackFeature = {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [feedbackState.latlng.lng, feedbackState.latlng.lat]
        },
        properties: {
            rating: feedbackState.rating,
            category: category,
            categoryLabel: FEEDBACK_CATEGORIES[category] || category,
            comment: comment,
            submitterName: name,
            submitterEmail: email,
            pathName: feedbackState.pathInfo.name,
            pathType: feedbackState.pathInfo.type,
            pathSurface: feedbackState.pathInfo.surface,
            suburb: feedbackState.pathInfo.suburb,
            timestamp: new Date().toISOString()
        }
    };

    // Create GeoJSON content
    const geojsonContent = JSON.stringify({
        type: 'FeatureCollection',
        features: [feedbackFeature]
    }, null, 2);

    // Download
    const filename = `feedback_${feedbackState.rating}_${Date.now()}.geojson`;
    downloadFile(geojsonContent, filename, 'application/json');

    // Reset form
    resetFeedbackForm();
}

/**
 * Load feedback files
 * @param {HTMLInputElement} input - File input element
 */
export function loadFeedbackFiles(input) {
    const files = input.files;
    if (!files.length) return;

    const feedbackData = state.getFeedbackData();
    let loadedCount = 0;
    let totalFeatures = 0;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const geojson = JSON.parse(e.target.result);

                if (geojson.features) {
                    geojson.features.forEach(feature => {
                        if (feature.properties && feature.properties.rating) {
                            feedbackData.features.push(feature);
                            totalFeatures++;
                        }
                    });
                }

                loadedCount++;

                if (loadedCount === files.length) {
                    updateFeedbackLayer();
                    document.getElementById('feedbackLayerInfo').style.display = 'block';
                    document.getElementById('feedbackLayerInfo').innerHTML =
                        `✓ Loaded ${totalFeatures} feedback point(s) from ${loadedCount} file(s)`;
                    updateFilterPanel();
                }
            } catch (err) {
                alert('Error parsing feedback file: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
}

/**
 * Update the feedback layer on the map
 */
export function updateFeedbackLayer() {
    const map = state.getMap();
    const feedbackData = state.getFeedbackData();
    let feedbackLayer = state.getFeedbackLayer();

    // Remove existing layer
    if (feedbackLayer) {
        map.removeLayer(feedbackLayer);
    }

    if (feedbackData.features.length === 0) return;

    // Apply filters
    const filteredFeatures = applyFeedbackFilters(feedbackData.features);

    // Create the feedback layer
    feedbackLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
        pointToLayer: function(feature, latlng) {
            const isGood = feature.properties.rating === 'good';
            return L.marker(latlng, {
                icon: L.divIcon({
                    className: 'feedback-marker',
                    html: `<div style="
                        font-size: 24px;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        cursor: pointer;
                    ">${isGood ? '👍' : '👎'}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                })
            });
        },
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const ratingEmoji = props.rating === 'good' ? '👍' : '👎';
            const ratingColor = props.rating === 'good' ? '#4CAF50' : '#f44336';

            let popupContent = `
                <div class="feedback-popup">
                    <div class="rating" style="color: ${ratingColor};">${ratingEmoji} ${props.rating === 'good' ? 'Good' : 'Bad'}</div>
                    <div class="category">${props.categoryLabel || props.category}</div>
                    ${props.comment ? `<div class="comment">${props.comment}</div>` : ''}
                    <div class="meta">
                        <strong>Path:</strong> ${props.pathName || 'Unknown'}<br>
                        <strong>Suburb:</strong> ${props.suburb || 'Unknown'}<br>
                        ${props.submitterName ? `<strong>By:</strong> ${props.submitterName}<br>` : ''}
                        <strong>Date:</strong> ${props.timestamp ? new Date(props.timestamp).toLocaleDateString() : 'Unknown'}
                    </div>
                </div>
            `;

            layer.bindPopup(popupContent, { maxWidth: 300 });
        }
    }).addTo(map);

    state.setFeedbackLayer(feedbackLayer);
    updateFeedbackLayerUI();
    updateFilterPanel();
}

/**
 * Update the feedback layer UI controls
 */
export function updateFeedbackLayerUI() {
    const container = document.getElementById('feedbackLayerControls');
    const feedbackData = state.getFeedbackData();

    if (!container) return;

    if (feedbackData.features.length > 0) {
        const filteredCount = applyFeedbackFilters(feedbackData.features).length;
        container.innerHTML = `
            <div class="layer-toggle">
                <input type="checkbox" id="toggleFeedback" checked onchange="window.appCallbacks.toggleFeedbackLayer()">
                <label for="toggleFeedback">Feedback (${filteredCount}/${feedbackData.features.length})</label>
            </div>
        `;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

/**
 * Toggle feedback layer visibility
 */
export function toggleFeedbackLayer() {
    const map = state.getMap();
    const feedbackLayer = state.getFeedbackLayer();
    const checkbox = document.getElementById('toggleFeedback');

    if (checkbox.checked) {
        if (feedbackLayer) feedbackLayer.addTo(map);
    } else {
        if (feedbackLayer) map.removeLayer(feedbackLayer);
    }
}

/**
 * Attach feedback click handler to a layer
 * @param {L.Layer} layer - Leaflet layer
 * @param {Object} feature - GeoJSON feature
 */
export function attachFeedbackClickHandler(layer, feature) {
    layer.on('click', function(e) {
        if (state.getSelectionMode() === 'feedback') {
            L.DomEvent.stopPropagation(e);
            handleFeedbackClick(e, feature, layer);
        }
    });
}

/**
 * Set up map-level click handler for feedback
 * @param {L.Map} map - Leaflet map instance
 */
export function setupFeedbackMapClickHandler(map) {
    map.on('click', function(e) {
        if (state.getSelectionMode() !== 'feedback') return;

        const clickPoint = e.latlng;
        const tolerance = CONFIG.CLICK_TOLERANCE_METERS;
        const coreLayers = state.getCoreLayers();
        const customLayers = state.getCustomLayers();

        let nearestFeature = null;
        let nearestDistance = tolerance;
        let nearestPoint = null;

        // Check paths layer
        if (coreLayers.paths.filteredData && coreLayers.paths.filteredData.features) {
            for (const feature of coreLayers.paths.filteredData.features) {
                const result = findNearestPointOnFeature(clickPoint, feature);
                if (result && result.distance < nearestDistance) {
                    nearestDistance = result.distance;
                    nearestFeature = feature;
                    nearestPoint = result.point;
                }
            }
        }

        // Check lanes layer
        if (coreLayers.lanes.filteredData && coreLayers.lanes.filteredData.features) {
            for (const feature of coreLayers.lanes.filteredData.features) {
                const result = findNearestPointOnFeature(clickPoint, feature);
                if (result && result.distance < nearestDistance) {
                    nearestDistance = result.distance;
                    nearestFeature = feature;
                    nearestPoint = result.point;
                }
            }
        }

        // Check custom line layers
        for (const [layerId, info] of Object.entries(customLayers)) {
            if (info.geometryType === 'line' && info.filteredData && info.filteredData.features) {
                for (const feature of info.filteredData.features) {
                    const result = findNearestPointOnFeature(clickPoint, feature);
                    if (result && result.distance < nearestDistance) {
                        nearestDistance = result.distance;
                        nearestFeature = feature;
                        nearestPoint = result.point;
                    }
                }
            }
        }

        if (nearestFeature) {
            const syntheticEvent = {
                latlng: nearestPoint || clickPoint,
                originalEvent: e.originalEvent
            };
            handleFeedbackClick(syntheticEvent, nearestFeature, null);
        }
    });
}

/**
 * Initialize feedback form validation listeners
 */
export function initFeedbackValidation() {
    const categorySelect = document.getElementById('feedbackCategory');
    if (categorySelect) {
        categorySelect.addEventListener('change', validateFeedbackForm);
    }
}

/**
 * Feedback system with image attachments and server submission
 * @module feedback
 */

import * as state from './state.js';
import { CONFIG, FEEDBACK_CATEGORIES } from './config.js';
import { findNearestPointOnFeature, downloadFile } from './utils.js';
import { applyFeedbackFilters, updateFilterPanel } from './filters.js';
import { validateImage, compressImage, processImages, createThumbnail, createImageReferences } from './image-utils.js';
import { createVoteButtonsHTML, initVoteData, filterByDate, getDateFilter, getDatePresets } from './community.js';

// Callbacks for cross-module communication
let setModeCallback = null;
let updateSelectionStatusCallback = null;

// Image attachments storage
let pendingImages = [];
const MAX_IMAGES = 3;

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

    // Clear pending images
    pendingImages = [];

    // Reset form UI
    document.getElementById('feedbackLocation').style.display = 'none';
    document.getElementById('feedbackForm').style.display = 'none';
    document.getElementById('feedbackCategory').value = '';
    document.getElementById('feedbackComment').value = '';
    document.getElementById('feedbackName').value = '';
    document.getElementById('feedbackEmail').value = '';
    document.querySelectorAll('.feedback-rating button').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('sendFeedbackBtn').disabled = true;
    document.getElementById('downloadFeedbackBtn').disabled = true;

    // Clear image previews
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }

    // Reset image input
    const imageInput = document.getElementById('feedbackImages');
    if (imageInput) {
        imageInput.value = '';
    }

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
    document.getElementById('downloadFeedbackBtn').disabled = !isValid;
}

/**
 * Handle image file selection
 * @param {HTMLInputElement} input - File input element
 */
export async function handleImageSelect(input) {
    const files = input.files;
    if (!files.length) return;

    const previewContainer = document.getElementById('imagePreviewContainer');
    if (!previewContainer) return;

    // Limit total images
    const remainingSlots = MAX_IMAGES - pendingImages.length;
    if (remainingSlots <= 0) {
        alert(`Maximum ${MAX_IMAGES} images allowed`);
        return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    // Show loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.className = 'image-loading';
    loadingEl.textContent = 'Processing images...';
    previewContainer.appendChild(loadingEl);

    try {
        const processed = await processImages(filesToProcess, remainingSlots);

        // Remove loading indicator
        loadingEl.remove();

        processed.forEach((img, index) => {
            if (img.error) {
                console.warn(`Image ${img.originalName} failed: ${img.error}`);
                return;
            }

            pendingImages.push(img);

            // Create thumbnail preview
            const thumbnail = createThumbnail(img.base64, img.originalName, () => {
                // Remove image from pending
                const idx = pendingImages.findIndex(i => i.originalName === img.originalName);
                if (idx > -1) {
                    pendingImages.splice(idx, 1);
                }
                updateImageCount();
            });

            previewContainer.appendChild(thumbnail);
        });

        updateImageCount();

    } catch (error) {
        loadingEl.remove();
        alert('Error processing images: ' + error.message);
    }

    // Reset input for re-selection
    input.value = '';
}

/**
 * Update the image count display
 */
function updateImageCount() {
    const countEl = document.getElementById('imageCount');
    if (countEl) {
        countEl.textContent = `${pendingImages.length}/${MAX_IMAGES} images`;
    }
}

/**
 * Create feedback feature object
 * @returns {Object} GeoJSON feature
 */
function createFeedbackFeature() {
    const feedbackState = state.getFeedbackState();
    const category = document.getElementById('feedbackCategory').value;
    const comment = document.getElementById('feedbackComment').value;
    const name = document.getElementById('feedbackName').value;
    const email = document.getElementById('feedbackEmail').value;

    return {
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
            timestamp: new Date().toISOString(),
            images: pendingImages.length > 0 ? createImageReferences(pendingImages) : []
        }
    };
}

/**
 * Submit feedback to server
 */
export async function submitFeedback() {
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

    // Show loading state
    const submitBtn = document.getElementById('sendFeedbackBtn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('latitude', feedbackState.latlng.lat);
        formData.append('longitude', feedbackState.latlng.lng);
        formData.append('rating', feedbackState.rating);
        formData.append('category', category);
        formData.append('categoryLabel', FEEDBACK_CATEGORIES[category] || category);
        formData.append('comment', document.getElementById('feedbackComment').value);
        formData.append('submitterName', document.getElementById('feedbackName').value);
        formData.append('submitterEmail', document.getElementById('feedbackEmail').value);
        formData.append('pathName', feedbackState.pathInfo.name);
        formData.append('pathType', feedbackState.pathInfo.type);
        formData.append('pathSurface', feedbackState.pathInfo.surface);
        formData.append('suburb', feedbackState.pathInfo.suburb);

        // Add images
        for (const img of pendingImages) {
            // Convert base64 to blob
            const response = await fetch(img.base64);
            const blob = await response.blob();
            formData.append('images', blob, img.originalName);
        }

        // Submit to server
        const apiUrl = state.getApiUrl ? state.getApiUrl() : '/api';
        const result = await fetch(`${apiUrl}/feedback`, {
            method: 'POST',
            body: formData
        });

        if (result.ok) {
            const data = await result.json();
            alert('Feedback submitted successfully! Thank you for your input.');
            resetFeedbackForm();

            // Refresh feedback layer if loaded
            if (typeof updateFeedbackLayer === 'function') {
                // Reload from server
                loadFeedbackFromServer();
            }
        } else {
            const error = await result.json();
            throw new Error(error.error || 'Submission failed');
        }

    } catch (error) {
        console.error('Error submitting feedback:', error);

        // Offer to download locally if server fails
        if (confirm(`Could not submit to server: ${error.message}\n\nWould you like to download your feedback locally instead?`)) {
            downloadFeedback();
        }
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
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

    const feedbackFeature = createFeedbackFeature();

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
 * Load feedback from server
 */
export async function loadFeedbackFromServer() {
    try {
        const apiUrl = state.getApiUrl ? state.getApiUrl() : '/api';
        const response = await fetch(`${apiUrl}/feedback`);

        if (!response.ok) {
            throw new Error('Failed to fetch feedback');
        }

        const geojson = await response.json();
        const feedbackData = state.getFeedbackData();

        // Clear existing and load server data
        feedbackData.features = geojson.features || [];

        // Initialize vote data for community features
        initVoteData(feedbackData.features);

        updateFeedbackLayer();
        document.getElementById('feedbackLayerInfo').style.display = 'block';
        document.getElementById('feedbackLayerInfo').innerHTML =
            `✓ Loaded ${feedbackData.features.length} feedback point(s) from server`;
        updateFilterPanel();

    } catch (error) {
        console.error('Error loading feedback from server:', error);
    }
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
                    // Initialize vote data for community features
                    initVoteData(feedbackData.features);

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

    // Apply filters (including date filter)
    let filteredFeatures = applyFeedbackFilters(feedbackData.features);
    filteredFeatures = filterByDate(filteredFeatures);

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

            let imagesHtml = '';
            if (props.images && props.images.length > 0) {
                imagesHtml = `
                    <div class="feedback-images">
                        ${props.images.map(img =>
                            `<img src="${img.url || img.data}" alt="Feedback image" onclick="window.open('${img.url || img.data}')" style="width:80px;height:60px;object-fit:cover;cursor:pointer;border-radius:4px;margin:2px;">`
                        ).join('')}
                    </div>
                `;
            }

            let popupContent = `
                <div class="feedback-popup">
                    <div class="rating" style="color: ${ratingColor};">${ratingEmoji} ${props.rating === 'good' ? 'Good' : 'Bad'}</div>
                    <div class="category">${props.categoryLabel || props.category}</div>
                    ${props.comment ? `<div class="comment">${props.comment}</div>` : ''}
                    ${imagesHtml}
                    <div class="meta">
                        <strong>Path:</strong> ${props.pathName || 'Unknown'}<br>
                        <strong>Suburb:</strong> ${props.suburb || 'Unknown'}<br>
                        ${props.submitterName ? `<strong>By:</strong> ${props.submitterName}<br>` : ''}
                        <strong>Date:</strong> ${props.timestamp ? new Date(props.timestamp).toLocaleDateString() : 'Unknown'}
                    </div>
                    ${createVoteButtonsHTML(feature)}
                </div>
            `;

            layer.bindPopup(popupContent, { maxWidth: 350 });
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
        let filteredFeatures = applyFeedbackFilters(feedbackData.features);
        filteredFeatures = filterByDate(filteredFeatures);
        const filteredCount = filteredFeatures.length;

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

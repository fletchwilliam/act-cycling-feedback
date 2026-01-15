/**
 * Filter panel and filter logic
 * @module filters
 */

import * as state from './state.js';
import { COLOR_PALETTE, FEEDBACK_CATEGORIES } from './config.js';
import { getAvailableFilterFields, getUniqueValues, formatFieldName } from './utils.js';

// Callbacks for cross-module communication
let applyLayerFiltersCallback = null;
let updateFeedbackLayerCallback = null;

/**
 * Set callback functions for cross-module communication
 */
export function setFilterCallbacks(callbacks) {
    if (callbacks.applyLayerFilters) applyLayerFiltersCallback = callbacks.applyLayerFilters;
    if (callbacks.updateFeedbackLayer) updateFeedbackLayerCallback = callbacks.updateFeedbackLayer;
}

/**
 * Apply filters to GeoJSON data
 * @param {Object} data - GeoJSON data
 * @param {Object} filters - Filter configuration
 * @returns {Object} Filtered GeoJSON data
 */
export function applyFilters(data, filters) {
    if (!data || !data.features) return data;
    if (Object.keys(filters).length === 0) return data;

    const filteredFeatures = data.features.filter(feature => {
        for (const [field, filterConfig] of Object.entries(filters)) {
            const value = feature.properties[field];

            if (filterConfig.type === 'categorical') {
                if (filterConfig.values.length > 0 && !filterConfig.values.includes(value)) {
                    return false;
                }
            } else if (filterConfig.type === 'numeric') {
                if (typeof value === 'number') {
                    if (filterConfig.min !== undefined && value < filterConfig.min) return false;
                    if (filterConfig.max !== undefined && value > filterConfig.max) return false;
                }
            }
        }
        return true;
    });

    return { ...data, features: filteredFeatures };
}

/**
 * Apply feedback filters
 * @param {Array} features - Feedback features
 * @returns {Array} Filtered features
 */
export function applyFeedbackFilters(features) {
    const feedbackFilters = state.getFeedbackFilters();

    if (!feedbackFilters.rating.length && !feedbackFilters.category.length) {
        return features;
    }

    return features.filter(f => {
        const props = f.properties;

        if (feedbackFilters.rating.length > 0 && !feedbackFilters.rating.includes(props.rating)) {
            return false;
        }

        if (feedbackFilters.category.length > 0 && !feedbackFilters.category.includes(props.category)) {
            return false;
        }

        return true;
    });
}

/**
 * Update the filter panel UI
 */
export function updateFilterPanel() {
    const container = document.getElementById('filterContent');
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();
    const feedbackData = state.getFeedbackData();
    let html = '';

    // Core layers filters
    if (coreLayers.paths.data) {
        html += buildFilterSection('paths', 'Community Paths', coreLayers.paths.data.features, coreLayers.paths.filters);
    }

    if (coreLayers.lanes.data) {
        html += buildFilterSection('lanes', 'Cycle Lanes', coreLayers.lanes.data.features, coreLayers.lanes.filters);
    }

    // Feedback layer filters
    if (feedbackData.features.length > 0) {
        html += buildFeedbackFilterSection();
    }

    // Custom layers filters
    for (const [layerId, info] of Object.entries(customLayers)) {
        if (layerId === 'feedback') continue;
        if (info.data && info.data.features) {
            html += buildFilterSection(layerId, info.name, info.data.features, info.filters || {});
        }
    }

    if (!html) {
        html = '<p class="no-data-msg">Load datasets to enable filtering</p>';
    }

    container.innerHTML = html;
}

/**
 * Build the feedback filter section HTML
 * @returns {string} HTML content
 */
function buildFeedbackFilterSection() {
    const feedbackData = state.getFeedbackData();
    const feedbackFilters = state.getFeedbackFilters();
    const filteredCount = applyFeedbackFilters(feedbackData.features).length;
    const totalCount = feedbackData.features.length;

    const ratings = [...new Set(feedbackData.features.map(f => f.properties.rating))];
    const categories = [...new Set(feedbackData.features.map(f => f.properties.category))];

    let html = `<div class="filter-section">
        <h4>
            Feedback
            <button class="btn btn-sm btn-secondary" onclick="window.appCallbacks.clearFeedbackFilters()">Clear</button>
        </h4>
        <div class="filter-count">Showing ${filteredCount} of ${totalCount} feedback points</div>`;

    // Rating filter
    html += `
        <div class="filter-group">
            <label>Rating</label>
            <div class="select-all-row">
                <button onclick="window.appCallbacks.selectAllFeedbackFilter('rating')">All</button>
                <button onclick="window.appCallbacks.selectNoneFeedbackFilter('rating')">None</button>
            </div>
            <div class="checkbox-group">`;

    const ratingLabels = { 'good': '👍 Good', 'bad': '👎 Bad' };
    for (const rating of ['good', 'bad']) {
        if (!ratings.includes(rating)) continue;
        const checked = feedbackFilters.rating.length === 0 || feedbackFilters.rating.includes(rating) ? 'checked' : '';
        html += `
            <div class="checkbox-item">
                <input type="checkbox" id="fb-rating-${rating}" ${checked}
                    onchange="window.appCallbacks.toggleFeedbackFilterValue('rating', '${rating}', this.checked)">
                <label for="fb-rating-${rating}">${ratingLabels[rating]}</label>
            </div>`;
    }
    html += `</div></div>`;

    // Category filter
    html += `
        <div class="filter-group">
            <label>Category</label>
            <div class="select-all-row">
                <button onclick="window.appCallbacks.selectAllFeedbackFilter('category')">All</button>
                <button onclick="window.appCallbacks.selectNoneFeedbackFilter('category')">None</button>
            </div>
            <div class="checkbox-group">`;

    for (const cat of ['surface', 'safety', 'lighting', 'other']) {
        if (!categories.includes(cat)) continue;
        const checked = feedbackFilters.category.length === 0 || feedbackFilters.category.includes(cat) ? 'checked' : '';
        html += `
            <div class="checkbox-item">
                <input type="checkbox" id="fb-cat-${cat}" ${checked}
                    onchange="window.appCallbacks.toggleFeedbackFilterValue('category', '${cat}', this.checked)">
                <label for="fb-cat-${cat}">${FEEDBACK_CATEGORIES[cat] || cat}</label>
            </div>`;
    }
    html += `</div></div>`;

    html += '</div>';
    return html;
}

/**
 * Build a filter section for a layer
 * @param {string} layerId - Layer ID
 * @param {string} layerName - Layer display name
 * @param {Array} features - Layer features
 * @param {Object} currentFilters - Current filter configuration
 * @returns {string} HTML content
 */
function buildFilterSection(layerId, layerName, features, currentFilters) {
    const { categorical, numeric } = getAvailableFilterFields(features);
    const filterColors = state.getFilterColors();

    if (categorical.length === 0 && numeric.length === 0) {
        return '';
    }

    const filteredCount = applyFilters({ features }, currentFilters).features.length;
    const totalCount = features.length;

    let html = `<div class="filter-section">
        <h4>
            ${layerName}
            <button class="btn btn-sm btn-secondary" onclick="window.appCallbacks.clearFilters('${layerId}')">Clear</button>
        </h4>
        <div class="filter-count">Showing ${filteredCount} of ${totalCount} features</div>`;

    // Categorical filters
    for (const { field, values } of categorical) {
        const selectedValues = currentFilters[field]?.values || values;
        const colorConfig = filterColors[layerId] || { enabled: false, field: null, colors: {} };
        const isColorField = colorConfig.enabled && colorConfig.field === field;

        // Initialize colors for this field
        state.initFilterColors(layerId, field, values);
        const fieldColors = filterColors[layerId]?.colors[field] || {};

        html += `
            <div class="filter-group">
                <label>${formatFieldName(field)}</label>
                <div class="filter-color-mode">
                    <input type="checkbox" id="color-by-${layerId}-${field}"
                        ${isColorField ? 'checked' : ''}
                        onchange="window.appCallbacks.setColorByField('${layerId}', '${field}', this.checked)">
                    <label for="color-by-${layerId}-${field}">Color by this field</label>
                </div>
                <div class="select-all-row">
                    <button onclick="window.appCallbacks.selectAllValues('${layerId}', '${field}')">All</button>
                    <button onclick="window.appCallbacks.selectNoneValues('${layerId}', '${field}')">None</button>
                </div>
                <div class="checkbox-group" id="filter-${layerId}-${field}">`;

        for (const val of values) {
            const checked = selectedValues.includes(val) ? 'checked' : '';
            const escapedVal = String(val).replace(/'/g, "\\'");
            const currentColor = fieldColors[val] || COLOR_PALETTE[0];
            html += `
                <div class="checkbox-item">
                    <input type="checkbox" id="cb-${layerId}-${field}-${val}" ${checked}
                        onchange="window.appCallbacks.updateCategoricalFilter('${layerId}', '${field}', '${escapedVal}', this.checked)">
                    <label for="cb-${layerId}-${field}-${val}">${val}</label>
                    <input type="color" value="${currentColor}"
                        onchange="window.appCallbacks.setFilterValueColor('${layerId}', '${field}', '${escapedVal}', this.value)"
                        title="Set color for ${val}">
                </div>`;
        }

        html += `</div></div>`;
    }

    // Numeric filters
    for (const { field, min, max } of numeric) {
        const currentMin = currentFilters[field]?.min ?? min;
        const currentMax = currentFilters[field]?.max ?? max;
        html += `
            <div class="filter-group">
                <label>${formatFieldName(field)} (${min.toFixed(1)} - ${max.toFixed(1)})</label>
                <div class="filter-row">
                    <input type="number" placeholder="Min" value="${currentMin}" step="0.1"
                        onchange="window.appCallbacks.updateNumericFilter('${layerId}', '${field}', 'min', this.value)">
                    <span>to</span>
                    <input type="number" placeholder="Max" value="${currentMax}" step="0.1"
                        onchange="window.appCallbacks.updateNumericFilter('${layerId}', '${field}', 'max', this.value)">
                </div>
            </div>`;
    }

    html += '</div>';
    return html;
}

/**
 * Toggle a feedback filter value
 * @param {string} filterType - 'rating' or 'category'
 * @param {string} value - Filter value
 * @param {boolean} isChecked - Whether checked
 */
export function toggleFeedbackFilterValue(filterType, value, isChecked) {
    const feedbackFilters = state.getFeedbackFilters();
    const allValues = filterType === 'rating' ? ['good', 'bad'] : ['surface', 'safety', 'lighting', 'other'];

    // If filters are empty, initialize with all values
    if (feedbackFilters[filterType].length === 0) {
        feedbackFilters[filterType] = [...allValues];
    }

    if (isChecked) {
        if (!feedbackFilters[filterType].includes(value)) {
            feedbackFilters[filterType].push(value);
        }
    } else {
        const idx = feedbackFilters[filterType].indexOf(value);
        if (idx > -1) {
            feedbackFilters[filterType].splice(idx, 1);
        }
    }

    // If all values selected, clear the filter
    if (feedbackFilters[filterType].length === allValues.length) {
        feedbackFilters[filterType] = [];
    }

    if (updateFeedbackLayerCallback) updateFeedbackLayerCallback();
}

/**
 * Select all feedback filter values
 * @param {string} filterType - 'rating' or 'category'
 */
export function selectAllFeedbackFilter(filterType) {
    const feedbackFilters = state.getFeedbackFilters();
    feedbackFilters[filterType] = [];
    if (updateFeedbackLayerCallback) updateFeedbackLayerCallback();
    updateFilterPanel();
}

/**
 * Select none feedback filter values
 * @param {string} filterType - 'rating' or 'category'
 */
export function selectNoneFeedbackFilter(filterType) {
    const feedbackFilters = state.getFeedbackFilters();
    feedbackFilters[filterType] = ['__none__'];
    if (updateFeedbackLayerCallback) updateFeedbackLayerCallback();
    updateFilterPanel();
}

/**
 * Clear all feedback filters
 */
export function clearFeedbackFilters() {
    state.resetFeedbackFilters();
    if (updateFeedbackLayerCallback) updateFeedbackLayerCallback();
    updateFilterPanel();
}

/**
 * Set color-by-field mode for a layer
 * @param {string} layerId - Layer ID
 * @param {string} field - Field name
 * @param {boolean} enabled - Whether enabled
 */
export function setColorByField(layerId, field, enabled) {
    const filterColors = state.getFilterColors();

    if (!filterColors[layerId]) {
        filterColors[layerId] = { enabled: false, field: null, colors: {} };
    }

    if (enabled) {
        filterColors[layerId].enabled = true;
        filterColors[layerId].field = field;
    } else {
        filterColors[layerId].enabled = false;
        filterColors[layerId].field = null;
    }

    // Uncheck other color-by checkboxes
    document.querySelectorAll(`input[id^="color-by-${layerId}-"]`).forEach(cb => {
        if (cb.id !== `color-by-${layerId}-${field}`) {
            cb.checked = false;
        }
    });

    if (applyLayerFiltersCallback) applyLayerFiltersCallback(layerId);
}

/**
 * Set color for a specific filter value
 * @param {string} layerId - Layer ID
 * @param {string} field - Field name
 * @param {string} value - Field value
 * @param {string} color - Color hex code
 */
export function setFilterValueColor(layerId, field, value, color) {
    const filterColors = state.getFilterColors();

    if (!filterColors[layerId]) {
        filterColors[layerId] = { enabled: false, field: null, colors: {} };
    }
    if (!filterColors[layerId].colors[field]) {
        filterColors[layerId].colors[field] = {};
    }

    filterColors[layerId].colors[field][value] = color;

    if (filterColors[layerId].enabled && filterColors[layerId].field === field) {
        if (applyLayerFiltersCallback) applyLayerFiltersCallback(layerId);
    }
}

/**
 * Get feature color based on filter settings
 * @param {string} layerId - Layer ID
 * @param {Object} feature - GeoJSON feature
 * @returns {string|null} Color or null
 */
export function getFeatureColorByFilter(layerId, feature) {
    const filterColors = state.getFilterColors();
    const colorConfig = filterColors[layerId];

    if (!colorConfig || !colorConfig.enabled || !colorConfig.field) {
        return null;
    }

    const fieldValue = feature.properties[colorConfig.field];
    if (fieldValue && colorConfig.colors[colorConfig.field]) {
        return colorConfig.colors[colorConfig.field][fieldValue] || null;
    }
    return null;
}

/**
 * Update a categorical filter
 * @param {string} layerId - Layer ID
 * @param {string} field - Field name
 * @param {string} value - Filter value
 * @param {boolean} isChecked - Whether checked
 */
export function updateCategoricalFilter(layerId, field, value, isChecked) {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();

    let layerInfo;
    if (layerId === 'paths' || layerId === 'lanes') {
        layerInfo = coreLayers[layerId];
    } else {
        layerInfo = customLayers[layerId];
    }

    if (!layerInfo) return;

    if (!layerInfo.filters) layerInfo.filters = {};
    if (!layerInfo.filters[field]) {
        const allValues = getUniqueValues(layerInfo.data.features, field);
        layerInfo.filters[field] = { type: 'categorical', values: [...allValues] };
    }

    const filterValues = layerInfo.filters[field].values;
    if (isChecked && !filterValues.includes(value)) {
        filterValues.push(value);
    } else if (!isChecked) {
        const idx = filterValues.indexOf(value);
        if (idx > -1) filterValues.splice(idx, 1);
    }

    if (applyLayerFiltersCallback) applyLayerFiltersCallback(layerId);
}

/**
 * Update a numeric filter
 * @param {string} layerId - Layer ID
 * @param {string} field - Field name
 * @param {string} bound - 'min' or 'max'
 * @param {string} value - Filter value
 */
export function updateNumericFilter(layerId, field, bound, value) {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();

    let layerInfo;
    if (layerId === 'paths' || layerId === 'lanes') {
        layerInfo = coreLayers[layerId];
    } else {
        layerInfo = customLayers[layerId];
    }

    if (!layerInfo) return;

    if (!layerInfo.filters) layerInfo.filters = {};
    if (!layerInfo.filters[field]) {
        layerInfo.filters[field] = { type: 'numeric' };
    }

    layerInfo.filters[field][bound] = parseFloat(value);
    if (applyLayerFiltersCallback) applyLayerFiltersCallback(layerId);
}

/**
 * Select all values for a filter
 * @param {string} layerId - Layer ID
 * @param {string} field - Field name
 */
export function selectAllValues(layerId, field) {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();

    let layerInfo;
    if (layerId === 'paths' || layerId === 'lanes') {
        layerInfo = coreLayers[layerId];
    } else {
        layerInfo = customLayers[layerId];
    }

    if (!layerInfo || !layerInfo.data) return;

    const allValues = getUniqueValues(layerInfo.data.features, field);
    if (!layerInfo.filters) layerInfo.filters = {};
    layerInfo.filters[field] = { type: 'categorical', values: [...allValues] };

    if (applyLayerFiltersCallback) applyLayerFiltersCallback(layerId);
    updateFilterPanel();
}

/**
 * Select no values for a filter
 * @param {string} layerId - Layer ID
 * @param {string} field - Field name
 */
export function selectNoneValues(layerId, field) {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();

    let layerInfo;
    if (layerId === 'paths' || layerId === 'lanes') {
        layerInfo = coreLayers[layerId];
    } else {
        layerInfo = customLayers[layerId];
    }

    if (!layerInfo) return;

    if (!layerInfo.filters) layerInfo.filters = {};
    layerInfo.filters[field] = { type: 'categorical', values: [] };

    if (applyLayerFiltersCallback) applyLayerFiltersCallback(layerId);
    updateFilterPanel();
}

/**
 * Clear all filters for a layer
 * @param {string} layerId - Layer ID
 */
export function clearFilters(layerId) {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();

    let layerInfo;
    if (layerId === 'paths' || layerId === 'lanes') {
        layerInfo = coreLayers[layerId];
    } else {
        layerInfo = customLayers[layerId];
    }

    if (!layerInfo) return;

    layerInfo.filters = {};
    if (applyLayerFiltersCallback) applyLayerFiltersCallback(layerId);
    updateFilterPanel();
}

/**
 * Layer styling functionality
 * @module styles
 */

import * as state from './state.js';
import { STYLE_PRESETS } from './config.js';
import { getPathColor, getLaneColor } from './utils.js';
import { getFeatureColorByFilter } from './filters.js';

// Callbacks for cross-module communication
let applyPathsFiltersCallback = null;
let applyLanesFiltersCallback = null;
let applyCustomLayerFiltersCallback = null;

/**
 * Set callback functions for cross-module communication
 */
export function setStyleCallbacks(callbacks) {
    if (callbacks.applyPathsFilters) applyPathsFiltersCallback = callbacks.applyPathsFilters;
    if (callbacks.applyLanesFilters) applyLanesFiltersCallback = callbacks.applyLanesFilters;
    if (callbacks.applyCustomLayerFilters) applyCustomLayerFiltersCallback = callbacks.applyCustomLayerFilters;
}

/**
 * Update the style panel UI
 */
export function updateStylePanel() {
    const container = document.getElementById('layerStylesList');
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();
    const layerStyles = state.getLayerStyles();
    let html = '';

    // Paths style section
    if (coreLayers.paths.data) {
        html += buildStyleSection('paths', 'Community Paths', layerStyles.paths, '#4CAF50');
    }

    // Lanes style section
    if (coreLayers.lanes.data) {
        html += buildStyleSection('lanes', 'Cycle Lanes', layerStyles.lanes, '#ff9800');
    }

    // Custom layers
    for (const [layerId, info] of Object.entries(customLayers)) {
        const customLayerStyles = state.getCustomLayerStyles();
        state.getOrCreateCustomLayerStyle(layerId, info.color, info.geometryType);
        html += buildStyleSection(layerId, info.name, customLayerStyles[layerId], info.color, info.geometryType);
    }

    if (!html) {
        html = '<p style="color: #888; font-style: italic; font-size: 11px; padding: 10px;">Load datasets to customize their styles</p>';
    }

    container.innerHTML = html;
}

/**
 * Build a style section for a layer
 * @param {string} layerId - Layer ID
 * @param {string} name - Layer display name
 * @param {Object} styles - Current styles
 * @param {string} defaultColor - Default color
 * @param {string} geometryType - Geometry type
 * @returns {string} HTML content
 */
function buildStyleSection(layerId, name, styles, defaultColor, geometryType = 'line') {
    const isPoint = geometryType === 'point';
    const isCustom = layerId.startsWith('custom_');

    let html = `<div class="style-section">
        <h4>
            <span class="color-dot" style="background: ${styles.color || styles.singleColor || defaultColor};"></span>
            ${name}
        </h4>`;

    // Color options
    if (!isCustom || isPoint) {
        html += `
        <div class="style-row">
            <label>Color:</label>
            <input type="color" value="${styles.color || styles.singleColor || defaultColor}"
                onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'color', this.value)">
        </div>`;
    } else {
        html += `
        <div class="style-row">
            <label>Use type colors:</label>
            <input type="checkbox" ${styles.useTypeColors ? 'checked' : ''}
                onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'useTypeColors', this.checked)">
        </div>
        <div class="style-row">
            <label>Single color:</label>
            <input type="color" value="${styles.singleColor || defaultColor}"
                onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'singleColor', this.value)"
                ${styles.useTypeColors ? 'disabled' : ''}>
        </div>`;
    }

    // Line/stroke weight
    html += `
        <div class="style-row">
            <label>${isPoint ? 'Border:' : 'Width:'}</label>
            <input type="range" min="1" max="15" value="${styles.weight || 3}"
                oninput="document.getElementById('weight-val-${layerId}').textContent = this.value"
                onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'weight', parseFloat(this.value))">
            <span class="value-display" id="weight-val-${layerId}">${styles.weight || 3}</span>
        </div>`;

    // Opacity
    html += `
        <div class="style-row">
            <label>Opacity:</label>
            <input type="range" min="0.1" max="1" step="0.1" value="${styles.opacity || 0.8}"
                oninput="document.getElementById('opacity-val-${layerId}').textContent = (this.value * 100).toFixed(0) + '%'"
                onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'opacity', parseFloat(this.value))">
            <span class="value-display" id="opacity-val-${layerId}">${((styles.opacity || 0.8) * 100).toFixed(0)}%</span>
        </div>`;

    // Point-specific options
    if (isPoint) {
        html += `
        <div class="style-row">
            <label>Size:</label>
            <input type="range" min="3" max="20" value="${styles.radius || 6}"
                oninput="document.getElementById('radius-val-${layerId}').textContent = this.value"
                onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'radius', parseFloat(this.value))">
            <span class="value-display" id="radius-val-${layerId}">${styles.radius || 6}</span>
        </div>
        <div class="style-row">
            <label>Fill opacity:</label>
            <input type="range" min="0" max="1" step="0.1" value="${styles.fillOpacity || 0.8}"
                oninput="document.getElementById('fill-val-${layerId}').textContent = (this.value * 100).toFixed(0) + '%'"
                onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'fillOpacity', parseFloat(this.value))">
            <span class="value-display" id="fill-val-${layerId}">${((styles.fillOpacity || 0.8) * 100).toFixed(0)}%</span>
        </div>`;
    }

    // Line-specific options
    if (!isPoint) {
        html += `
        <div class="style-row">
            <label>Dash pattern:</label>
            <select onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'dashArray', this.value)">
                <option value="" ${!styles.dashArray ? 'selected' : ''}>Solid</option>
                <option value="5, 5" ${styles.dashArray === '5, 5' ? 'selected' : ''}>Dashed</option>
                <option value="10, 10" ${styles.dashArray === '10, 10' ? 'selected' : ''}>Long dash</option>
                <option value="2, 4" ${styles.dashArray === '2, 4' ? 'selected' : ''}>Dotted</option>
                <option value="10, 5, 2, 5" ${styles.dashArray === '10, 5, 2, 5' ? 'selected' : ''}>Dash-dot</option>
            </select>
        </div>
        <div class="style-row">
            <label>Line cap:</label>
            <select onchange="window.appCallbacks.updateLayerStyle('${layerId}', 'lineCap', this.value)">
                <option value="round" ${styles.lineCap === 'round' ? 'selected' : ''}>Round</option>
                <option value="square" ${styles.lineCap === 'square' ? 'selected' : ''}>Square</option>
                <option value="butt" ${styles.lineCap === 'butt' ? 'selected' : ''}>Butt</option>
            </select>
        </div>`;
    }

    html += '</div>';
    return html;
}

/**
 * Update a layer style property
 * @param {string} layerId - Layer ID
 * @param {string} property - Property name
 * @param {*} value - New value
 */
export function updateLayerStyle(layerId, property, value) {
    const layerStyles = state.getLayerStyles();
    const customLayerStyles = state.getCustomLayerStyles();

    if (layerId === 'paths') {
        layerStyles.paths[property] = value;
    } else if (layerId === 'lanes') {
        layerStyles.lanes[property] = value;
    } else if (customLayerStyles[layerId]) {
        customLayerStyles[layerId][property] = value;
    }
}

/**
 * Apply all styles to all layers
 */
export function applyAllStyles() {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();

    // Apply to paths
    if (coreLayers.paths.layer && applyPathsFiltersCallback) {
        applyPathsFiltersCallback();
    }

    // Apply to lanes
    if (coreLayers.lanes.layer && applyLanesFiltersCallback) {
        applyLanesFiltersCallback();
    }

    // Apply to custom layers
    for (const layerId of Object.keys(customLayers)) {
        if (applyCustomLayerFiltersCallback) {
            applyCustomLayerFiltersCallback(layerId);
        }
    }

    updateStylePanel();
}

/**
 * Reset all styles to defaults
 */
export function resetAllStyles() {
    const customLayers = state.getCustomLayers();

    state.resetLayerStyles();

    // Reset custom layer styles
    for (const [layerId, info] of Object.entries(customLayers)) {
        state.resetCustomLayerStyle(layerId, info);
    }

    applyAllStyles();
}

/**
 * Apply a style preset
 * @param {string} presetName - Name of the preset
 */
export function applyStylePreset(presetName) {
    const preset = STYLE_PRESETS[presetName];
    if (!preset) return;

    state.applyStylePresetToState(preset);
    applyAllStyles();
}

/**
 * Get computed style for a feature
 * @param {string} layerId - Layer ID
 * @param {Object} feature - GeoJSON feature
 * @returns {Object} Style object
 */
export function getLayerStyle(layerId, feature) {
    const filterColor = getFeatureColorByFilter(layerId, feature);
    const layerStyles = state.getLayerStyles();
    const customLayerStyles = state.getCustomLayerStyles();

    if (layerId === 'paths') {
        const styles = layerStyles.paths;
        let color;
        if (filterColor) {
            color = filterColor;
        } else if (styles.useTypeColors) {
            color = getPathColor(feature?.properties?.ASSET_SUB_TYPE);
        } else {
            color = styles.singleColor;
        }
        return {
            color: color,
            weight: styles.weight,
            opacity: styles.opacity,
            dashArray: styles.dashArray,
            lineCap: styles.lineCap,
            lineJoin: styles.lineJoin
        };
    } else if (layerId === 'lanes') {
        const styles = layerStyles.lanes;
        let color;
        if (filterColor) {
            color = filterColor;
        } else if (styles.useTypeColors) {
            color = getLaneColor(feature?.properties?.ASSET_SUB_TYPE);
        } else {
            color = styles.singleColor;
        }
        return {
            color: color,
            weight: styles.weight,
            opacity: styles.opacity,
            dashArray: styles.dashArray,
            lineCap: styles.lineCap,
            lineJoin: styles.lineJoin
        };
    } else if (customLayerStyles[layerId]) {
        const styles = customLayerStyles[layerId];
        return {
            ...styles,
            color: filterColor || styles.color
        };
    }
    return {};
}

/**
 * Map initialization and basemap handling
 * @module map-core
 */

import { CONFIG, BASEMAP_CONFIGS } from './config.js';
import * as state from './state.js';

/**
 * Initialize the map with default settings
 * @returns {L.Map} The initialized map instance
 */
export function initMap() {
    const map = L.map('map').setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_ZOOM);
    state.setMap(map);

    // Initialize basemaps
    for (const [name, config] of Object.entries(BASEMAP_CONFIGS)) {
        const layer = L.tileLayer(config.url, { attribution: config.attribution });
        state.setBasemap(name, layer);
    }
    state.setBasemap('none', null);

    // Add default basemap
    const basemaps = state.getBasemaps();
    basemaps.streets.addTo(map);
    state.setCurrentBasemap('streets');

    return map;
}

/**
 * Set the active basemap
 * @param {string} name - Name of the basemap to activate
 */
export function setBasemap(name) {
    const map = state.getMap();
    const basemaps = state.getBasemaps();
    const currentBasemap = state.getCurrentBasemap();

    // Remove current basemap
    if (currentBasemap && basemaps[currentBasemap]) {
        map.removeLayer(basemaps[currentBasemap]);
    }

    // Add new basemap
    if (basemaps[name]) {
        basemaps[name].addTo(map);
        basemaps[name].bringToBack();
    }

    state.setCurrentBasemap(name);

    // Update UI
    document.querySelectorAll('.basemap-option').forEach(el => el.classList.remove('active'));
    document.getElementById('basemap-' + name)?.classList.add('active');
}

/**
 * Fit map to show all layers
 */
export function fitMapToAllLayers() {
    const map = state.getMap();
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();
    const allLayers = [];

    if (coreLayers.paths.layer) allLayers.push(coreLayers.paths.layer);
    if (coreLayers.lanes.layer) allLayers.push(coreLayers.lanes.layer);

    for (const layerId of Object.keys(customLayers)) {
        if (customLayers[layerId].layer) {
            allLayers.push(customLayers[layerId].layer);
        }
    }

    if (allLayers.length > 0) {
        const group = L.featureGroup(allLayers);
        map.fitBounds(group.getBounds(), { padding: CONFIG.MAP_PADDING });
    }
}

/**
 * Zoom to a specific layer's bounds
 * @param {string} layerId - ID of the layer to zoom to
 */
export function zoomToLayer(layerId) {
    const customLayers = state.getCustomLayers();
    const layerInfo = customLayers[layerId];
    if (layerInfo && layerInfo.layer) {
        const map = state.getMap();
        map.fitBounds(layerInfo.layer.getBounds(), { padding: CONFIG.SELECTION_PADDING });
    }
}

/**
 * Toggle the control panel visibility
 */
export function togglePanel() {
    const panel = document.getElementById('controlPanel');
    const btn = document.querySelector('.collapse-btn');
    panel.classList.toggle('collapsed');
    btn.classList.toggle('collapsed');
    btn.textContent = panel.classList.contains('collapsed') ? '☰ Show Panel' : '☰ Panel';
}

/**
 * Toggle the filter panel visibility
 */
export function toggleFilterPanel() {
    const panel = document.getElementById('filterPanel');
    const btn = document.getElementById('filterToggleBtn');
    panel.classList.toggle('collapsed');
    btn.classList.toggle('panel-open');
}

/**
 * Toggle the style panel visibility
 * @param {Function} updateCallback - Callback to update style panel content
 */
export function toggleStylePanel(updateCallback) {
    const panel = document.getElementById('stylePanel');
    panel.classList.toggle('visible');
    if (panel.classList.contains('visible') && updateCallback) {
        updateCallback();
    }
}

/**
 * Get the map instance
 * @returns {L.Map} The map instance
 */
export function getMap() {
    return state.getMap();
}

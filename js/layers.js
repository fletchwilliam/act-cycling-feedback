/**
 * Layer loading, styling, and management
 * @module layers
 */

import * as state from './state.js';
import { formatPopupContent, detectGeometryType, getPathColor, getLaneColor } from './utils.js';
import { fitMapToAllLayers } from './map-core.js';

// Callbacks for cross-module communication
let updateStatsCallback = null;
let updateFilterPanelCallback = null;
let attachFeedbackClickHandlerCallback = null;
let getLayerStyleCallback = null;
let applyFiltersCallback = null;

/**
 * Set callback functions for cross-module communication
 */
export function setLayerCallbacks(callbacks) {
    if (callbacks.updateStats) updateStatsCallback = callbacks.updateStats;
    if (callbacks.updateFilterPanel) updateFilterPanelCallback = callbacks.updateFilterPanel;
    if (callbacks.attachFeedbackClickHandler) attachFeedbackClickHandlerCallback = callbacks.attachFeedbackClickHandler;
    if (callbacks.getLayerStyle) getLayerStyleCallback = callbacks.getLayerStyle;
    if (callbacks.applyFilters) applyFiltersCallback = callbacks.applyFilters;
}

/**
 * Create a Leaflet layer from GeoJSON data
 * @param {Object} geojson - GeoJSON data
 * @param {string} color - Default color
 * @param {string} geometryType - Type of geometry ('point', 'line', 'polygon', 'auto')
 * @param {string} layerName - Name of the layer
 * @param {string} layerId - Optional layer ID for custom styles
 * @returns {L.GeoJSON} Leaflet GeoJSON layer
 */
export function createLayerFromGeoJSON(geojson, color, geometryType, layerName, layerId = null) {
    const actualType = geometryType === 'auto' ? detectGeometryType(geojson) : geometryType;
    const customLayerStyles = state.getCustomLayerStyles();
    const styles = layerId && customLayerStyles[layerId]
        ? customLayerStyles[layerId]
        : { color, weight: 3, opacity: 0.8, radius: 6, fillOpacity: 0.8 };

    if (actualType === 'point') {
        return L.geoJSON(geojson, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: styles.radius || 6,
                    fillColor: styles.color || color,
                    color: '#fff',
                    weight: styles.weight || 2,
                    opacity: styles.opacity || 1,
                    fillOpacity: styles.fillOpacity || 0.8
                });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(formatPopupContent(feature.properties, layerName));
            }
        });
    } else if (actualType === 'line') {
        return L.geoJSON(geojson, {
            style: {
                color: styles.color || color,
                weight: styles.weight || 3,
                opacity: styles.opacity || 0.8,
                dashArray: styles.dashArray || '',
                lineCap: styles.lineCap || 'round',
                lineJoin: styles.lineJoin || 'round'
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(formatPopupContent(feature.properties, layerName));
                if (attachFeedbackClickHandlerCallback) {
                    attachFeedbackClickHandlerCallback(layer, feature);
                }
            }
        });
    } else {
        return L.geoJSON(geojson, {
            style: {
                color: styles.color || color,
                weight: styles.weight || 2,
                opacity: styles.opacity || 0.8,
                fillColor: styles.color || color,
                fillOpacity: styles.fillOpacity || 0.3,
                dashArray: styles.dashArray || ''
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(formatPopupContent(feature.properties, layerName));
            }
        });
    }
}

/**
 * Load a core dataset (paths or lanes)
 * @param {HTMLInputElement} input - File input element
 * @param {string} type - Dataset type ('paths' or 'lanes')
 */
/**
 * Load a core dataset from a URL
 * @param {string} url - URL to the GeoJSON file
 * @param {string} type - Layer type ('paths' or 'lanes')
 * @param {string} displayName - Display name for the layer
 */
export async function loadCoreDatasetFromUrl(url, type, displayName) {
    const map = state.getMap();
    const coreLayers = state.getCoreLayers();

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
        const geojson = await response.json();

        if (coreLayers[type].layer) {
            map.removeLayer(coreLayers[type].layer);
        }

        coreLayers[type].data = geojson;
        coreLayers[type].filteredData = geojson;
        coreLayers[type].filters = {};

        coreLayers[type].layer = L.geoJSON(geojson, {
            style: function(feature) {
                if (getLayerStyleCallback) {
                    return getLayerStyleCallback(type, feature);
                }
                const color = type === 'paths'
                    ? getPathColor(feature?.properties?.ASSET_SUB_TYPE)
                    : getLaneColor(feature?.properties?.ASSET_SUB_TYPE);
                return { color, weight: 3, opacity: 0.8 };
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(formatPopupContent(feature.properties, displayName));
                if (attachFeedbackClickHandlerCallback) {
                    attachFeedbackClickHandlerCallback(layer, feature);
                }
            }
        }).addTo(map);

        const checkboxId = type === 'paths' ? 'togglePaths' : 'toggleLanes';
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) checkbox.checked = true;

        fitMapToAllLayers();
        if (updateStatsCallback) updateStatsCallback();
        if (updateFilterPanelCallback) updateFilterPanelCallback();

        return true;
    } catch (err) {
        console.error('Error loading dataset:', err);
        alert('Error loading dataset: ' + err.message);
        return false;
    }
}

export function loadCoreDataset(input, type) {
    const file = input.files[0];
    if (!file) return;

    const map = state.getMap();
    const coreLayers = state.getCoreLayers();

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const geojson = JSON.parse(e.target.result);

            if (coreLayers[type].layer) {
                map.removeLayer(coreLayers[type].layer);
            }

            coreLayers[type].data = geojson;
            coreLayers[type].filteredData = geojson;
            coreLayers[type].filters = {};

            const layerName = type === 'paths' ? 'Community Path' : 'Cycle Lane';

            coreLayers[type].layer = L.geoJSON(geojson, {
                style: function(feature) {
                    if (getLayerStyleCallback) {
                        return getLayerStyleCallback(type, feature);
                    }
                    // Fallback style
                    const color = type === 'paths'
                        ? getPathColor(feature?.properties?.ASSET_SUB_TYPE)
                        : getLaneColor(feature?.properties?.ASSET_SUB_TYPE);
                    return { color, weight: 3, opacity: 0.8 };
                },
                onEachFeature: function(feature, layer) {
                    layer.bindPopup(formatPopupContent(feature.properties, layerName));
                    if (attachFeedbackClickHandlerCallback) {
                        attachFeedbackClickHandlerCallback(layer, feature);
                    }
                }
            }).addTo(map);

            const checkboxId = type === 'paths' ? 'togglePaths' : 'toggleLanes';
            document.getElementById(checkboxId).checked = true;

            fitMapToAllLayers();
            if (updateStatsCallback) updateStatsCallback();
            if (updateFilterPanelCallback) updateFilterPanelCallback();

        } catch (err) {
            alert('Error parsing GeoJSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

/**
 * Add a custom layer
 */
export function addCustomLayer() {
    const map = state.getMap();
    const customLayers = state.getCustomLayers();

    const fileInput = document.getElementById('customLayerFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a GeoJSON file');
        return;
    }

    const layerName = document.getElementById('layerName').value || file.name.replace('.geojson', '').replace('.json', '');
    const color = document.getElementById('layerColor').value;
    const geometryType = document.getElementById('layerType').value;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const geojson = JSON.parse(e.target.result);
            const layerId = state.generateLayerId();

            const detectedType = geometryType === 'auto' ? detectGeometryType(geojson) : geometryType;
            const layer = createLayerFromGeoJSON(geojson, color, detectedType, layerName, layerId);
            layer.addTo(map);

            customLayers[layerId] = {
                name: layerName,
                color: color,
                layer: layer,
                data: geojson,
                filteredData: geojson,
                geometryType: detectedType,
                visible: true,
                filters: {}
            };

            updateCustomLayersList();
            updateCustomLegend();
            fitMapToAllLayers();
            if (updateStatsCallback) updateStatsCallback();
            if (updateFilterPanelCallback) updateFilterPanelCallback();

            fileInput.value = '';
            document.getElementById('layerName').value = '';

        } catch (err) {
            alert('Error parsing GeoJSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

/**
 * Toggle visibility of a core layer
 * @param {string} type - Layer type ('paths' or 'lanes')
 */
export function toggleCoreLayer(type) {
    const map = state.getMap();
    const coreLayers = state.getCoreLayers();

    if (coreLayers[type].layer) {
        const checkbox = document.getElementById(type === 'paths' ? 'togglePaths' : 'toggleLanes');
        if (checkbox.checked) {
            map.addLayer(coreLayers[type].layer);
        } else {
            map.removeLayer(coreLayers[type].layer);
        }
    }
}

/**
 * Toggle visibility of a custom layer
 * @param {string} layerId - ID of the custom layer
 */
export function toggleCustomLayer(layerId) {
    const map = state.getMap();
    const customLayers = state.getCustomLayers();
    const layerInfo = customLayers[layerId];

    if (layerInfo) {
        if (layerInfo.visible) {
            map.removeLayer(layerInfo.layer);
            layerInfo.visible = false;
        } else {
            map.addLayer(layerInfo.layer);
            layerInfo.visible = true;
        }
        updateCustomLayersList();
    }
}

/**
 * Remove a custom layer
 * @param {string} layerId - ID of the custom layer to remove
 */
export function removeCustomLayer(layerId) {
    const map = state.getMap();
    const customLayers = state.getCustomLayers();
    const layerInfo = customLayers[layerId];

    if (layerInfo) {
        map.removeLayer(layerInfo.layer);
        delete customLayers[layerId];
        updateCustomLayersList();
        updateCustomLegend();
        if (updateStatsCallback) updateStatsCallback();
        if (updateFilterPanelCallback) updateFilterPanelCallback();
    }
}

/**
 * Update the custom layers list UI
 */
export function updateCustomLayersList() {
    const container = document.getElementById('customLayersList');
    const customLayers = state.getCustomLayers();
    const layerIds = Object.keys(customLayers);

    if (layerIds.length === 0) {
        container.innerHTML = '<p style="color: #888; font-style: italic; font-size: 11px;">No custom layers added yet</p>';
        return;
    }

    let html = '';
    for (const layerId of layerIds) {
        const info = customLayers[layerId];
        const visibilityIcon = info.visible ? '👁️' : '👁️‍🗨️';
        html += `
            <div class="custom-layer-item">
                <div class="layer-info">
                    <div class="color-indicator" style="background: ${info.color};"></div>
                    <span class="layer-name" title="${info.name}">${info.name}</span>
                </div>
                <div class="layer-controls">
                    <button onclick="window.appCallbacks.toggleCustomLayer('${layerId}')" title="Toggle visibility">${visibilityIcon}</button>
                    <button onclick="window.appCallbacks.zoomToLayer('${layerId}')" title="Zoom to layer">🔍</button>
                    <button onclick="window.appCallbacks.removeCustomLayer('${layerId}')" title="Remove layer">🗑️</button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

/**
 * Update the custom legend
 */
export function updateCustomLegend() {
    const container = document.getElementById('customLegend');
    const customLayers = state.getCustomLayers();
    const layerIds = Object.keys(customLayers);

    if (layerIds.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '<h3>Custom Layers</h3>';
    for (const layerId of layerIds) {
        const info = customLayers[layerId];
        const indicatorClass = info.geometryType === 'point' ? 'legend-point' : 'legend-line';
        html += `
            <div class="legend-item">
                <div class="${indicatorClass}" style="background: ${info.color};"></div>
                <span>${info.name}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

/**
 * Update statistics display
 */
export function updateStats() {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();
    let html = '<h4>📊 Statistics</h4>';

    if (coreLayers.paths.data) {
        const allFeatures = coreLayers.paths.data.features;
        const filteredFeatures = coreLayers.paths.filteredData?.features || allFeatures;
        const totalLength = filteredFeatures.reduce((sum, f) => sum + (f.properties.PATH_LENGTH || 0), 0);

        const typeCounts = {};
        filteredFeatures.forEach(f => {
            const type = f.properties.ASSET_SUB_TYPE || 'Other';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        html += '<div style="margin-bottom: 10px;">';
        html += '<strong>Community Paths</strong>';
        html += `<div class="stat-row"><span>Showing:</span><span class="stat-value">${filteredFeatures.length} / ${allFeatures.length}</span></div>`;
        html += `<div class="stat-row"><span>Total length:</span><span class="stat-value">${(totalLength / 1000).toFixed(1)} km</span></div>`;
        html += '<details style="margin-top: 4px;"><summary style="font-size: 11px; cursor: pointer;">By type</summary>';
        html += '<div style="margin-top: 4px; font-size: 11px;">';
        for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
            html += `<div class="stat-row"><span>${type}:</span><span>${count}</span></div>`;
        }
        html += '</div></details></div>';
    }

    if (coreLayers.lanes.data) {
        const allFeatures = coreLayers.lanes.data.features;
        const filteredFeatures = coreLayers.lanes.filteredData?.features || allFeatures;
        const totalLength = filteredFeatures.reduce((sum, f) => sum + (f.properties.LENGTH || 0), 0);

        const typeCounts = {};
        filteredFeatures.forEach(f => {
            const type = f.properties.ASSET_SUB_TYPE || 'Other';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        html += '<div style="margin-bottom: 10px;">';
        html += '<strong>On Road Cycle Lanes</strong>';
        html += `<div class="stat-row"><span>Showing:</span><span class="stat-value">${filteredFeatures.length} / ${allFeatures.length}</span></div>`;
        html += `<div class="stat-row"><span>Total length:</span><span class="stat-value">${(totalLength / 1000).toFixed(1)} km</span></div>`;
        html += '<details style="margin-top: 4px;"><summary style="font-size: 11px; cursor: pointer;">By type</summary>';
        html += '<div style="margin-top: 4px; font-size: 11px;">';
        for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
            html += `<div class="stat-row"><span>${type}:</span><span>${count}</span></div>`;
        }
        html += '</div></details></div>';
    }

    for (const layerId of Object.keys(customLayers)) {
        const info = customLayers[layerId];
        const allFeatures = info.data.features;
        const filteredFeatures = info.filteredData?.features || allFeatures;

        html += '<div style="margin-bottom: 10px;">';
        html += `<strong>${info.name}</strong>`;
        html += `<div class="stat-row"><span>Showing:</span><span class="stat-value">${filteredFeatures.length} / ${allFeatures.length}</span></div>`;
        html += `<div class="stat-row"><span>Geometry:</span><span>${info.geometryType}</span></div>`;
        html += '</div>';
    }

    if (!coreLayers.paths.data && !coreLayers.lanes.data && Object.keys(customLayers).length === 0) {
        html += '<p style="color: #888; font-style: italic;">Load data to see statistics</p>';
    }

    document.getElementById('stats').innerHTML = html;
}

/**
 * Apply filters to paths layer and recreate it
 */
export function applyPathsFilters() {
    const map = state.getMap();
    const coreLayers = state.getCoreLayers();

    if (!coreLayers.paths.data) return;

    if (coreLayers.paths.layer) {
        map.removeLayer(coreLayers.paths.layer);
    }

    const filteredData = applyFiltersCallback
        ? applyFiltersCallback(coreLayers.paths.data, coreLayers.paths.filters)
        : coreLayers.paths.data;
    coreLayers.paths.filteredData = filteredData;

    coreLayers.paths.layer = L.geoJSON(filteredData, {
        style: function(feature) {
            if (getLayerStyleCallback) {
                return getLayerStyleCallback('paths', feature);
            }
            return { color: getPathColor(feature?.properties?.ASSET_SUB_TYPE), weight: 3, opacity: 0.8 };
        },
        onEachFeature: function(feature, layer) {
            layer.bindPopup(formatPopupContent(feature.properties, 'Community Path'));
            if (attachFeedbackClickHandlerCallback) {
                attachFeedbackClickHandlerCallback(layer, feature);
            }
        }
    });

    if (document.getElementById('togglePaths').checked) {
        coreLayers.paths.layer.addTo(map);
    }
}

/**
 * Apply filters to lanes layer and recreate it
 */
export function applyLanesFilters() {
    const map = state.getMap();
    const coreLayers = state.getCoreLayers();

    if (!coreLayers.lanes.data) return;

    if (coreLayers.lanes.layer) {
        map.removeLayer(coreLayers.lanes.layer);
    }

    const filteredData = applyFiltersCallback
        ? applyFiltersCallback(coreLayers.lanes.data, coreLayers.lanes.filters)
        : coreLayers.lanes.data;
    coreLayers.lanes.filteredData = filteredData;

    coreLayers.lanes.layer = L.geoJSON(filteredData, {
        style: function(feature) {
            if (getLayerStyleCallback) {
                return getLayerStyleCallback('lanes', feature);
            }
            return { color: getLaneColor(feature?.properties?.ASSET_SUB_TYPE), weight: 5, opacity: 0.9 };
        },
        onEachFeature: function(feature, layer) {
            layer.bindPopup(formatPopupContent(feature.properties, 'Cycle Lane'));
            if (attachFeedbackClickHandlerCallback) {
                attachFeedbackClickHandlerCallback(layer, feature);
            }
        }
    });

    if (document.getElementById('toggleLanes').checked) {
        coreLayers.lanes.layer.addTo(map);
    }
}

/**
 * Apply filters to a custom layer and recreate it
 * @param {string} layerId - ID of the custom layer
 */
export function applyCustomLayerFilters(layerId) {
    const map = state.getMap();
    const customLayers = state.getCustomLayers();
    const info = customLayers[layerId];

    if (!info || !info.data) return;

    if (info.layer) {
        map.removeLayer(info.layer);
    }

    const filteredData = applyFiltersCallback
        ? applyFiltersCallback(info.data, info.filters || {})
        : info.data;
    info.filteredData = filteredData;

    // Ensure custom layer style exists
    state.getOrCreateCustomLayerStyle(layerId, info.color, info.geometryType);

    info.layer = createLayerFromGeoJSON(filteredData, info.color, info.geometryType, info.name, layerId);

    if (info.visible) {
        info.layer.addTo(map);
    }
}

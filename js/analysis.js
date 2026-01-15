/**
 * Area selection and statistics
 * @module analysis
 */

import * as state from './state.js';
import { CONFIG } from './config.js';
import { featureIntersectsBounds, detectField, downloadFile, escapeCSVValue, copyToClipboard } from './utils.js';
import { resetFeedbackForm } from './feedback.js';

/**
 * Set the interaction mode
 * @param {string} mode - 'pan', 'select', or 'feedback'
 */
export function setMode(mode) {
    const map = state.getMap();
    state.setSelectionMode(mode);

    document.getElementById('panModeBtn').classList.toggle('active', mode === 'pan');
    document.getElementById('selectModeBtn').classList.toggle('active', mode === 'select');
    document.getElementById('feedbackModeBtn').classList.toggle('active', mode === 'feedback');

    if (mode === 'pan') {
        map.dragging.enable();
        map.getContainer().style.cursor = '';
        updateSelectionStatus('Click "Select Area" to begin');
        document.getElementById('feedbackPanel').classList.remove('visible');
    } else if (mode === 'select') {
        map.dragging.disable();
        map.getContainer().style.cursor = 'crosshair';
        updateSelectionStatus('Click and drag to select an area');
        document.getElementById('feedbackPanel').classList.remove('visible');
    } else if (mode === 'feedback') {
        map.dragging.enable();
        map.getContainer().style.cursor = 'pointer';
        updateSelectionStatus('Click on a path to leave feedback');
        document.getElementById('feedbackPanel').classList.add('visible');
        resetFeedbackForm();
    }
}

/**
 * Update the selection status text
 * @param {string} text - Status text to display
 */
export function updateSelectionStatus(text) {
    document.getElementById('selectionStatus').textContent = text;
}

/**
 * Set up selection tool mouse events
 * @param {L.Map} map - Leaflet map instance
 */
export function setupSelectionEvents(map) {
    map.on('mousedown', function(e) {
        if (state.getSelectionMode() !== 'select') return;

        state.setIsDrawing(true);
        state.setSelectionStartPoint(e.latlng);

        const selectionRect = state.getSelectionRect();
        if (selectionRect) {
            map.removeLayer(selectionRect);
        }
    });

    map.on('mousemove', function(e) {
        if (!state.getIsDrawing() || state.getSelectionMode() !== 'select') return;

        const bounds = L.latLngBounds(state.getSelectionStartPoint(), e.latlng);
        let selectionRect = state.getSelectionRect();

        if (selectionRect) {
            selectionRect.setBounds(bounds);
        } else {
            selectionRect = L.rectangle(bounds, {
                color: CONFIG.SELECTION_RECT_COLOR,
                weight: CONFIG.SELECTION_RECT_WEIGHT,
                fillOpacity: CONFIG.SELECTION_RECT_FILL_OPACITY,
                dashArray: CONFIG.SELECTION_RECT_DASH_ARRAY
            }).addTo(map);
            state.setSelectionRect(selectionRect);
        }
    });

    map.on('mouseup', function(e) {
        if (!state.getIsDrawing() || state.getSelectionMode() !== 'select') return;

        state.setIsDrawing(false);
        const bounds = L.latLngBounds(state.getSelectionStartPoint(), e.latlng);
        state.setSelectionBounds(bounds);

        performSelection(bounds);
        setMode('pan');
    });
}

/**
 * Perform selection within bounds
 * @param {L.LatLngBounds} bounds - Selection bounds
 */
export function performSelection(bounds) {
    const coreLayers = state.getCoreLayers();
    const customLayers = state.getCustomLayers();

    state.resetSelectedFeatures();
    const selectedFeatures = state.getSelectedFeatures();

    // Select from core layers
    if (coreLayers.paths.filteredData) {
        selectedFeatures.paths = selectFeaturesInBounds(coreLayers.paths.filteredData.features, bounds);
    }

    if (coreLayers.lanes.filteredData) {
        selectedFeatures.lanes = selectFeaturesInBounds(coreLayers.lanes.filteredData.features, bounds);
    }

    // Select from custom layers
    for (const [layerId, info] of Object.entries(customLayers)) {
        if (info.filteredData && info.visible) {
            selectedFeatures.custom[layerId] = selectFeaturesInBounds(info.filteredData.features, bounds);
        }
    }

    // Count total
    let totalSelected = selectedFeatures.paths.length + selectedFeatures.lanes.length;
    for (const features of Object.values(selectedFeatures.custom)) {
        totalSelected += features.length;
    }

    updateSelectionStatus(`${totalSelected} features selected`);

    if (totalSelected > 0) {
        showAnalysis();
    } else {
        closeAnalysisPanel();
    }
}

/**
 * Select features within bounds
 * @param {Array} features - Array of GeoJSON features
 * @param {L.LatLngBounds} bounds - Selection bounds
 * @returns {Array} Selected features
 */
function selectFeaturesInBounds(features, bounds) {
    if (!features) return [];
    return features.filter(feature => featureIntersectsBounds(feature, bounds));
}

/**
 * Clear the current selection
 */
export function clearSelection() {
    const map = state.getMap();
    const selectionRect = state.getSelectionRect();

    if (selectionRect) {
        map.removeLayer(selectionRect);
        state.setSelectionRect(null);
    }
    state.setSelectionBounds(null);
    state.resetSelectedFeatures();
    updateSelectionStatus('Selection cleared');
    closeAnalysisPanel();
}

/**
 * Close the analysis panel
 */
export function closeAnalysisPanel() {
    document.getElementById('analysisPanel').classList.remove('visible');
}

/**
 * Show the analysis panel with selection results
 */
export function showAnalysis() {
    const panel = document.getElementById('analysisPanel');
    const content = document.getElementById('analysisContent');
    const selectedFeatures = state.getSelectedFeatures();
    const customLayers = state.getCustomLayers();

    let html = '';

    // Calculate totals
    let totalFeatures = selectedFeatures.paths.length + selectedFeatures.lanes.length;
    for (const features of Object.values(selectedFeatures.custom)) {
        totalFeatures += features.length;
    }

    // Summary
    html += `<div class="analysis-summary">
        <span class="total">${totalFeatures}</span>
        <span class="label"> features selected in area</span>
    </div>`;

    html += '<div class="analysis-grid">';

    // Paths analysis
    if (selectedFeatures.paths.length > 0) {
        html += buildAnalysisCard('Community Paths', selectedFeatures.paths, '#4CAF50', {
            lengthField: 'PATH_LENGTH',
            widthField: 'AVERAGE_WIDTH',
            typeField: 'ASSET_SUB_TYPE',
            surfaceField: 'PATH_SURFACE',
            suburbField: 'SUBURB'
        });
    }

    // Lanes analysis
    if (selectedFeatures.lanes.length > 0) {
        html += buildAnalysisCard('Cycle Lanes', selectedFeatures.lanes, '#ff9800', {
            lengthField: 'LENGTH',
            widthField: 'WIDTH',
            typeField: 'ASSET_SUB_TYPE',
            surfaceField: 'SURFACE_TYPE',
            suburbField: 'SUBURB'
        });
    }

    // Custom layers analysis
    for (const [layerId, features] of Object.entries(selectedFeatures.custom)) {
        if (features.length > 0) {
            const info = customLayers[layerId];
            html += buildAnalysisCard(info.name, features, info.color, {
                detectFields: true
            });
        }
    }

    html += '</div>';

    // Actions
    html += `<div class="analysis-actions">
        <button class="primary" onclick="window.appCallbacks.exportSelectedToCSV()">📥 Export to CSV</button>
        <button onclick="window.appCallbacks.zoomToSelection()">🔍 Zoom to Selection</button>
        <button onclick="window.appCallbacks.copyAnalysisToClipboard()">📋 Copy Summary</button>
    </div>`;

    content.innerHTML = html;
    panel.classList.add('visible');
}

/**
 * Build an analysis card for a layer
 * @param {string} title - Card title
 * @param {Array} features - Selected features
 * @param {string} color - Card accent color
 * @param {Object} config - Field configuration
 * @returns {string} HTML content
 */
function buildAnalysisCard(title, features, color, config) {
    let html = `<div class="analysis-card">
        <h4><span class="color-dot" style="background: ${color};"></span>${title}</h4>
        <div class="metric">
            <span>Features:</span>
            <span class="metric-value">${features.length}</span>
        </div>`;

    // Length
    const lengthField = config.lengthField || detectField(features, ['LENGTH', 'PATH_LENGTH', 'Shape__Length']);
    if (lengthField) {
        const totalLength = features.reduce((sum, f) => sum + (f.properties[lengthField] || 0), 0);
        html += `<div class="metric">
            <span>Total Length:</span>
            <span class="metric-value">${(totalLength / 1000).toFixed(2)} km</span>
        </div>`;
    }

    // Width
    const widthField = config.widthField || detectField(features, ['WIDTH', 'AVERAGE_WIDTH']);
    if (widthField) {
        const widths = features.map(f => f.properties[widthField]).filter(w => typeof w === 'number');
        if (widths.length > 0) {
            const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
            html += `<div class="metric">
                <span>Avg Width:</span>
                <span class="metric-value">${avgWidth.toFixed(1)} m</span>
            </div>`;
        }
    }

    // Type breakdown
    const typeField = config.typeField || detectField(features, ['ASSET_SUB_TYPE', 'ASSET_TYPE', 'TYPE', 'type']);
    if (typeField) {
        const typeCounts = {};
        features.forEach(f => {
            const type = f.properties[typeField] || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        html += `<div class="breakdown">
            <div class="breakdown-title">By Type:</div>`;
        for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, CONFIG.MAX_BREAKDOWN_ITEMS)) {
            const pct = ((count / features.length) * 100).toFixed(0);
            html += `<div class="breakdown-item">
                <span>${type}</span>
                <span>${count} (${pct}%)</span>
            </div>`;
        }
        html += '</div>';
    }

    // Surface breakdown
    const surfaceField = config.surfaceField || detectField(features, ['PATH_SURFACE', 'SURFACE_TYPE', 'SURFACE']);
    if (surfaceField && surfaceField !== typeField) {
        const surfaceCounts = {};
        features.forEach(f => {
            const surface = f.properties[surfaceField] || 'Unknown';
            surfaceCounts[surface] = (surfaceCounts[surface] || 0) + 1;
        });

        if (Object.keys(surfaceCounts).length > 1) {
            html += `<div class="breakdown">
                <div class="breakdown-title">By Surface:</div>`;
            for (const [surface, count] of Object.entries(surfaceCounts).sort((a, b) => b[1] - a[1]).slice(0, CONFIG.MAX_SURFACE_BREAKDOWN_ITEMS)) {
                const pct = ((count / features.length) * 100).toFixed(0);
                html += `<div class="breakdown-item">
                    <span>${surface}</span>
                    <span>${count} (${pct}%)</span>
                </div>`;
            }
            html += '</div>';
        }
    }

    // Suburb breakdown
    const suburbField = config.suburbField || detectField(features, ['SUBURB', 'suburb', 'LOCALITY']);
    if (suburbField) {
        const suburbCounts = {};
        features.forEach(f => {
            const suburb = f.properties[suburbField] || 'Unknown';
            suburbCounts[suburb] = (suburbCounts[suburb] || 0) + 1;
        });

        if (Object.keys(suburbCounts).length > 1) {
            html += `<div class="breakdown">
                <div class="breakdown-title">By Suburb:</div>`;
            for (const [suburb, count] of Object.entries(suburbCounts).sort((a, b) => b[1] - a[1]).slice(0, CONFIG.MAX_SUBURB_BREAKDOWN_ITEMS)) {
                const pct = ((count / features.length) * 100).toFixed(0);
                html += `<div class="breakdown-item">
                    <span>${suburb}</span>
                    <span>${count} (${pct}%)</span>
                </div>`;
            }
            html += '</div>';
        }
    }

    html += '</div>';
    return html;
}

/**
 * Zoom to the current selection
 */
export function zoomToSelection() {
    const map = state.getMap();
    const selectionBounds = state.getSelectionBounds();

    if (selectionBounds) {
        map.fitBounds(selectionBounds, { padding: CONFIG.SELECTION_PADDING });
    }
}

/**
 * Export selected features to CSV
 */
export function exportSelectedToCSV() {
    const selectedFeatures = state.getSelectedFeatures();
    const customLayers = state.getCustomLayers();
    let allFeatures = [];

    // Add paths
    selectedFeatures.paths.forEach(f => {
        allFeatures.push({ layer: 'Community Paths', ...f.properties });
    });

    // Add lanes
    selectedFeatures.lanes.forEach(f => {
        allFeatures.push({ layer: 'Cycle Lanes', ...f.properties });
    });

    // Add custom layers
    for (const [layerId, features] of Object.entries(selectedFeatures.custom)) {
        const layerName = customLayers[layerId]?.name || layerId;
        features.forEach(f => {
            allFeatures.push({ layer: layerName, ...f.properties });
        });
    }

    if (allFeatures.length === 0) {
        alert('No features selected to export');
        return;
    }

    // Get all columns
    const columns = new Set(['layer']);
    allFeatures.forEach(f => Object.keys(f).forEach(k => columns.add(k)));
    const columnArray = Array.from(columns);

    // Build CSV
    let csv = columnArray.join(',') + '\n';
    allFeatures.forEach(f => {
        const row = columnArray.map(col => escapeCSVValue(f[col]));
        csv += row.join(',') + '\n';
    });

    downloadFile(csv, 'selected_features.csv', 'text/csv');
}

/**
 * Copy analysis summary to clipboard
 */
export async function copyAnalysisToClipboard() {
    const selectedFeatures = state.getSelectedFeatures();
    const customLayers = state.getCustomLayers();
    let text = 'SELECTION ANALYSIS\n';
    text += '==================\n\n';

    if (selectedFeatures.paths.length > 0) {
        text += `Community Paths: ${selectedFeatures.paths.length} features\n`;
        const totalLength = selectedFeatures.paths.reduce((sum, f) => sum + (f.properties.PATH_LENGTH || 0), 0);
        text += `  Total Length: ${(totalLength / 1000).toFixed(2)} km\n\n`;
    }

    if (selectedFeatures.lanes.length > 0) {
        text += `Cycle Lanes: ${selectedFeatures.lanes.length} features\n`;
        const totalLength = selectedFeatures.lanes.reduce((sum, f) => sum + (f.properties.LENGTH || 0), 0);
        text += `  Total Length: ${(totalLength / 1000).toFixed(2)} km\n\n`;
    }

    for (const [layerId, features] of Object.entries(selectedFeatures.custom)) {
        if (features.length > 0) {
            const name = customLayers[layerId]?.name || layerId;
            text += `${name}: ${features.length} features\n\n`;
        }
    }

    const success = await copyToClipboard(text);
    alert(success ? 'Analysis copied to clipboard!' : 'Failed to copy to clipboard');
}

/**
 * Centralized state management
 * @module state
 */

import { DEFAULT_LAYER_STYLES, COLOR_PALETTE } from './config.js';

// Map instance - will be set during initialization
let map = null;

// Basemap layers
const basemaps = {};
let currentBasemap = 'streets';

// Layer styles storage
const layerStyles = {
    paths: { ...DEFAULT_LAYER_STYLES.paths },
    lanes: { ...DEFAULT_LAYER_STYLES.lanes },
    crossings: { ...DEFAULT_LAYER_STYLES.paths }
};

// Custom layer styles
const customLayerStyles = {};

// Filter-based coloring
const filterColors = {
    paths: { enabled: false, field: null, colors: {} },
    lanes: { enabled: false, field: null, colors: {} },
    crossings: { enabled: false, field: null, colors: {} }
};

// Core layer storage
const coreLayers = {
    paths: { layer: null, data: null, filteredData: null, filters: {} },
    lanes: { layer: null, data: null, filteredData: null, filters: {} },
    crossings: { layer: null, data: null, filteredData: null, filters: {} }
};

// Custom layers storage
const customLayers = {};
let layerIdCounter = 0;

// Selection state
let selectionMode = 'pan';
let selectionRect = null;
let selectionBounds = null;
let selectedFeatures = {
    paths: [],
    lanes: [],
    custom: {}
};
let selectionStartPoint = null;
let isDrawing = false;

// Feedback state
const feedbackState = {
    marker: null,
    latlng: null,
    pathInfo: null,
    rating: null
};

// Feedback layer storage
let feedbackLayer = null;
const feedbackData = { type: 'FeatureCollection', features: [] };

// Feedback filters
const feedbackFilters = {
    rating: [],
    category: []
};

// State getters
export function getMap() {
    return map;
}

export function getBasemaps() {
    return basemaps;
}

export function getCurrentBasemap() {
    return currentBasemap;
}

export function getLayerStyles() {
    return layerStyles;
}

export function getCustomLayerStyles() {
    return customLayerStyles;
}

export function getFilterColors() {
    return filterColors;
}

export function getCoreLayers() {
    return coreLayers;
}

export function getCustomLayers() {
    return customLayers;
}

export function getSelectionMode() {
    return selectionMode;
}

export function getSelectionRect() {
    return selectionRect;
}

export function getSelectionBounds() {
    return selectionBounds;
}

export function getSelectedFeatures() {
    return selectedFeatures;
}

export function getSelectionStartPoint() {
    return selectionStartPoint;
}

export function getIsDrawing() {
    return isDrawing;
}

export function getFeedbackState() {
    return feedbackState;
}

export function getFeedbackLayer() {
    return feedbackLayer;
}

export function getFeedbackData() {
    return feedbackData;
}

export function getFeedbackFilters() {
    return feedbackFilters;
}

// State setters
export function setMap(mapInstance) {
    map = mapInstance;
}

export function setBasemap(name, layer) {
    basemaps[name] = layer;
}

export function setCurrentBasemap(name) {
    currentBasemap = name;
}

export function setSelectionMode(mode) {
    selectionMode = mode;
}

export function setSelectionRect(rect) {
    selectionRect = rect;
}

export function setSelectionBounds(bounds) {
    selectionBounds = bounds;
}

export function setSelectedFeatures(features) {
    selectedFeatures = features;
}

export function setSelectionStartPoint(point) {
    selectionStartPoint = point;
}

export function setIsDrawing(drawing) {
    isDrawing = drawing;
}

export function setFeedbackLayer(layer) {
    feedbackLayer = layer;
}

// Generate new layer ID
export function generateLayerId() {
    return 'custom_' + (++layerIdCounter);
}

// Reset selected features
export function resetSelectedFeatures() {
    selectedFeatures = { paths: [], lanes: [], custom: {} };
}

// Reset feedback filters
export function resetFeedbackFilters() {
    feedbackFilters.rating = [];
    feedbackFilters.category = [];
}

// Initialize filter colors for a layer field
export function initFilterColors(layerId, field, values) {
    if (!filterColors[layerId]) {
        filterColors[layerId] = { enabled: false, field: null, colors: {} };
    }
    if (!filterColors[layerId].colors[field]) {
        filterColors[layerId].colors[field] = {};
        values.forEach((val, idx) => {
            filterColors[layerId].colors[field][val] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
        });
    }
}

// Get custom layer style or create default
export function getOrCreateCustomLayerStyle(layerId, color, geometryType) {
    if (!customLayerStyles[layerId]) {
        customLayerStyles[layerId] = {
            color: color,
            weight: geometryType === 'point' ? 2 : 3,
            opacity: 0.8,
            fillOpacity: 0.8,
            radius: 6,
            dashArray: '',
            lineCap: 'round',
            lineJoin: 'round'
        };
    }
    return customLayerStyles[layerId];
}

// Reset layer styles to defaults
export function resetLayerStyles() {
    Object.assign(layerStyles.paths, DEFAULT_LAYER_STYLES.paths);
    Object.assign(layerStyles.lanes, DEFAULT_LAYER_STYLES.lanes);
}

// Reset custom layer styles
export function resetCustomLayerStyle(layerId, info) {
    customLayerStyles[layerId] = {
        color: info.color,
        weight: info.geometryType === 'point' ? 2 : 3,
        opacity: 0.8,
        fillOpacity: 0.8,
        radius: 6,
        dashArray: '',
        lineCap: 'round',
        lineJoin: 'round'
    };
}

// Apply preset to layer styles
export function applyStylePresetToState(preset) {
    Object.assign(layerStyles.paths, preset.paths);
    Object.assign(layerStyles.lanes, preset.lanes);
    for (const layerId of Object.keys(customLayerStyles)) {
        Object.assign(customLayerStyles[layerId], preset.custom);
    }
}

// API configuration
let apiUrl = '/api';

/**
 * Get the API URL
 * @returns {string} API base URL
 */
export function getApiUrl() {
    return apiUrl;
}

/**
 * Set the API URL
 * @param {string} url - API base URL
 */
export function setApiUrl(url) {
    apiUrl = url;
}

/**
 * Main Application Entry Point
 * Initializes and connects all modules
 * @module app
 */

// Import all modules
import { initMap, setBasemap, fitMapToAllLayers, togglePanel, toggleFilterPanel, toggleStylePanel, zoomToLayer } from './map-core.js';
import * as state from './state.js';
import { applyPreset } from './utils.js';
import {
    loadCoreDataset,
    addCustomLayer,
    toggleCoreLayer,
    toggleCustomLayer,
    removeCustomLayer,
    updateStats,
    setLayerCallbacks,
    applyPathsFilters,
    applyLanesFilters,
    applyCustomLayerFilters
} from './layers.js';
import {
    applyFilters,
    updateFilterPanel,
    setFilterCallbacks,
    setColorByField,
    setFilterValueColor,
    updateCategoricalFilter,
    updateNumericFilter,
    selectAllValues,
    selectNoneValues,
    clearFilters,
    toggleFeedbackFilterValue,
    selectAllFeedbackFilter,
    selectNoneFeedbackFilter,
    clearFeedbackFilters
} from './filters.js';
import {
    closeFeedbackPanel,
    resetFeedbackForm,
    setFeedbackRating,
    downloadFeedback,
    loadFeedbackFiles,
    updateFeedbackLayer,
    toggleFeedbackLayer,
    attachFeedbackClickHandler,
    setupFeedbackMapClickHandler,
    initFeedbackValidation,
    setFeedbackCallbacks,
    submitFeedback,
    handleImageSelect,
    loadFeedbackFromServer
} from './feedback.js';
import {
    setMode,
    updateSelectionStatus,
    setupSelectionEvents,
    clearSelection,
    closeAnalysisPanel,
    zoomToSelection,
    exportSelectedToCSV,
    copyAnalysisToClipboard
} from './analysis.js';
import {
    updateStylePanel,
    updateLayerStyle,
    applyAllStyles,
    resetAllStyles,
    applyStylePreset,
    getLayerStyle,
    setStyleCallbacks
} from './styles.js';
import {
    centerOnLocation,
    isGeolocationSupported,
    useGPSForFeedback,
    initGPSUI
} from './gps-location.js';
import {
    initTileDB,
    cacheAreaTiles,
    clearTileCache,
    getCacheStats,
    createCachedTileLayer
} from './offline-tiles.js';
import {
    handleUpvote,
    handleDownvote,
    toggleHeatmap,
    createHeatmap,
    setDateFilter,
    applyDatePreset,
    getDatePresets
} from './community.js';

/**
 * Apply layer filters and update UI
 * @param {string} layerId - Layer ID
 */
function applyLayerFilters(layerId) {
    if (layerId === 'paths') {
        applyPathsFilters();
    } else if (layerId === 'lanes') {
        applyLanesFilters();
    } else {
        applyCustomLayerFilters(layerId);
    }
    updateFilterPanel();
    updateStats();
}

/**
 * Toggle mobile menu
 */
function toggleMobileMenu() {
    const panel = document.getElementById('controlPanel');
    panel.classList.toggle('visible');
}

/**
 * Toggle community panel
 */
function toggleCommunityPanel() {
    const panel = document.getElementById('communityPanel');
    const btn = document.getElementById('communityToggleBtn');
    panel.classList.toggle('visible');
    if (panel.classList.contains('visible')) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'block';
    }
}

/**
 * Use GPS location for feedback
 */
async function useGPSLocation() {
    const location = await useGPSForFeedback();
    if (location) {
        // Update feedback form with GPS location
        const feedbackState = state.getFeedbackState();
        feedbackState.latlng = L.latLng(location.lat, location.lng);

        // Update marker on map
        const map = state.getMap();
        if (feedbackState.marker) {
            map.removeLayer(feedbackState.marker);
        }

        feedbackState.marker = L.circleMarker([location.lat, location.lng], {
            radius: 10,
            fillColor: '#4285F4',
            color: '#fff',
            weight: 3,
            fillOpacity: 1
        }).addTo(map);

        // Update UI
        document.getElementById('feedbackLocation').style.display = 'block';
        document.getElementById('feedbackLocationText').textContent =
            `GPS Location (±${Math.round(location.accuracy)}m)`;
        document.getElementById('feedbackForm').style.display = 'block';

        // Center map on location
        map.setView([location.lat, location.lng], 17);
    }
}

/**
 * Cache tiles for current map area
 */
async function cacheCurrentArea() {
    const map = state.getMap();
    if (!map) return;

    const bounds = map.getBounds();
    const currentZoom = map.getZoom();
    const minZoom = Math.max(10, currentZoom - 2);
    const maxZoom = Math.min(17, currentZoom + 2);

    // Show loading
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    overlay.classList.add('visible');
    loadingText.textContent = 'Caching tiles...';

    try {
        const result = await cacheAreaTiles(bounds, minZoom, maxZoom, 'streets', (progress) => {
            loadingText.textContent = `Caching tiles... ${progress.percent}%`;
        });

        // Update cache stats display
        const stats = getCacheStats();
        document.getElementById('cachedTileCount').textContent = stats.tileCount;

        alert(`Cached ${result.completed - result.failed} tiles successfully!`);
    } catch (error) {
        alert('Error caching tiles: ' + error.message);
    } finally {
        overlay.classList.remove('visible');
    }
}

/**
 * Clear tile cache
 */
async function clearTileCacheHandler() {
    if (confirm('Clear all cached map tiles? You will need to re-download them for offline use.')) {
        await clearTileCache();
        document.getElementById('cachedTileCount').textContent = '0';
        alert('Tile cache cleared');
    }
}

/**
 * Update date filter from UI
 */
function updateDateFilter() {
    const fromDate = document.getElementById('dateFrom').value;
    const toDate = document.getElementById('dateTo').value;
    setDateFilter(fromDate || null, toDate || null);
    updateFeedbackLayer();

    // Update date preset buttons
    document.querySelectorAll('.date-preset').forEach(btn => {
        btn.classList.remove('active');
    });
}

/**
 * Apply date preset and update UI
 * @param {string} presetLabel
 */
function applyDatePresetHandler(presetLabel) {
    applyDatePreset(presetLabel);
    updateFeedbackLayer();

    // Update UI
    document.querySelectorAll('.date-preset').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(presetLabel.split(' ')[0]));
    });

    // Clear custom date inputs
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
}

/**
 * Toggle heatmap and update checkbox
 */
function toggleHeatmapHandler() {
    const isVisible = toggleHeatmap();
    document.getElementById('heatmapToggle').checked = isVisible;
}

/**
 * Initialize the application
 */
async function init() {
    // Initialize the map
    const map = initMap();

    // Initialize tile database
    try {
        await initTileDB();
        const stats = getCacheStats();
        document.getElementById('cachedTileCount').textContent = stats.tileCount;
    } catch (error) {
        console.warn('Could not initialize tile cache:', error);
    }

    // Set up cross-module callbacks for layers
    setLayerCallbacks({
        updateStats: updateStats,
        updateFilterPanel: updateFilterPanel,
        attachFeedbackClickHandler: attachFeedbackClickHandler,
        getLayerStyle: getLayerStyle,
        applyFilters: applyFilters
    });

    // Set up cross-module callbacks for filters
    setFilterCallbacks({
        applyLayerFilters: applyLayerFilters,
        updateFeedbackLayer: updateFeedbackLayer
    });

    // Set up cross-module callbacks for feedback
    setFeedbackCallbacks({
        setMode: setMode,
        updateSelectionStatus: updateSelectionStatus
    });

    // Set up cross-module callbacks for styles
    setStyleCallbacks({
        applyPathsFilters: applyPathsFilters,
        applyLanesFilters: applyLanesFilters,
        applyCustomLayerFilters: applyCustomLayerFilters
    });

    // Set up selection events
    setupSelectionEvents(map);

    // Set up feedback map click handler
    setupFeedbackMapClickHandler(map);

    // Initialize feedback form validation
    initFeedbackValidation();

    // Initialize GPS UI
    if (isGeolocationSupported()) {
        initGPSUI();
    }

    // Expose callbacks to global scope for inline event handlers
    window.appCallbacks = {
        // Map
        setBasemap,
        togglePanel,
        toggleFilterPanel,
        toggleStylePanel: () => toggleStylePanel(updateStylePanel),
        zoomToLayer,
        fitMapToAllLayers,

        // Mobile
        toggleMobileMenu,
        toggleCommunityPanel,

        // Layers
        loadCoreDataset,
        addCustomLayer,
        toggleCoreLayer,
        toggleCustomLayer,
        removeCustomLayer,
        applyPreset,

        // Filters
        setColorByField,
        setFilterValueColor,
        updateCategoricalFilter,
        updateNumericFilter,
        selectAllValues,
        selectNoneValues,
        clearFilters,
        toggleFeedbackFilterValue,
        selectAllFeedbackFilter,
        selectNoneFeedbackFilter,
        clearFeedbackFilters,

        // Feedback
        closeFeedbackPanel,
        resetFeedbackForm,
        setFeedbackRating,
        downloadFeedback,
        loadFeedbackFiles,
        toggleFeedbackLayer,
        submitFeedback,
        handleImageSelect,
        loadFeedbackFromServer,

        // GPS
        centerOnLocation,
        useGPSLocation,

        // Offline tiles
        cacheCurrentArea,
        clearTileCache: clearTileCacheHandler,

        // Community features
        handleUpvote,
        handleDownvote,
        toggleHeatmap: toggleHeatmapHandler,
        applyDatePreset: applyDatePresetHandler,
        updateDateFilter,

        // Analysis/Selection
        setMode,
        clearSelection,
        closeAnalysisPanel,
        zoomToSelection,
        exportSelectedToCSV,
        copyAnalysisToClipboard,

        // Styles
        updateLayerStyle,
        applyAllStyles,
        resetAllStyles,
        applyStylePreset
    };

    console.log('Canberra Cycling Infrastructure Map initialized with all features');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

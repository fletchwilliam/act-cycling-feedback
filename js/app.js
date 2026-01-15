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
    loadCoreDatasetFromUrl,
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
    handleImageSelect
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
 * Dataset URL mappings for quick load
 */
const DATASET_URLS = {
    'community-path': {
        url: 'ACTGOV_Community_Path_Assets_-1135529264064258073.geojson',
        type: 'paths',
        name: 'Community Path'
    },
    'pedestrian-crossings': {
        url: 'ACTGOV_Pedestrian_Crossing_Assets_-7254283901818788884.geojson',
        type: 'crossings',
        name: 'Pedestrian Crossings'
    },
    'onroad-cycle-lane': {
        url: 'ACTGOV_On_Road_Cycle_Lane_Assets_8201704897412695020.geojson',
        type: 'lanes',
        name: 'Onroad Cycle Lane'
    }
};

/**
 * Quick load a dataset from included GeoJSON files
 * @param {string} datasetId - Dataset identifier
 */
async function quickLoadDataset(datasetId) {
    const dataset = DATASET_URLS[datasetId];
    if (!dataset) {
        alert('Unknown dataset: ' + datasetId);
        return;
    }

    // Find and update button state
    const buttons = document.querySelectorAll('.quick-load-btn');
    let targetButton = null;
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(dataset.name.toLowerCase().split(' ')[0])) {
            targetButton = btn;
        }
    });

    if (targetButton) {
        targetButton.disabled = true;
        targetButton.textContent = 'Loading...';
    }

    const success = await loadCoreDatasetFromUrl(dataset.url, dataset.type, dataset.name);

    if (targetButton) {
        targetButton.disabled = false;
        if (success) {
            targetButton.textContent = '✓ ' + dataset.name;
            targetButton.classList.add('loaded');
        } else {
            targetButton.textContent = dataset.name;
        }
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

        // Layers
        loadCoreDataset,
        quickLoadDataset,
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
        handleImageSelect,

        // GPS
        centerOnLocation,
        useGPSLocation,

        // Offline tiles
        cacheCurrentArea,
        clearTileCache: clearTileCacheHandler,

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

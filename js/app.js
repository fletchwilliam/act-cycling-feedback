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
    setFeedbackCallbacks
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
 * Initialize the application
 */
function init() {
    // Initialize the map
    const map = initMap();

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

    // Expose callbacks to global scope for inline event handlers
    window.appCallbacks = {
        // Map
        setBasemap,
        togglePanel,
        toggleFilterPanel,
        toggleStylePanel: () => toggleStylePanel(updateStylePanel),
        zoomToLayer,
        fitMapToAllLayers,

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

    console.log('Canberra Cycling Infrastructure Map initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

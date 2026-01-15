/**
 * Configuration object - Centralizes all magic numbers and settings
 * @module config
 */

/**
 * @typedef {Object} LayerStyle
 * @property {number} weight - Line weight in pixels
 * @property {number} opacity - Line opacity (0-1)
 * @property {string} dashArray - SVG dash array pattern
 * @property {string} lineCap - Line cap style ('round', 'square', 'butt')
 * @property {string} lineJoin - Line join style ('round', 'miter', 'bevel')
 * @property {boolean} [useTypeColors] - Whether to use type-based colors
 * @property {string} [singleColor] - Single color when not using type colors
 * @property {number} [radius] - Point marker radius
 * @property {number} [fillOpacity] - Fill opacity for points/polygons
 * @property {string} [color] - Override color
 */

/**
 * @typedef {Object} StylePreset
 * @property {LayerStyle} paths - Path layer styles
 * @property {LayerStyle} lanes - Lane layer styles
 * @property {LayerStyle} custom - Custom layer styles
 */

/**
 * @typedef {Object} BasemapConfig
 * @property {string} url - Tile server URL template
 * @property {string} attribution - Attribution HTML
 */

/**
 * @typedef {Object} LayerPreset
 * @property {string} name - Default layer name
 * @property {string} color - Default color hex
 * @property {string} type - Geometry type ('point', 'line', 'polygon', 'auto')
 */

/**
 * Application configuration constants
 * @type {Object}
 */
export const CONFIG = {
    // Map settings
    DEFAULT_MAP_CENTER: [-35.2809, 149.1300],
    DEFAULT_ZOOM: 12,

    // Feedback settings
    CLICK_TOLERANCE_METERS: 50,

    // Filter settings
    MAX_FILTER_VALUES: 50,

    // UI settings
    MAP_PADDING: [20, 20],
    SELECTION_PADDING: [50, 50],

    // Marker settings
    FEEDBACK_MARKER_RADIUS: 10,
    DEFAULT_POINT_RADIUS: 6,

    // Analysis settings
    MAX_BREAKDOWN_ITEMS: 5,
    MAX_SURFACE_BREAKDOWN_ITEMS: 4,
    MAX_SUBURB_BREAKDOWN_ITEMS: 4,

    // Style defaults
    DEFAULT_LINE_WEIGHT: 3,
    DEFAULT_LANE_WEIGHT: 5,
    DEFAULT_OPACITY: 0.8,
    DEFAULT_LANE_OPACITY: 0.9,

    // Selection rectangle style
    SELECTION_RECT_COLOR: '#2196F3',
    SELECTION_RECT_WEIGHT: 2,
    SELECTION_RECT_FILL_OPACITY: 0.1,
    SELECTION_RECT_DASH_ARRAY: '5, 5'
};

// Color palette for auto-assignment
export const COLOR_PALETTE = [
    '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
    '#ffff33', '#a65628', '#f781bf', '#999999', '#66c2a5',
    '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f'
];

// Color schemes for core layers
export const PATH_COLORS = {
    'CYCLEPATH': '#e41a1c',
    'SEPARATED CYCLEPATH': '#377eb8',
    'FOOTPATH': '#4daf4a',
    'SHARED PATH': '#984ea3',
    'DEFAULT': '#999999'
};

export const LANE_COLORS = {
    'GREEN PAVEMENT PAINT': '#ff7f00',
    'STANDARD PAVEMENT SURFACE': '#a65628',
    'DEFAULT': '#f781bf'
};

// Presets for common layer types
export const LAYER_PRESETS = {
    crossings: { name: 'Pedestrian Crossings', color: '#e91e63', type: 'point' },
    bikeracks: { name: 'Bike Racks', color: '#9c27b0', type: 'point' },
    traffic: { name: 'Traffic Lights', color: '#f44336', type: 'point' },
    custom: { name: '', color: '#2196F3', type: 'auto' }
};

// Fields to use for filtering (prioritized list)
export const FILTERABLE_FIELDS = [
    'ASSET_TYPE', 'ASSET_SUB_TYPE', 'PATH_SURFACE', 'SURFACE_TYPE',
    'SUBURB', 'TRAVEL_DIRECTION', 'TRAVEL_RESTRICTION', 'OWNERSHIP',
    'MAINTAINED_BY', 'ROAD_LOCATION_TYPE', 'ADAJCENT_KERB'
];

// Numeric fields for range filtering
export const NUMERIC_FIELDS = ['AVERAGE_WIDTH', 'PATH_LENGTH', 'LENGTH', 'WIDTH'];

// Feedback category labels
export const FEEDBACK_CATEGORIES = {
    'surface': 'Surface Quality',
    'safety': 'Safety Concern',
    'lighting': 'Lighting',
    'other': 'Other'
};

// Style presets
export const STYLE_PRESETS = {
    default: {
        paths: { weight: 3, opacity: 0.8, dashArray: '', useTypeColors: true },
        lanes: { weight: 5, opacity: 0.9, dashArray: '', useTypeColors: true },
        custom: { weight: 3, opacity: 0.8, radius: 6, fillOpacity: 0.8 }
    },
    highContrast: {
        paths: { weight: 4, opacity: 1, dashArray: '', useTypeColors: true },
        lanes: { weight: 6, opacity: 1, dashArray: '', useTypeColors: true },
        custom: { weight: 3, opacity: 1, radius: 8, fillOpacity: 1 }
    },
    subtle: {
        paths: { weight: 2, opacity: 0.5, dashArray: '', useTypeColors: true },
        lanes: { weight: 3, opacity: 0.5, dashArray: '', useTypeColors: true },
        custom: { weight: 1, opacity: 0.5, radius: 4, fillOpacity: 0.5 }
    },
    thick: {
        paths: { weight: 6, opacity: 0.8, dashArray: '', useTypeColors: true },
        lanes: { weight: 8, opacity: 0.9, dashArray: '', useTypeColors: true },
        custom: { weight: 4, opacity: 0.8, radius: 10, fillOpacity: 0.8 }
    },
    thin: {
        paths: { weight: 1, opacity: 0.8, dashArray: '', useTypeColors: true },
        lanes: { weight: 2, opacity: 0.9, dashArray: '', useTypeColors: true },
        custom: { weight: 1, opacity: 0.8, radius: 4, fillOpacity: 0.8 }
    },
    neon: {
        paths: { weight: 4, opacity: 1, dashArray: '', useTypeColors: false, singleColor: '#00ff88' },
        lanes: { weight: 5, opacity: 1, dashArray: '', useTypeColors: false, singleColor: '#ff00ff' },
        custom: { weight: 2, opacity: 1, radius: 8, fillOpacity: 1, color: '#00ffff' }
    }
};

// Default layer styles
export const DEFAULT_LAYER_STYLES = {
    paths: {
        weight: 3,
        opacity: 0.8,
        dashArray: '',
        lineCap: 'round',
        lineJoin: 'round',
        useTypeColors: true,
        singleColor: '#e41a1c'
    },
    lanes: {
        weight: 5,
        opacity: 0.9,
        dashArray: '',
        lineCap: 'round',
        lineJoin: 'round',
        useTypeColors: true,
        singleColor: '#ff7f00'
    }
};

// Basemap configurations
export const BASEMAP_CONFIGS = {
    streets: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    light: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    },
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri'
    },
    topo: {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    }
};

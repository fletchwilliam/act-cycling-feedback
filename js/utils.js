/**
 * Shared utility functions
 * @module utils
 */

import { PATH_COLORS, LANE_COLORS, LAYER_PRESETS, FILTERABLE_FIELDS, NUMERIC_FIELDS, CONFIG } from './config.js';

/**
 * Get color for a path based on its asset subtype
 * @param {string} subType - The asset subtype
 * @returns {string} The color hex code
 */
export function getPathColor(subType) {
    return PATH_COLORS[subType] || PATH_COLORS['DEFAULT'];
}

/**
 * Get color for a lane based on its asset subtype
 * @param {string} subType - The asset subtype
 * @returns {string} The color hex code
 */
export function getLaneColor(subType) {
    return LANE_COLORS[subType] || LANE_COLORS['DEFAULT'];
}

/**
 * Format popup content for a feature
 * @param {Object} properties - Feature properties
 * @param {string} layerName - Name of the layer
 * @returns {string} HTML content for the popup
 */
export function formatPopupContent(properties, layerName) {
    let html = '<div class="popup-content">';

    const titleFields = ['ASSET_NAME', 'NAME', 'name', 'DESCRIPTION', 'description', 'ID', 'id', 'OBJECTID'];
    let title = layerName;
    for (const field of titleFields) {
        if (properties[field]) {
            title = properties[field];
            break;
        }
    }

    html += `<strong>${title}</strong>`;

    const skipFields = ['Shape__Length', 'Shape__Area', 'GlobalID', 'OBJECTID'];
    for (const [key, value] of Object.entries(properties)) {
        if (value !== null && value !== '' && !skipFields.includes(key)) {
            let displayValue = value;
            if (typeof value === 'number') {
                displayValue = Number.isInteger(value) ? value : value.toFixed(2);
            }
            html += `<div class="property"><span class="property-label">${key}:</span> ${displayValue}</div>`;
        }
    }

    html += '</div>';
    return html;
}

/**
 * Detect geometry type from GeoJSON
 * @param {Object} geojson - GeoJSON object
 * @returns {string} Geometry type: 'point', 'line', or 'polygon'
 */
export function detectGeometryType(geojson) {
    if (!geojson.features || geojson.features.length === 0) return 'point';

    const firstGeom = geojson.features[0].geometry;
    if (!firstGeom) return 'point';

    switch (firstGeom.type) {
        case 'Point':
        case 'MultiPoint':
            return 'point';
        case 'LineString':
        case 'MultiLineString':
            return 'line';
        case 'Polygon':
        case 'MultiPolygon':
            return 'polygon';
        default:
            return 'point';
    }
}

/**
 * Get unique values for a field from features
 * @param {Array} features - Array of GeoJSON features
 * @param {string} field - Field name
 * @returns {Array} Sorted array of unique values
 */
export function getUniqueValues(features, field) {
    const values = new Set();
    features.forEach(f => {
        if (f.properties[field] !== null && f.properties[field] !== undefined && f.properties[field] !== '') {
            values.add(f.properties[field]);
        }
    });
    return Array.from(values).sort();
}

/**
 * Get numeric range for a field from features
 * @param {Array} features - Array of GeoJSON features
 * @param {string} field - Field name
 * @returns {Object} Object with min and max values
 */
export function getNumericRange(features, field) {
    let min = Infinity, max = -Infinity;
    features.forEach(f => {
        const val = f.properties[field];
        if (typeof val === 'number' && !isNaN(val)) {
            min = Math.min(min, val);
            max = Math.max(max, val);
        }
    });
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
}

/**
 * Get available filter fields for a dataset
 * @param {Array} features - Array of GeoJSON features
 * @returns {Object} Object with categorical and numeric field info
 */
export function getAvailableFilterFields(features) {
    if (!features || features.length === 0) return { categorical: [], numeric: [] };

    const sampleProps = features[0].properties;
    const categorical = [];
    const numeric = [];

    for (const field of Object.keys(sampleProps)) {
        if (FILTERABLE_FIELDS.includes(field)) {
            const uniqueVals = getUniqueValues(features, field);
            if (uniqueVals.length > 0 && uniqueVals.length <= CONFIG.MAX_FILTER_VALUES) {
                categorical.push({ field, values: uniqueVals });
            }
        }
        if (NUMERIC_FIELDS.includes(field)) {
            const range = getNumericRange(features, field);
            if (range.max > range.min) {
                numeric.push({ field, ...range });
            }
        }
    }

    return { categorical, numeric };
}

/**
 * Detect a field from a list of candidates
 * @param {Array} features - Array of GeoJSON features
 * @param {Array} candidates - List of candidate field names
 * @returns {string|null} First matching field name or null
 */
export function detectField(features, candidates) {
    if (!features || features.length === 0) return null;
    const props = features[0].properties;
    for (const field of candidates) {
        if (props.hasOwnProperty(field)) return field;
    }
    return null;
}

/**
 * Format field name for display
 * @param {string} field - Field name
 * @returns {string} Formatted field name
 */
export function formatFieldName(field) {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Apply a layer preset to form fields
 * @param {string} presetName - Name of the preset
 */
export function applyPreset(presetName) {
    const preset = LAYER_PRESETS[presetName];
    document.getElementById('layerName').value = preset.name;
    document.getElementById('layerColor').value = preset.color;
    document.getElementById('layerType').value = preset.type;
}

/**
 * Check if a feature intersects with bounds
 * @param {Object} feature - GeoJSON feature
 * @param {L.LatLngBounds} bounds - Leaflet bounds
 * @returns {boolean} True if feature intersects bounds
 */
export function featureIntersectsBounds(feature, bounds) {
    const geom = feature.geometry;
    if (!geom) return false;

    switch (geom.type) {
        case 'Point':
            return bounds.contains(L.latLng(geom.coordinates[1], geom.coordinates[0]));

        case 'MultiPoint':
            return geom.coordinates.some(coord =>
                bounds.contains(L.latLng(coord[1], coord[0]))
            );

        case 'LineString':
            return geom.coordinates.some(coord =>
                bounds.contains(L.latLng(coord[1], coord[0]))
            );

        case 'MultiLineString':
            return geom.coordinates.some(line =>
                line.some(coord => bounds.contains(L.latLng(coord[1], coord[0])))
            );

        case 'Polygon':
            return geom.coordinates[0].some(coord =>
                bounds.contains(L.latLng(coord[1], coord[0]))
            );

        case 'MultiPolygon':
            return geom.coordinates.some(poly =>
                poly[0].some(coord => bounds.contains(L.latLng(coord[1], coord[0])))
            );

        default:
            return false;
    }
}

/**
 * Find the nearest point on a line segment to a given point
 * @param {L.LatLng} point - The reference point
 * @param {L.LatLng} segStart - Start of segment
 * @param {L.LatLng} segEnd - End of segment
 * @returns {Object} Object with point and t parameter
 */
export function nearestPointOnSegment(point, segStart, segEnd) {
    const dx = segEnd.lng - segStart.lng;
    const dy = segEnd.lat - segStart.lat;

    if (dx === 0 && dy === 0) {
        return { point: segStart, t: 0 };
    }

    const t = Math.max(0, Math.min(1,
        ((point.lng - segStart.lng) * dx + (point.lat - segStart.lat) * dy) /
        (dx * dx + dy * dy)
    ));

    const nearestLat = segStart.lat + t * dy;
    const nearestLng = segStart.lng + t * dx;

    return { point: L.latLng(nearestLat, nearestLng), t: t };
}

/**
 * Find the nearest point on a feature to a click point
 * @param {L.LatLng} clickPoint - The click location
 * @param {Object} feature - GeoJSON feature
 * @returns {Object|null} Object with distance and point, or null
 */
export function findNearestPointOnFeature(clickPoint, feature) {
    const geom = feature.geometry;
    if (!geom) return null;

    let coords = [];
    if (geom.type === 'LineString') {
        coords = geom.coordinates.map(c => L.latLng(c[1], c[0]));
    } else if (geom.type === 'MultiLineString') {
        coords = geom.coordinates.flat().map(c => L.latLng(c[1], c[0]));
    } else {
        return null;
    }

    if (coords.length < 2) return null;

    let minDist = Infinity;
    let nearestPoint = coords[0];

    // Check distance to each vertex
    for (const coord of coords) {
        const dist = clickPoint.distanceTo(coord);
        if (dist < minDist) {
            minDist = dist;
            nearestPoint = coord;
        }
    }

    // Check distance to line segments
    for (let i = 0; i < coords.length - 1; i++) {
        const segResult = nearestPointOnSegment(clickPoint, coords[i], coords[i + 1]);
        const dist = clickPoint.distanceTo(segResult.point);
        if (dist < minDist) {
            minDist = dist;
            nearestPoint = segResult.point;
        }
    }

    return { distance: minDist, point: nearestPoint };
}

/**
 * Download data as a file
 * @param {string} content - File content
 * @param {string} filename - Name for the downloaded file
 * @param {string} mimeType - MIME type of the file
 */
export function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Escape a string value for CSV
 * @param {*} val - Value to escape
 * @returns {string} Escaped string
 */
export function escapeCSVValue(val) {
    const strVal = String(val ?? '').replace(/"/g, '""');
    return strVal.includes(',') ? `"${strVal}"` : strVal;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Promise resolving to success status
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Community features - upvote/downvote, heatmap, time filtering
 * @module community
 */

import * as state from './state.js';
import { CONFIG } from './config.js';

// Community state
let voteData = {}; // feedbackId -> { upvotes: 0, downvotes: 0, userVote: null }
let heatmapLayer = null;
let isHeatmapVisible = false;
let dateFilter = { from: null, to: null };

// Load Leaflet.heat plugin dynamically
let heatPluginLoaded = false;

/**
 * Load the Leaflet.heat plugin
 * @returns {Promise<void>}
 */
export async function loadHeatPlugin() {
    if (heatPluginLoaded || (typeof L !== 'undefined' && L.heatLayer)) {
        heatPluginLoaded = true;
        return;
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
        script.onload = () => {
            heatPluginLoaded = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load heatmap plugin'));
        document.head.appendChild(script);
    });
}

/**
 * Generate a unique ID for a feedback feature
 * @param {Object} feature - GeoJSON feature
 * @returns {string} Unique ID
 */
function getFeedbackId(feature) {
    const props = feature.properties;
    // Use existing ID or generate from coordinates + timestamp
    return props.id || props.feedbackId ||
        `fb_${feature.geometry.coordinates[0]}_${feature.geometry.coordinates[1]}_${props.timestamp || Date.now()}`;
}

/**
 * Initialize vote data for feedback features
 * @param {Array} features - Feedback features
 */
export function initVoteData(features) {
    features.forEach(feature => {
        const id = getFeedbackId(feature);
        if (!voteData[id]) {
            voteData[id] = {
                upvotes: feature.properties.upvotes || 0,
                downvotes: feature.properties.downvotes || 0,
                userVote: getUserVote(id)
            };
        }
    });
}

/**
 * Get user's vote from local storage
 * @param {string} feedbackId
 * @returns {string|null} 'up', 'down', or null
 */
function getUserVote(feedbackId) {
    try {
        const votes = JSON.parse(localStorage.getItem('feedbackVotes') || '{}');
        return votes[feedbackId] || null;
    } catch {
        return null;
    }
}

/**
 * Save user's vote to local storage
 * @param {string} feedbackId
 * @param {string|null} vote - 'up', 'down', or null
 */
function saveUserVote(feedbackId, vote) {
    try {
        const votes = JSON.parse(localStorage.getItem('feedbackVotes') || '{}');
        if (vote) {
            votes[feedbackId] = vote;
        } else {
            delete votes[feedbackId];
        }
        localStorage.setItem('feedbackVotes', JSON.stringify(votes));
    } catch {
        console.warn('Could not save vote to localStorage');
    }
}

/**
 * Upvote feedback
 * @param {string} feedbackId
 * @param {Function} onUpdate - Callback after update
 */
export async function upvote(feedbackId, onUpdate) {
    if (!voteData[feedbackId]) {
        voteData[feedbackId] = { upvotes: 0, downvotes: 0, userVote: null };
    }

    const data = voteData[feedbackId];
    const previousVote = data.userVote;

    if (previousVote === 'up') {
        // Remove upvote
        data.upvotes--;
        data.userVote = null;
    } else {
        // Add upvote
        if (previousVote === 'down') {
            data.downvotes--;
        }
        data.upvotes++;
        data.userVote = 'up';
    }

    saveUserVote(feedbackId, data.userVote);

    // Send to server if available
    await sendVoteToServer(feedbackId, data.userVote);

    if (onUpdate) onUpdate(data);
    return data;
}

/**
 * Downvote feedback
 * @param {string} feedbackId
 * @param {Function} onUpdate - Callback after update
 */
export async function downvote(feedbackId, onUpdate) {
    if (!voteData[feedbackId]) {
        voteData[feedbackId] = { upvotes: 0, downvotes: 0, userVote: null };
    }

    const data = voteData[feedbackId];
    const previousVote = data.userVote;

    if (previousVote === 'down') {
        // Remove downvote
        data.downvotes--;
        data.userVote = null;
    } else {
        // Add downvote
        if (previousVote === 'up') {
            data.upvotes--;
        }
        data.downvotes++;
        data.userVote = 'down';
    }

    saveUserVote(feedbackId, data.userVote);

    // Send to server if available
    await sendVoteToServer(feedbackId, data.userVote);

    if (onUpdate) onUpdate(data);
    return data;
}

/**
 * Send vote to server
 * @param {string} feedbackId
 * @param {string|null} vote
 */
async function sendVoteToServer(feedbackId, vote) {
    try {
        const apiUrl = state.getApiUrl ? state.getApiUrl() : '/api';
        const response = await fetch(`${apiUrl}/feedback/${feedbackId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vote })
        });
        return response.ok;
    } catch {
        // Server not available, vote saved locally
        return false;
    }
}

/**
 * Get vote data for a feedback
 * @param {string} feedbackId
 * @returns {Object} Vote data
 */
export function getVoteData(feedbackId) {
    return voteData[feedbackId] || { upvotes: 0, downvotes: 0, userVote: null };
}

/**
 * Calculate vote score
 * @param {string} feedbackId
 * @returns {number} Net score (upvotes - downvotes)
 */
export function getVoteScore(feedbackId) {
    const data = getVoteData(feedbackId);
    return data.upvotes - data.downvotes;
}

/**
 * Create vote buttons HTML for popup
 * @param {Object} feature - Feedback feature
 * @returns {string} HTML string
 */
export function createVoteButtonsHTML(feature) {
    const feedbackId = getFeedbackId(feature);
    const data = getVoteData(feedbackId);
    const score = data.upvotes - data.downvotes;

    return `
        <div class="vote-buttons" data-feedback-id="${feedbackId}">
            <button class="vote-btn upvote ${data.userVote === 'up' ? 'active' : ''}"
                onclick="window.appCallbacks.handleUpvote('${feedbackId}')" title="Support this feedback">
                <span class="vote-icon">▲</span>
                <span class="vote-count">${data.upvotes}</span>
            </button>
            <span class="vote-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}">${score}</span>
            <button class="vote-btn downvote ${data.userVote === 'down' ? 'active' : ''}"
                onclick="window.appCallbacks.handleDownvote('${feedbackId}')" title="Disagree with this feedback">
                <span class="vote-icon">▼</span>
                <span class="vote-count">${data.downvotes}</span>
            </button>
        </div>
    `;
}

/**
 * Update vote display in DOM
 * @param {string} feedbackId
 */
export function updateVoteDisplay(feedbackId) {
    const data = getVoteData(feedbackId);
    const container = document.querySelector(`.vote-buttons[data-feedback-id="${feedbackId}"]`);
    if (!container) return;

    const upvoteBtn = container.querySelector('.upvote');
    const downvoteBtn = container.querySelector('.downvote');
    const scoreEl = container.querySelector('.vote-score');

    if (upvoteBtn) {
        upvoteBtn.classList.toggle('active', data.userVote === 'up');
        upvoteBtn.querySelector('.vote-count').textContent = data.upvotes;
    }

    if (downvoteBtn) {
        downvoteBtn.classList.toggle('active', data.userVote === 'down');
        downvoteBtn.querySelector('.vote-count').textContent = data.downvotes;
    }

    if (scoreEl) {
        const score = data.upvotes - data.downvotes;
        scoreEl.textContent = score;
        scoreEl.className = `vote-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}`;
    }
}

// ========== HEATMAP VISUALIZATION ==========

/**
 * Create heatmap from feedback data
 * @param {Object} options - Heatmap options
 */
export async function createHeatmap(options = {}) {
    const map = state.getMap();
    const feedbackData = state.getFeedbackData();

    if (!map || !feedbackData.features.length) return;

    try {
        await loadHeatPlugin();
    } catch (error) {
        console.error('Could not load heatmap plugin:', error);
        return;
    }

    // Remove existing heatmap
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }

    const {
        radius = 25,
        blur = 15,
        maxZoom = 17,
        useRatingWeight = true,
        gradient = null
    } = options;

    // Convert feedback to heatmap points
    const points = feedbackData.features
        .filter(f => {
            // Apply date filter
            if (dateFilter.from || dateFilter.to) {
                const timestamp = new Date(f.properties.timestamp);
                if (dateFilter.from && timestamp < dateFilter.from) return false;
                if (dateFilter.to && timestamp > dateFilter.to) return false;
            }
            return true;
        })
        .map(f => {
            const coords = f.geometry.coordinates;
            let intensity = 1;

            if (useRatingWeight) {
                // Bad ratings have higher intensity (problems need attention)
                intensity = f.properties.rating === 'bad' ? 1 : 0.5;

                // Include vote scores
                const feedbackId = getFeedbackId(f);
                const score = getVoteScore(feedbackId);
                intensity += Math.max(0, score) * 0.1;
            }

            return [coords[1], coords[0], intensity];
        });

    if (points.length === 0) return;

    // Custom gradient for cycling feedback
    const defaultGradient = {
        0.0: '#00ff00',  // Green (low density)
        0.3: '#ffff00',  // Yellow
        0.5: '#ffa500',  // Orange
        0.7: '#ff4500',  // Red-orange
        1.0: '#ff0000'   // Red (high density)
    };

    heatmapLayer = L.heatLayer(points, {
        radius,
        blur,
        maxZoom,
        gradient: gradient || defaultGradient,
        minOpacity: 0.3
    });

    if (isHeatmapVisible) {
        heatmapLayer.addTo(map);
    }
}

/**
 * Toggle heatmap visibility
 * @returns {boolean} New visibility state
 */
export function toggleHeatmap() {
    const map = state.getMap();
    if (!map) return isHeatmapVisible;

    isHeatmapVisible = !isHeatmapVisible;

    if (isHeatmapVisible) {
        if (!heatmapLayer) {
            createHeatmap();
        } else {
            heatmapLayer.addTo(map);
        }
    } else if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }

    return isHeatmapVisible;
}

/**
 * Check if heatmap is visible
 * @returns {boolean}
 */
export function isHeatmapShown() {
    return isHeatmapVisible;
}

/**
 * Update heatmap with new options
 * @param {Object} options
 */
export function updateHeatmap(options) {
    createHeatmap(options);
}

// ========== TIME-BASED FILTERING ==========

/**
 * Set date filter
 * @param {Date|string|null} from - Start date
 * @param {Date|string|null} to - End date
 */
export function setDateFilter(from, to) {
    dateFilter.from = from ? new Date(from) : null;
    dateFilter.to = to ? new Date(to) : null;
}

/**
 * Get current date filter
 * @returns {Object} Date filter object
 */
export function getDateFilter() {
    return { ...dateFilter };
}

/**
 * Clear date filter
 */
export function clearDateFilter() {
    dateFilter.from = null;
    dateFilter.to = null;
}

/**
 * Filter feedback by date range
 * @param {Array} features - Feedback features
 * @returns {Array} Filtered features
 */
export function filterByDate(features) {
    if (!dateFilter.from && !dateFilter.to) {
        return features;
    }

    return features.filter(f => {
        const timestamp = new Date(f.properties.timestamp);
        if (dateFilter.from && timestamp < dateFilter.from) return false;
        if (dateFilter.to && timestamp > dateFilter.to) return false;
        return true;
    });
}

/**
 * Get date range presets
 * @returns {Array} Array of preset options
 */
export function getDatePresets() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return [
        { label: 'All time', from: null, to: null },
        { label: 'Today', from: today, to: null },
        { label: 'Last 7 days', from: new Date(today - 7 * 24 * 60 * 60 * 1000), to: null },
        { label: 'Last 30 days', from: new Date(today - 30 * 24 * 60 * 60 * 1000), to: null },
        { label: 'Last 90 days', from: new Date(today - 90 * 24 * 60 * 60 * 1000), to: null },
        { label: 'This year', from: new Date(now.getFullYear(), 0, 1), to: null },
        { label: 'Last year', from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear(), 0, 1) }
    ];
}

/**
 * Apply date preset
 * @param {string} presetLabel - Label of the preset
 */
export function applyDatePreset(presetLabel) {
    const preset = getDatePresets().find(p => p.label === presetLabel);
    if (preset) {
        setDateFilter(preset.from, preset.to);
    }
}

/**
 * Get feedback statistics by time period
 * @param {Array} features - Feedback features
 * @returns {Object} Statistics
 */
export function getFeedbackStatsByTime(features) {
    const stats = {
        total: features.length,
        byMonth: {},
        byWeek: {},
        byRating: { good: 0, bad: 0 },
        trend: []
    };

    features.forEach(f => {
        const date = new Date(f.properties.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const weekKey = getWeekKey(date);

        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
        stats.byWeek[weekKey] = (stats.byWeek[weekKey] || 0) + 1;

        if (f.properties.rating === 'good') {
            stats.byRating.good++;
        } else {
            stats.byRating.bad++;
        }
    });

    // Calculate trend (last 7 days)
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const count = features.filter(f =>
            f.properties.timestamp && f.properties.timestamp.startsWith(dateStr)
        ).length;
        stats.trend.push({ date: dateStr, count });
    }

    return stats;
}

/**
 * Get ISO week key for a date
 * @param {Date} date
 * @returns {string}
 */
function getWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Export community module functions for callbacks
 */
export function handleUpvote(feedbackId) {
    upvote(feedbackId, () => updateVoteDisplay(feedbackId));
}

export function handleDownvote(feedbackId) {
    downvote(feedbackId, () => updateVoteDisplay(feedbackId));
}

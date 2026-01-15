/**
 * HTML template helpers for consistent UI generation
 * @module templates
 */

/**
 * Create a checkbox item HTML
 * @param {Object} options - Checkbox options
 * @param {string} options.id - Checkbox ID
 * @param {boolean} options.checked - Whether checkbox is checked
 * @param {string} options.label - Label text
 * @param {string} options.onChange - Onchange handler
 * @param {string} [options.colorValue] - Optional color picker value
 * @param {string} [options.onColorChange] - Optional color change handler
 * @returns {string} HTML string
 */
export function checkboxItem({ id, checked, label, onChange, colorValue, onColorChange }) {
    const checkedAttr = checked ? 'checked' : '';
    const colorPicker = colorValue && onColorChange
        ? `<input type="color" value="${colorValue}" onchange="${onColorChange}" title="Set color for ${label}">`
        : '';

    return `
        <div class="checkbox-item">
            <input type="checkbox" id="${id}" ${checkedAttr} onchange="${onChange}">
            <label for="${id}">${label}</label>
            ${colorPicker}
        </div>`;
}

/**
 * Create a filter group HTML with select all/none buttons
 * @param {Object} options - Filter group options
 * @param {string} options.label - Group label
 * @param {string} options.onSelectAll - Select all handler
 * @param {string} options.onSelectNone - Select none handler
 * @param {string} options.content - Inner content (checkboxes)
 * @param {string} [options.colorModeId] - Optional color mode checkbox ID
 * @param {boolean} [options.colorModeChecked] - Optional color mode checked state
 * @param {string} [options.onColorModeChange] - Optional color mode change handler
 * @returns {string} HTML string
 */
export function filterGroup({ label, onSelectAll, onSelectNone, content, colorModeId, colorModeChecked, onColorModeChange }) {
    const colorMode = colorModeId && onColorModeChange
        ? `<div class="filter-color-mode">
               <input type="checkbox" id="${colorModeId}" ${colorModeChecked ? 'checked' : ''} onchange="${onColorModeChange}">
               <label for="${colorModeId}">Color by this field</label>
           </div>`
        : '';

    return `
        <div class="filter-group">
            <label>${label}</label>
            ${colorMode}
            <div class="select-all-row">
                <button onclick="${onSelectAll}">All</button>
                <button onclick="${onSelectNone}">None</button>
            </div>
            <div class="checkbox-group">${content}</div>
        </div>`;
}

/**
 * Create a numeric filter row HTML
 * @param {Object} options - Numeric filter options
 * @param {string} options.label - Field label
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {number} options.currentMin - Current minimum filter value
 * @param {number} options.currentMax - Current maximum filter value
 * @param {string} options.onMinChange - Min value change handler
 * @param {string} options.onMaxChange - Max value change handler
 * @returns {string} HTML string
 */
export function numericFilter({ label, min, max, currentMin, currentMax, onMinChange, onMaxChange }) {
    return `
        <div class="filter-group">
            <label>${label} (${min.toFixed(1)} - ${max.toFixed(1)})</label>
            <div class="filter-row">
                <input type="number" placeholder="Min" value="${currentMin}" step="0.1" onchange="${onMinChange}">
                <span>to</span>
                <input type="number" placeholder="Max" value="${currentMax}" step="0.1" onchange="${onMaxChange}">
            </div>
        </div>`;
}

/**
 * Create a filter section header with clear button
 * @param {Object} options - Section options
 * @param {string} options.title - Section title
 * @param {string} options.onClear - Clear button handler
 * @param {number} options.filteredCount - Number of filtered items
 * @param {number} options.totalCount - Total number of items
 * @returns {string} HTML string
 */
export function filterSectionHeader({ title, onClear, filteredCount, totalCount }) {
    return `
        <h4>
            ${title}
            <button class="btn btn-sm btn-secondary" onclick="${onClear}">Clear</button>
        </h4>
        <div class="filter-count">Showing ${filteredCount} of ${totalCount} features</div>`;
}

/**
 * Create a stat row HTML
 * @param {string} label - Row label
 * @param {string|number} value - Row value
 * @param {boolean} [highlight=false] - Whether to highlight the value
 * @returns {string} HTML string
 */
export function statRow(label, value, highlight = false) {
    const valueClass = highlight ? 'class="stat-value"' : '';
    return `<div class="stat-row"><span>${label}:</span><span ${valueClass}>${value}</span></div>`;
}

/**
 * Create a collapsible details section
 * @param {string} summary - Summary text
 * @param {string} content - Inner content
 * @returns {string} HTML string
 */
export function detailsSection(summary, content) {
    return `
        <details style="margin-top: 4px;">
            <summary style="font-size: 11px; cursor: pointer;">${summary}</summary>
            <div style="margin-top: 4px; font-size: 11px;">${content}</div>
        </details>`;
}

/**
 * Create a style row HTML for the style panel
 * @param {Object} options - Style row options
 * @param {string} options.label - Row label
 * @param {string} options.inputType - Input type (color, range, select, checkbox)
 * @param {*} options.value - Current value
 * @param {string} options.onChange - Change handler
 * @param {Object} [options.rangeOptions] - Range input options (min, max, step)
 * @param {Array} [options.selectOptions] - Select options array of {value, label}
 * @param {string} [options.valueDisplayId] - ID for value display element
 * @param {string} [options.valueDisplay] - Current value to display
 * @returns {string} HTML string
 */
export function styleRow({ label, inputType, value, onChange, rangeOptions, selectOptions, valueDisplayId, valueDisplay }) {
    let input = '';

    switch (inputType) {
        case 'color':
            input = `<input type="color" value="${value}" onchange="${onChange}">`;
            break;

        case 'range':
            const { min, max, step = 1 } = rangeOptions || {};
            const displaySpan = valueDisplayId
                ? `<span class="value-display" id="${valueDisplayId}">${valueDisplay}</span>`
                : '';
            input = `
                <input type="range" min="${min}" max="${max}" step="${step}" value="${value}"
                    oninput="document.getElementById('${valueDisplayId}').textContent = ${step < 1 ? "(this.value * 100).toFixed(0) + '%'" : 'this.value'}"
                    onchange="${onChange}">
                ${displaySpan}`;
            break;

        case 'select':
            const options = selectOptions.map(opt =>
                `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`
            ).join('');
            input = `<select onchange="${onChange}">${options}</select>`;
            break;

        case 'checkbox':
            input = `<input type="checkbox" ${value ? 'checked' : ''} onchange="${onChange}">`;
            break;

        default:
            input = `<input type="text" value="${value}" onchange="${onChange}">`;
    }

    return `
        <div class="style-row">
            <label>${label}</label>
            ${input}
        </div>`;
}

/**
 * Create an analysis metric HTML
 * @param {string} label - Metric label
 * @param {string|number} value - Metric value
 * @returns {string} HTML string
 */
export function analysisMetric(label, value) {
    return `
        <div class="metric">
            <span>${label}:</span>
            <span class="metric-value">${value}</span>
        </div>`;
}

/**
 * Create a breakdown section HTML
 * @param {string} title - Breakdown title
 * @param {Array<{label: string, count: number, percentage: number}>} items - Breakdown items
 * @returns {string} HTML string
 */
export function breakdownSection(title, items) {
    const itemsHtml = items.map(item => `
        <div class="breakdown-item">
            <span>${item.label}</span>
            <span>${item.count} (${item.percentage}%)</span>
        </div>
    `).join('');

    return `
        <div class="breakdown">
            <div class="breakdown-title">${title}:</div>
            ${itemsHtml}
        </div>`;
}

/**
 * Create a legend item HTML
 * @param {Object} options - Legend item options
 * @param {string} options.color - Item color
 * @param {string} options.label - Item label
 * @param {string} [options.type='line'] - Item type ('line' or 'point')
 * @param {number} [options.height] - Optional height override for lines
 * @returns {string} HTML string
 */
export function legendItem({ color, label, type = 'line', height }) {
    const indicatorClass = type === 'point' ? 'legend-point' : 'legend-line';
    const style = height ? `background: ${color}; height: ${height}px;` : `background: ${color};`;

    return `
        <div class="legend-item">
            <div class="${indicatorClass}" style="${style}"></div>
            <span>${label}</span>
        </div>`;
}

/**
 * Create a custom layer list item HTML
 * @param {Object} options - Layer item options
 * @param {string} options.layerId - Layer ID
 * @param {string} options.name - Layer name
 * @param {string} options.color - Layer color
 * @param {boolean} options.visible - Layer visibility
 * @returns {string} HTML string
 */
export function customLayerItem({ layerId, name, color, visible }) {
    const visibilityIcon = visible ? '👁️' : '👁️‍🗨️';

    return `
        <div class="custom-layer-item">
            <div class="layer-info">
                <div class="color-indicator" style="background: ${color};"></div>
                <span class="layer-name" title="${name}">${name}</span>
            </div>
            <div class="layer-controls">
                <button onclick="window.appCallbacks.toggleCustomLayer('${layerId}')" title="Toggle visibility">${visibilityIcon}</button>
                <button onclick="window.appCallbacks.zoomToLayer('${layerId}')" title="Zoom to layer">🔍</button>
                <button onclick="window.appCallbacks.removeCustomLayer('${layerId}')" title="Remove layer">🗑️</button>
            </div>
        </div>`;
}

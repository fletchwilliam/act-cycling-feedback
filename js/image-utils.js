/**
 * Image utilities for client-side compression and handling
 * @module image-utils
 */

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Target size for compression (800KB for efficient storage)
const TARGET_SIZE = 800 * 1024;

// Maximum dimensions for resizing
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

/**
 * Validate image file size and type
 * @param {File} file - The file to validate
 * @returns {Object} Validation result with isValid and error
 */
export function validateImage(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!validTypes.includes(file.type)) {
        return {
            isValid: false,
            error: 'Invalid file type. Please use JPEG, PNG, WebP, or GIF.'
        };
    }

    if (file.size > MAX_FILE_SIZE) {
        return {
            isValid: false,
            error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
        };
    }

    return { isValid: true, error: null };
}

/**
 * Load image from file
 * @param {File} file - Image file
 * @returns {Promise<HTMLImageElement>} Loaded image element
 */
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @returns {Object} New width and height
 */
function calculateDimensions(width, height) {
    let newWidth = width;
    let newHeight = height;

    if (width > MAX_WIDTH) {
        newWidth = MAX_WIDTH;
        newHeight = Math.round((height / width) * MAX_WIDTH);
    }

    if (newHeight > MAX_HEIGHT) {
        newHeight = MAX_HEIGHT;
        newWidth = Math.round((width / height) * MAX_HEIGHT);
    }

    return { width: newWidth, height: newHeight };
}

/**
 * Compress and resize image
 * @param {File} file - Image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<Object>} Compressed image data with base64 and metadata
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = MAX_WIDTH,
        maxHeight = MAX_HEIGHT,
        quality = 0.8,
        targetSize = TARGET_SIZE
    } = options;

    const validation = validateImage(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    const img = await loadImage(file);
    const { width, height } = calculateDimensions(img.width, img.height);

    // Create canvas for compression
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    // Try to compress to target size
    let currentQuality = quality;
    let dataUrl;
    let attempt = 0;
    const maxAttempts = 5;

    do {
        dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        const size = Math.round((dataUrl.length * 3) / 4); // Approximate byte size

        if (size <= targetSize || attempt >= maxAttempts) break;

        currentQuality -= 0.1;
        attempt++;
    } while (currentQuality > 0.3);

    return {
        base64: dataUrl,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: Math.round((dataUrl.length * 3) / 4),
        width,
        height,
        mimeType: 'image/jpeg'
    };
}

/**
 * Process multiple images
 * @param {FileList|Array} files - Images to process
 * @param {number} maxImages - Maximum number of images to process
 * @returns {Promise<Array>} Array of compressed image data
 */
export async function processImages(files, maxImages = 3) {
    const results = [];
    const fileArray = Array.from(files).slice(0, maxImages);

    for (const file of fileArray) {
        try {
            const compressed = await compressImage(file);
            results.push(compressed);
        } catch (error) {
            console.warn(`Failed to process image ${file.name}:`, error.message);
            results.push({
                error: error.message,
                originalName: file.name
            });
        }
    }

    return results;
}

/**
 * Create thumbnail preview element
 * @param {string} base64 - Base64 image data
 * @param {string} name - Image name
 * @param {Function} onRemove - Callback when remove is clicked
 * @returns {HTMLElement} Thumbnail element
 */
export function createThumbnail(base64, name, onRemove) {
    const container = document.createElement('div');
    container.className = 'image-thumbnail';

    const img = document.createElement('img');
    img.src = base64;
    img.alt = name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onRemove) onRemove();
        container.remove();
    };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'image-name';
    nameSpan.textContent = name.length > 15 ? name.substring(0, 12) + '...' : name;

    container.appendChild(img);
    container.appendChild(removeBtn);
    container.appendChild(nameSpan);

    return container;
}

/**
 * Extract image URLs from feedback for external storage reference
 * @param {Array} images - Array of image objects
 * @returns {Array} Array of image references
 */
export function createImageReferences(images) {
    return images.map((img, index) => ({
        id: `img_${Date.now()}_${index}`,
        name: img.originalName,
        size: img.compressedSize,
        width: img.width,
        height: img.height,
        // For local storage, include base64; for server storage, this would be a URL
        data: img.base64
    }));
}

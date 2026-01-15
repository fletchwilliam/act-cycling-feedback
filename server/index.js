/**
 * ACT Cycling Feedback API Server
 * Express.js backend with PostgreSQL/PostGIS
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/cycling_feedback',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 3
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
    }
});

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== FEEDBACK ENDPOINTS ==========

/**
 * Submit new feedback
 * POST /api/feedback
 */
app.post('/api/feedback', upload.array('images', 3), async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            latitude,
            longitude,
            rating,
            category,
            categoryLabel,
            comment,
            submitterName,
            submitterEmail,
            pathName,
            pathType,
            pathSurface,
            suburb
        } = req.body;

        // Validate required fields
        if (!latitude || !longitude || !rating || !category) {
            return res.status(400).json({
                error: 'Missing required fields: latitude, longitude, rating, category'
            });
        }

        await client.query('BEGIN');

        // Insert feedback
        const feedbackResult = await client.query(`
            INSERT INTO feedback (
                location, rating, category, category_label, comment,
                submitter_name, submitter_email, path_name, path_type,
                path_surface, suburb
            ) VALUES (
                ST_SetSRID(ST_MakePoint($1, $2), 4326),
                $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            ) RETURNING id, created_at
        `, [
            parseFloat(longitude),
            parseFloat(latitude),
            rating,
            category,
            categoryLabel || category,
            comment || null,
            submitterName || null,
            submitterEmail || null,
            pathName || null,
            pathType || null,
            pathSurface || null,
            suburb || null
        ]);

        const feedbackId = feedbackResult.rows[0].id;

        // Process and save images
        const savedImages = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const imageId = uuidv4();
                const filename = `${imageId}.jpg`;
                const filepath = path.join(uploadsDir, filename);

                // Process image with sharp
                const metadata = await sharp(file.buffer)
                    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toFile(filepath);

                const storageUrl = `/uploads/${filename}`;

                // Save image record
                await client.query(`
                    INSERT INTO feedback_images (
                        id, feedback_id, filename, original_name, mime_type,
                        file_size, width, height, storage_path, storage_url
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    imageId,
                    feedbackId,
                    filename,
                    file.originalname,
                    'image/jpeg',
                    metadata.size,
                    metadata.width,
                    metadata.height,
                    filepath,
                    storageUrl
                ]);

                savedImages.push({ id: imageId, url: storageUrl, filename });
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            feedbackId,
            createdAt: feedbackResult.rows[0].created_at,
            images: savedImages
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    } finally {
        client.release();
    }
});

/**
 * Get all feedback as GeoJSON
 * GET /api/feedback
 */
app.get('/api/feedback', async (req, res) => {
    try {
        const {
            rating,
            category,
            suburb,
            status,
            from,
            to,
            limit = 1000,
            offset = 0
        } = req.query;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (rating) {
            whereConditions.push(`rating = $${paramIndex++}`);
            params.push(rating);
        }

        if (category) {
            whereConditions.push(`category = $${paramIndex++}`);
            params.push(category);
        }

        if (suburb) {
            whereConditions.push(`suburb ILIKE $${paramIndex++}`);
            params.push(`%${suburb}%`);
        }

        if (status) {
            whereConditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (from) {
            whereConditions.push(`created_at >= $${paramIndex++}`);
            params.push(new Date(from));
        }

        if (to) {
            whereConditions.push(`created_at <= $${paramIndex++}`);
            params.push(new Date(to));
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(`
            SELECT
                id, rating, category, category_label, comment,
                submitter_name, path_name, path_type, path_surface, suburb,
                upvotes, downvotes, status, created_at,
                ST_X(location) as longitude,
                ST_Y(location) as latitude,
                (SELECT json_agg(json_build_object('id', fi.id, 'url', fi.storage_url))
                 FROM feedback_images fi WHERE fi.feedback_id = feedback.id) as images
            FROM feedback
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, params);

        // Convert to GeoJSON
        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [row.longitude, row.latitude]
                },
                properties: {
                    id: row.id,
                    rating: row.rating,
                    category: row.category,
                    categoryLabel: row.category_label,
                    comment: row.comment,
                    submitterName: row.submitter_name,
                    pathName: row.path_name,
                    pathType: row.path_type,
                    pathSurface: row.path_surface,
                    suburb: row.suburb,
                    upvotes: row.upvotes,
                    downvotes: row.downvotes,
                    status: row.status,
                    timestamp: row.created_at,
                    images: row.images || []
                }
            }))
        };

        res.json(geojson);

    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

/**
 * Get single feedback by ID
 * GET /api/feedback/:id
 */
app.get('/api/feedback/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT * FROM feedback_with_scores WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

/**
 * Vote on feedback
 * POST /api/feedback/:id/vote
 */
app.post('/api/feedback/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { vote } = req.body; // 'up', 'down', or null
        const userIdentifier = req.ip || req.headers['x-forwarded-for'] || 'anonymous';

        if (vote === null) {
            // Remove vote
            await pool.query(`
                DELETE FROM feedback_votes
                WHERE feedback_id = $1 AND user_identifier = $2
            `, [id, userIdentifier]);
        } else if (vote === 'up' || vote === 'down') {
            // Upsert vote
            await pool.query(`
                INSERT INTO feedback_votes (feedback_id, user_identifier, vote_type)
                VALUES ($1, $2, $3)
                ON CONFLICT (feedback_id, user_identifier)
                DO UPDATE SET vote_type = $3
            `, [id, userIdentifier, vote]);
        } else {
            return res.status(400).json({ error: 'Invalid vote type' });
        }

        // Get updated counts
        const result = await pool.query(`
            SELECT upvotes, downvotes FROM feedback WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        res.json({
            success: true,
            upvotes: result.rows[0].upvotes,
            downvotes: result.rows[0].downvotes
        });

    } catch (error) {
        console.error('Error voting:', error);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

/**
 * Get feedback within bounds (for map view)
 * GET /api/feedback/bounds
 */
app.get('/api/feedback/bounds', async (req, res) => {
    try {
        const { north, south, east, west } = req.query;

        if (!north || !south || !east || !west) {
            return res.status(400).json({
                error: 'Missing bounds parameters: north, south, east, west'
            });
        }

        const result = await pool.query(`
            SELECT
                id, rating, category, category_label, comment,
                path_name, suburb, upvotes, downvotes, created_at,
                ST_X(location) as longitude,
                ST_Y(location) as latitude
            FROM feedback
            WHERE ST_Within(
                location,
                ST_MakeEnvelope($1, $2, $3, $4, 4326)
            )
            ORDER BY created_at DESC
            LIMIT 500
        `, [
            parseFloat(west),
            parseFloat(south),
            parseFloat(east),
            parseFloat(north)
        ]);

        const geojson = {
            type: 'FeatureCollection',
            features: result.rows.map(row => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [row.longitude, row.latitude]
                },
                properties: {
                    id: row.id,
                    rating: row.rating,
                    category: row.category,
                    categoryLabel: row.category_label,
                    comment: row.comment,
                    pathName: row.path_name,
                    suburb: row.suburb,
                    upvotes: row.upvotes,
                    downvotes: row.downvotes,
                    timestamp: row.created_at
                }
            }))
        };

        res.json(geojson);

    } catch (error) {
        console.error('Error fetching feedback by bounds:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

/**
 * Get heatmap data
 * GET /api/feedback/heatmap
 */
app.get('/api/feedback/heatmap', async (req, res) => {
    try {
        const { from, to, rating } = req.query;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (from) {
            whereConditions.push(`created_at >= $${paramIndex++}`);
            params.push(new Date(from));
        }

        if (to) {
            whereConditions.push(`created_at <= $${paramIndex++}`);
            params.push(new Date(to));
        }

        if (rating) {
            whereConditions.push(`rating = $${paramIndex++}`);
            params.push(rating);
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const result = await pool.query(`
            SELECT
                ST_X(location) as longitude,
                ST_Y(location) as latitude,
                rating,
                upvotes - downvotes as score
            FROM feedback
            ${whereClause}
        `, params);

        const heatmapData = result.rows.map(row => ({
            lat: row.latitude,
            lng: row.longitude,
            intensity: row.rating === 'bad' ? 1 : 0.5,
            score: row.score
        }));

        res.json(heatmapData);

    } catch (error) {
        console.error('Error fetching heatmap data:', error);
        res.status(500).json({ error: 'Failed to fetch heatmap data' });
    }
});

/**
 * Get statistics
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE rating = 'good') as good_count,
                COUNT(*) FILTER (WHERE rating = 'bad') as bad_count,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7_days,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30_days
            FROM feedback
        `);

        const categoryStats = await pool.query(`
            SELECT category, COUNT(*) as count
            FROM feedback
            GROUP BY category
            ORDER BY count DESC
        `);

        const suburbStats = await pool.query(`
            SELECT suburb, COUNT(*) as count
            FROM feedback
            WHERE suburb IS NOT NULL
            GROUP BY suburb
            ORDER BY count DESC
            LIMIT 10
        `);

        res.json({
            summary: result.rows[0],
            byCategory: categoryStats.rows,
            bySuburb: suburbStats.rows
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ========== ADMIN ENDPOINTS ==========

/**
 * Update feedback status (admin)
 * PATCH /api/admin/feedback/:id
 */
app.patch('/api/admin/feedback/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;

        const validStatuses = ['pending', 'reviewed', 'resolved', 'rejected'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (status) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);
            if (status !== 'pending') {
                updates.push(`reviewed_at = NOW()`);
            }
        }

        if (adminNotes !== undefined) {
            updates.push(`admin_notes = $${paramIndex++}`);
            params.push(adminNotes);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id);

        const result = await pool.query(`
            UPDATE feedback
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        res.json({ success: true, feedback: result.rows[0] });

    } catch (error) {
        console.error('Error updating feedback:', error);
        res.status(500).json({ error: 'Failed to update feedback' });
    }
});

/**
 * Delete feedback (admin)
 * DELETE /api/admin/feedback/:id
 */
app.delete('/api/admin/feedback/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get images to delete
        const images = await pool.query(`
            SELECT storage_path FROM feedback_images WHERE feedback_id = $1
        `, [id]);

        // Delete from database (cascade will delete images records)
        const result = await pool.query(`
            DELETE FROM feedback WHERE id = $1 RETURNING id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        // Delete image files
        for (const img of images.rows) {
            if (img.storage_path && fs.existsSync(img.storage_path)) {
                fs.unlinkSync(img.storage_path);
            }
        }

        res.json({ success: true, deletedId: id });

    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({ error: 'Failed to delete feedback' });
    }
});

/**
 * Export feedback as CSV
 * GET /api/admin/export
 */
app.get('/api/admin/export', async (req, res) => {
    try {
        const { format = 'csv' } = req.query;

        const result = await pool.query(`
            SELECT
                id, rating, category, category_label, comment,
                submitter_name, submitter_email, path_name, path_type,
                path_surface, suburb, upvotes, downvotes, status,
                admin_notes, created_at, reviewed_at,
                ST_X(location) as longitude,
                ST_Y(location) as latitude
            FROM feedback
            ORDER BY created_at DESC
        `);

        if (format === 'geojson') {
            const geojson = {
                type: 'FeatureCollection',
                features: result.rows.map(row => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [row.longitude, row.latitude]
                    },
                    properties: { ...row }
                }))
            };
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.geojson');
            return res.json(geojson);
        }

        // CSV format
        const headers = Object.keys(result.rows[0] || {});
        const csv = [
            headers.join(','),
            ...result.rows.map(row =>
                headers.map(h => {
                    const val = row[h];
                    if (val === null || val === undefined) return '';
                    const str = String(val).replace(/"/g, '""');
                    return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
                }).join(',')
            )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
        res.send(csv);

    } catch (error) {
        console.error('Error exporting feedback:', error);
        res.status(500).json({ error: 'Failed to export feedback' });
    }
});

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 3 images.' });
        }
    }

    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`ACT Cycling Feedback API server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});

export default app;

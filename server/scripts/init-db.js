/**
 * Database initialization script
 * Creates tables with PostGIS support
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/cycling_feedback',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    const client = await pool.connect();

    try {
        console.log('Initializing database...');

        // Enable PostGIS extension
        await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
        console.log('PostGIS extension enabled');

        // Enable UUID extension
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        console.log('UUID extension enabled');

        // Create feedback table
        await client.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                location GEOMETRY(Point, 4326) NOT NULL,
                rating VARCHAR(10) NOT NULL CHECK (rating IN ('good', 'bad')),
                category VARCHAR(50) NOT NULL,
                category_label VARCHAR(100),
                comment TEXT,
                submitter_name VARCHAR(255),
                submitter_email VARCHAR(255),
                path_name VARCHAR(255),
                path_type VARCHAR(100),
                path_surface VARCHAR(100),
                suburb VARCHAR(100),
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'rejected')),
                admin_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                reviewed_at TIMESTAMP WITH TIME ZONE,
                reviewed_by VARCHAR(255)
            );
        `);
        console.log('Feedback table created');

        // Create spatial index
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_feedback_location
            ON feedback USING GIST (location);
        `);
        console.log('Spatial index created');

        // Create other indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback (rating);
            CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback (category);
            CREATE INDEX IF NOT EXISTS idx_feedback_suburb ON feedback (suburb);
            CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
            CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);
        `);
        console.log('Additional indexes created');

        // Create images table
        await client.query(`
            CREATE TABLE IF NOT EXISTS feedback_images (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255),
                mime_type VARCHAR(100),
                file_size INTEGER,
                width INTEGER,
                height INTEGER,
                storage_path VARCHAR(500),
                storage_url VARCHAR(500),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('Feedback images table created');

        // Create votes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS feedback_votes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
                user_identifier VARCHAR(255) NOT NULL,
                vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(feedback_id, user_identifier)
            );
        `);
        console.log('Feedback votes table created');

        // Create admin users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                role VARCHAR(20) DEFAULT 'reviewer' CHECK (role IN ('admin', 'reviewer')),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_login TIMESTAMP WITH TIME ZONE
            );
        `);
        console.log('Admin users table created');

        // Create audit log table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                action VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id UUID,
                user_id UUID REFERENCES admin_users(id),
                old_values JSONB,
                new_values JSONB,
                ip_address INET,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('Audit log table created');

        // Create function to update updated_at timestamp
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // Create trigger for updated_at
        await client.query(`
            DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
            CREATE TRIGGER update_feedback_updated_at
                BEFORE UPDATE ON feedback
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);
        console.log('Update trigger created');

        // Create function to update vote counts
        await client.query(`
            CREATE OR REPLACE FUNCTION update_vote_counts()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
                    UPDATE feedback SET
                        upvotes = (SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = NEW.feedback_id AND vote_type = 'up'),
                        downvotes = (SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = NEW.feedback_id AND vote_type = 'down')
                    WHERE id = NEW.feedback_id;
                    RETURN NEW;
                ELSIF TG_OP = 'DELETE' THEN
                    UPDATE feedback SET
                        upvotes = (SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = OLD.feedback_id AND vote_type = 'up'),
                        downvotes = (SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = OLD.feedback_id AND vote_type = 'down')
                    WHERE id = OLD.feedback_id;
                    RETURN OLD;
                END IF;
            END;
            $$ language 'plpgsql';
        `);

        // Create trigger for vote counts
        await client.query(`
            DROP TRIGGER IF EXISTS update_feedback_votes ON feedback_votes;
            CREATE TRIGGER update_feedback_votes
                AFTER INSERT OR UPDATE OR DELETE ON feedback_votes
                FOR EACH ROW
                EXECUTE FUNCTION update_vote_counts();
        `);
        console.log('Vote count trigger created');

        // Create view for feedback with vote scores
        await client.query(`
            CREATE OR REPLACE VIEW feedback_with_scores AS
            SELECT
                f.*,
                f.upvotes - f.downvotes AS score,
                ST_X(f.location) AS longitude,
                ST_Y(f.location) AS latitude,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'id', fi.id,
                        'url', fi.storage_url,
                        'filename', fi.filename
                    )) FROM feedback_images fi WHERE fi.feedback_id = f.id),
                    '[]'::json
                ) AS images
            FROM feedback f;
        `);
        console.log('Feedback view created');

        console.log('Database initialization complete!');

    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

initDatabase().catch(console.error);

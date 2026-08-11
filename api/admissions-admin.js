const ADMIN_PASSWORD = 'saysadmin2024'; // Same password as homework/campus-tour admin

let poolPromise;

function getConnectionString() {
    const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
    const trimmed = String(raw).trim();

    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

async function getPool() {
    if (!poolPromise) {
        poolPromise = import('@vercel/postgres').then(function ({ createPool }) {
            return createPool({
                connectionString: getConnectionString()
            });
        });
    }

    return poolPromise;
}

function getRequestUrl(request) {
    try {
        return new URL(request.url, 'http://localhost');
    } catch (error) {
        return null;
    }
}

function authenticateRequest(request) {
    const url = getRequestUrl(request);
    const queryPassword = url ? url.searchParams.get('password') : null;
    const headerPassword = request.headers['x-admin-password'] ||
        (request.headers['authorization'] || '').replace('Bearer ', '');

    return queryPassword === ADMIN_PASSWORD || headerPassword === ADMIN_PASSWORD;
}

async function getAdmissions() {
    const db = await getPool();

    const result = await db.query(`
        SELECT
            id, student_name, gender, religion, nationality, parent_name, email,
            mobile_phone, home_phone, grade, enrollment_type, previously_applied, previous_year,
            vision, hearing, speech, development_delays, allergies, communicable_disease,
            emergency_care, heart_condition, medical_notes, relative_name, relative_tel,
            preferred_hospital, insurance, condition_details, submitted_at,
            (birth_certificate_url IS NOT NULL) AS has_birth_certificate,
            (passport_photo_url IS NOT NULL) AS has_passport_photo,
            COALESCE(array_length(report_card_urls, 1), 0) AS report_card_count
        FROM student_admissions
        ORDER BY submitted_at DESC
    `);

    return result.rows;
}

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    if (!authenticateRequest(request)) {
        return response.status(401).json({
            error: 'Unauthorized. Invalid or missing admin password.'
        });
    }

    if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!getConnectionString()) {
            console.error('admissions-admin: missing DB connection string env var');
            return response.status(503).json({
                error: 'Database not connected yet. In Vercel, connect the Neon database to this project.'
            });
        }

        const admissions = await getAdmissions();

        return response.status(200).json({
            success: true,
            admissions: admissions,
            total: admissions.length
        });
    } catch (error) {
        console.error('admissions-admin: GET error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a'
        });

        return response.status(500).json({
            error: 'Failed to load admissions.'
        });
    }
}

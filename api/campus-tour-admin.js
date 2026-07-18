const ADMIN_PASSWORD = 'saysadmin2024'; // Same password as homework admin

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

function normalizeText(value, maxLength) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function parseBody(body) {
    if (typeof body === 'string') {
        try {
            return JSON.parse(body || '{}');
        } catch (error) {
            return {};
        }
    }

    return body || {};
}

async function getCampusTourBookings() {
    const db = await getPool();

    const result = await db.query(`
        SELECT
            id,
            full_name,
            tour_date,
            tour_time,
            phone,
            email,
            special_request,
            ip_address,
            submitted_at
        FROM campus_tour_bookings
        ORDER BY tour_date DESC, tour_time ASC, submitted_at DESC
    `);

    return result.rows;
}

async function deleteCampusTourBooking(id) {
    const db = await getPool();

    const result = await db.query(`
        DELETE FROM campus_tour_bookings
        WHERE id = $1
        RETURNING id
    `, [id]);

    return result.rowCount > 0;
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
        request.headers['authorization']?.replace('Bearer ', '');

    return queryPassword === ADMIN_PASSWORD || headerPassword === ADMIN_PASSWORD;
}

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    // Authentication check
    if (!authenticateRequest(request)) {
        return response.status(401).json({
            error: 'Unauthorized. Invalid or missing admin password.'
        });
    }

    if (request.method === 'GET') {
        try {
            if (!getConnectionString()) {
                console.error('campus-tour-admin: missing DB connection string env var');
                return response.status(503).json({
                    error: 'Database not connected yet. In Vercel, connect the Neon database to this project.'
                });
            }

            const bookings = await getCampusTourBookings();

            return response.status(200).json({
                success: true,
                bookings: bookings,
                total: bookings.length
            });
        } catch (error) {
            console.error('campus-tour-admin: GET error', {
                message: error && error.message ? error.message : 'unknown',
                code: error && error.code ? error.code : 'n/a'
            });

            return response.status(500).json({
                error: 'Failed to load campus tour bookings.'
            });
        }
    } else if (request.method === 'DELETE') {
        try {
            if (!getConnectionString()) {
                console.error('campus-tour-admin: missing DB connection string env var');
                return response.status(503).json({
                    error: 'Database not connected yet. In Vercel, connect the Neon database to this project.'
                });
            }

            const url = getRequestUrl(request);
            const id = url ? parseInt(url.searchParams.get('id')) : NaN;
            if (!id || isNaN(id)) {
                return response.status(400).json({
                    error: 'Invalid booking ID provided.'
                });
            }

            const deleted = await deleteCampusTourBooking(id);
            if (!deleted) {
                return response.status(404).json({
                    error: 'Booking not found or already deleted.'
                });
            }

            return response.status(200).json({
                success: true,
                message: 'Booking deleted successfully.'
            });
        } catch (error) {
            console.error('campus-tour-admin: DELETE error', {
                message: error && error.message ? error.message : 'unknown',
                code: error && error.code ? error.code : 'n/a'
            });

            return response.status(500).json({
                error: 'Failed to delete booking.'
            });
        }
    } else {
        response.setHeader('Allow', 'GET, DELETE');
        return response.status(405).json({ error: 'Method not allowed' });
    }
}
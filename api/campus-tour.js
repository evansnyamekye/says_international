const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
            try {
                const params = new URLSearchParams(body);
                const result = {};
                for (const [key, value] of params.entries()) {
                    result[key] = value;
                }
                return result;
            } catch (parseError) {
                return {};
            }
        }
    }

    return body || {};
}

function getIpAddress(request) {
    const forwarded = request.headers['x-forwarded-for'];

    if (Array.isArray(forwarded)) {
        return normalizeText(forwarded[0], 120);
    }

    return normalizeText(String(forwarded || '').split(',')[0], 120);
}

async function storeCampusTourBooking(payload) {
    const db = await getPool();

    await db.query(`
        CREATE TABLE IF NOT EXISTS campus_tour_bookings (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            tour_date DATE NOT NULL,
            tour_time TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            special_request TEXT,
            ip_address TEXT,
            user_agent TEXT,
            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await db.query(`
        INSERT INTO campus_tour_bookings (full_name, tour_date, tour_time, phone, email, special_request, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `, [payload.fullName, payload.tourDate, payload.tourTime, payload.phone, payload.email, payload.specialRequest, payload.ipAddress, payload.userAgent]);
}

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!getConnectionString()) {
            console.error('campus-tour: missing DB connection string env var');
            return response.status(503).json({
                error: 'Campus tour booking is not connected yet. In Vercel, connect the Neon database to this project and enable the Production environment, or add DATABASE_URL manually.'
            });
        }

        const body = parseBody(request.body);
        const fullName = normalizeText(body['your-name'], 120);
        const tourDate = normalizeText(body['tour-date'], 20);
        const tourTime = normalizeText(body['tour-time'], 20);
        const phone = normalizeText(body['your-phone'], 20);
        const email = normalizeText(body['your-email'], 160).toLowerCase();
        const specialRequest = normalizeText(body['special-request'], 1000);
        const userAgent = normalizeText(request.headers['user-agent'], 500);
        const ipAddress = getIpAddress(request);

        if (!fullName) {
            return response.status(400).json({ error: 'Please provide your full name.' });
        }

        if (!tourDate) {
            return response.status(400).json({ error: 'Please select a tour date.' });
        }

        if (!tourTime || tourTime === 'Select Time*') {
            return response.status(400).json({ error: 'Please select a tour time.' });
        }

        if (!phone) {
            return response.status(400).json({ error: 'Please provide your phone number.' });
        }

        if (!EMAIL_REGEX.test(email)) {
            return response.status(400).json({ error: 'Please provide a valid email address.' });
        }

        // Validate tour date is not in the past
        const selectedDate = new Date(tourDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            return response.status(400).json({ error: 'Please select a future date for the tour.' });
        }

        const payload = {
            fullName,
            tourDate,
            tourTime,
            phone,
            email,
            specialRequest,
            ipAddress,
            userAgent
        };

        await storeCampusTourBooking(payload);

        return response.status(201).json({
            success: true,
            message: 'Your campus tour appointment has been booked successfully. The school will contact you to confirm the details.'
        });
    } catch (error) {
        console.error('campus-tour: runtime error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a'
        });

        return response.status(500).json({
            error: 'The campus tour booking is temporarily unavailable. Please try again or contact the school directly.'
        });
    }
}
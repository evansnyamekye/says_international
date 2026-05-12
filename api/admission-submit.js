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

function hasDatabaseConnection() {
    return Boolean(getConnectionString());
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

function getIpAddress(request) {
    const forwarded = request.headers['x-forwarded-for'];

    if (Array.isArray(forwarded)) {
        return normalizeText(forwarded[0], 120);
    }

    return normalizeText(String(forwarded || '').split(',')[0], 120);
}

async function storeAdmission(payload) {
    const db = await getPool();

    await db.query(`
        CREATE TABLE IF NOT EXISTS student_admissions (
            id SERIAL PRIMARY KEY,
            first_name TEXT NOT NULL,
            middle_name TEXT,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await db.query(`
        INSERT INTO student_admissions (first_name, middle_name, last_name, email, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6);
    `, [payload.firstName, payload.middleName, payload.lastName, payload.email, payload.ipAddress, payload.userAgent]);
}

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!hasDatabaseConnection()) {
            console.error('admission-submit: no delivery backend configured');
            return response.status(503).json({
                error: 'The admission form is not connected yet. Configure the site database in Vercel before using this form.'
            });
        }

        const body = parseBody(request.body);
        const firstName = normalizeText(body.firstName, 120);
        const middleName = normalizeText(body.middleName, 120);
        const lastName = normalizeText(body.lastName, 120);
        const email = normalizeText(body.email, 160).toLowerCase();
        const userAgent = normalizeText(request.headers['user-agent'], 500);
        const ipAddress = getIpAddress(request);

        if (!firstName) {
            return response.status(400).json({ error: 'Please provide your first name.' });
        }

        if (!lastName) {
            return response.status(400).json({ error: 'Please provide your last name.' });
        }

        if (!EMAIL_REGEX.test(email)) {
            return response.status(400).json({ error: 'Please provide a valid email address.' });
        }

        const payload = {
            firstName,
            middleName,
            lastName,
            email,
            userAgent,
            ipAddress
        };

        try {
            await storeAdmission(payload);
        } catch (error) {
            console.error('admission-submit: database storage failed', {
                message: error && error.message ? error.message : 'unknown',
                code: error && error.code ? error.code : 'n/a'
            });
            return response.status(500).json({
                error: 'Failed to save your application. Please try again.'
            });
        }

        return response.status(201).json({
            success: true,
            message: 'Your application has been submitted successfully. We will review it and get back to you soon.'
        });
    } catch (error) {
        console.error('admission-submit: runtime error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a'
        });

        return response.status(500).json({
            error: 'The admission form is temporarily unavailable. Please try again.'
        });
    }
}
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

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeSource(value) {
    const source = String(value || 'website').trim();
    return source.slice(0, 120);
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

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!getConnectionString()) {
            console.error('newsletter-subscribe: missing DB connection string env var');
            return response.status(503).json({
                error: 'Newsletter database is not connected yet. In Vercel, connect the Neon database to this project and enable the Production environment, or add DATABASE_URL manually.'
            });
        }

        const body = parseBody(request.body);
        const email = normalizeEmail(body.email);
        const source = normalizeSource(body.source);

        if (!EMAIL_REGEX.test(email)) {
            return response.status(400).json({ error: 'Please provide a valid email address.' });
        }

        const db = await getPool();

        await db.query(`
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                source_page TEXT,
                subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        const existing = await db.query(`
            SELECT id
            FROM newsletter_subscribers
            WHERE email = $1
            LIMIT 1;
        `, [email]);

        if (existing.rowCount > 0) {
            await db.query(`
                UPDATE newsletter_subscribers
                SET source_page = $1, subscribed_at = NOW()
                WHERE email = $2;
            `, [source, email]);

            return response.status(200).json({
                success: true,
                alreadySubscribed: true,
                message: 'This email is already subscribed.'
            });
        }

        await db.query(`
            INSERT INTO newsletter_subscribers (email, source_page)
            VALUES ($1, $2);
        `, [email, source]);

        return response.status(201).json({
            success: true,
            alreadySubscribed: false,
            message: 'Subscription successful.'
        });
    } catch (error) {
        console.error('newsletter-subscribe: runtime error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a'
        });
        return response.status(500).json({
            error: 'Subscription is temporarily unavailable. Please try again.'
        });
    }
}

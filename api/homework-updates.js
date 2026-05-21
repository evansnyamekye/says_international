const PASSWORD = 'domain@SIS'; // Change this to a secure password

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

function validatePassword(provided) {
    return String(provided || '').trim() === PASSWORD;
}

async function loadHomeworkData() {
    if (!hasDatabaseConnection()) {
        return {
            payload: {
                headline: 'Home Homework Update',
                overview: {
                    term: 'Term 1',
                    week: 'Week 1',
                    day: 'Monday',
                    dateLabel: 'January 15, 2024',
                    updatedLabel: 'Updated: January 15, 2024'
                },
                calendar: {
                    title: 'School Calendar PDF',
                    fileLabel: 'Term 1 Calendar 2024',
                    description: 'Download the latest school calendar',
                    href: '/calendar/term1-2024.pdf'
                },
                notes: ['Please ensure homework is completed on time.', 'Contact teachers for any clarifications.'],
                classes: []
            },
            source: 'default',
            updatedAt: new Date().toISOString()
        };
    }

    const db = await getPool();

    try {
        const result = await db.query(`
            SELECT payload, updated_at
            FROM homework_updates
            ORDER BY updated_at DESC
            LIMIT 1
        `);

        if (result.rows.length > 0) {
            return {
                payload: result.rows[0].payload,
                source: 'database',
                updatedAt: result.rows[0].updated_at.toISOString()
            };
        }
    } catch (error) {
        // Table might not exist yet, return default
    }

    return {
        payload: {
            headline: 'Home Homework Update',
            overview: {
                term: 'Term 1',
                week: 'Week 1',
                day: 'Monday',
                dateLabel: 'January 15, 2024',
                updatedLabel: 'Updated: January 15, 2024'
            },
            calendar: {
                title: 'School Calendar PDF',
                fileLabel: 'Term 1 Calendar 2024',
                description: 'Download the latest school calendar',
                href: '/calendar/term1-2024.pdf'
            },
            notes: ['Please ensure homework is completed on time.', 'Contact teachers for any clarifications.'],
            classes: []
        },
        source: 'default',
        updatedAt: new Date().toISOString()
    };
}

async function saveHomeworkData(payload) {
    if (!hasDatabaseConnection()) {
        throw new Error('Database connection not available');
    }

    const db = await getPool();

    await db.query(`
        CREATE TABLE IF NOT EXISTS homework_updates (
            id SERIAL PRIMARY KEY,
            payload JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await db.query(`
        INSERT INTO homework_updates (payload)
        VALUES ($1)
    `, [payload]);

    return { success: true, updatedAt: new Date().toISOString() };
}

export default async function handler(request, response) {
    const method = request.method.toUpperCase();

    if (method === 'GET') {
        try {
            const data = await loadHomeworkData();
            response.status(200).json(data);
        } catch (error) {
            response.status(500).json({
                error: 'Failed to load homework data',
                details: error.message
            });
        }
        return;
    }

    if (method === 'POST') {
        try {
            const body = parseBody(request.body);
            const { password, verifyOnly, payload } = body;

            if (!validatePassword(password)) {
                response.status(401).json({
                    error: 'Invalid password'
                });
                return;
            }

            if (verifyOnly) {
                response.status(200).json({ success: true });
                return;
            }

            if (!payload) {
                response.status(400).json({
                    error: 'Missing payload data'
                });
                return;
            }

            const result = await saveHomeworkData(payload);
            response.status(200).json(result);
        } catch (error) {
            response.status(500).json({
                error: 'Failed to save homework data',
                details: error.message
            });
        }
        return;
    }

    response.status(405).json({
        error: 'Method not allowed'
    });
}
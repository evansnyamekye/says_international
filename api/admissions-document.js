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

function authenticateRequest(url, request) {
    const queryPassword = url ? url.searchParams.get('password') : null;
    const headerPassword = request.headers['x-admin-password'] ||
        (request.headers['authorization'] || '').replace('Bearer ', '');

    return queryPassword === ADMIN_PASSWORD || headerPassword === ADMIN_PASSWORD;
}

function sanitizeFilenamePart(value) {
    const cleaned = String(value || '')
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);

    return cleaned || 'document';
}

function extensionFromUrl(sourceUrl) {
    const match = String(sourceUrl || '').match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
    return match ? match[1] : 'pdf';
}

async function getAdmissionRecord(id) {
    const db = await getPool();

    const result = await db.query(
        'SELECT id, student_name, birth_certificate_url, passport_photo_url, report_card_urls FROM student_admissions WHERE id = $1',
        [id]
    );

    return result.rows[0] || null;
}

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const url = getRequestUrl(request);

    if (!authenticateRequest(url, request)) {
        return response.status(401).json({
            error: 'Unauthorized. Invalid or missing admin password.'
        });
    }

    try {
        if (!getConnectionString()) {
            console.error('admissions-document: missing DB connection string env var');
            return response.status(503).json({
                error: 'Database not connected yet. In Vercel, connect the Neon database to this project.'
            });
        }

        const id = url ? parseInt(url.searchParams.get('id'), 10) : NaN;
        const type = url ? String(url.searchParams.get('type') || '') : '';
        const rawIndex = url ? parseInt(url.searchParams.get('index') || '0', 10) : 0;
        const index = isNaN(rawIndex) ? 0 : rawIndex;

        if (!id || isNaN(id)) {
            return response.status(400).json({ error: 'Invalid admission ID provided.' });
        }

        const record = await getAdmissionRecord(id);
        if (!record) {
            return response.status(404).json({ error: 'Admission not found.' });
        }

        let sourceUrl = null;
        let label = 'Document';

        if (type === 'birth_certificate') {
            sourceUrl = record.birth_certificate_url;
            label = 'Birth_Certificate';
        } else if (type === 'passport_photo') {
            sourceUrl = record.passport_photo_url;
            label = 'Passport_Photo';
        } else if (type === 'report_card') {
            const reportCards = record.report_card_urls || [];
            sourceUrl = reportCards[index] || null;
            label = 'Report_Card_' + (index + 1);
        } else {
            return response.status(400).json({ error: 'Invalid document type requested.' });
        }

        if (!sourceUrl) {
            return response.status(404).json({ error: 'That document was not uploaded for this application.' });
        }

        const blobToken = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
        if (!blobToken) {
            console.error('admissions-document: missing BLOB_READ_WRITE_TOKEN env var');
            return response.status(503).json({ error: 'File storage is not connected yet.' });
        }

        const fileResponse = await fetch(sourceUrl, {
            headers: { Authorization: 'Bearer ' + blobToken }
        });

        if (!fileResponse.ok) {
            console.error('admissions-document: blob fetch failed with status', fileResponse.status);
            return response.status(502).json({ error: 'Failed to retrieve the document from storage.' });
        }

        const buffer = Buffer.from(await fileResponse.arrayBuffer());
        const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
        const filename = sanitizeFilenamePart(record.student_name) + '_' + label + '.' + extensionFromUrl(sourceUrl);

        response.setHeader('Content-Type', contentType);
        response.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
        return response.status(200).send(buffer);
    } catch (error) {
        console.error('admissions-document: runtime error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a'
        });

        return response.status(500).json({
            error: 'Failed to load the requested document.'
        });
    }
}

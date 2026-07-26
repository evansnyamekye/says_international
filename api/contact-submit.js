const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_URL = 'https://api.resend.com/emails';

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

function hasResendConfiguration() {
    return Boolean(String(process.env.RESEND_API_KEY || '').trim());
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

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getNotificationSettings() {
    return {
        apiKey: String(process.env.RESEND_API_KEY || '').trim(),
        to: normalizeText(process.env.CONTACT_NOTIFY_TO || 'info@saysinternationalschool.com', 160),
        from: normalizeText(process.env.CONTACT_NOTIFY_FROM || 'Says International School <onboarding@resend.dev>', 160),
        replyTo: normalizeText(process.env.CONTACT_REPLY_TO || '', 160)
    };
}

async function storeMessage(payload) {
    const db = await getPool();

    await db.query(`
        CREATE TABLE IF NOT EXISTS contact_messages (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            source_page TEXT,
            ip_address TEXT,
            user_agent TEXT,
            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await db.query(`
        INSERT INTO contact_messages (name, email, message, source_page, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6);
    `, [payload.name, payload.email, payload.message, payload.source, payload.ipAddress, payload.userAgent]);
}

async function sendNotificationEmail(payload) {
    const settings = getNotificationSettings();

    const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + settings.apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: settings.from,
            to: [settings.to],
            reply_to: settings.replyTo || payload.email,
            subject: 'New contact form message from ' + payload.name,
            text: [
                'A new contact form message was submitted.',
                '',
                'Name: ' + payload.name,
                'Email: ' + payload.email,
                'Source: ' + payload.source,
                'IP Address: ' + (payload.ipAddress || 'Unavailable'),
                '',
                'Message:',
                payload.message
            ].join('\n'),
            html: [
                '<h2>New contact form message</h2>',
                '<p><strong>Name:</strong> ' + escapeHtml(payload.name) + '</p>',
                '<p><strong>Email:</strong> ' + escapeHtml(payload.email) + '</p>',
                '<p><strong>Source:</strong> ' + escapeHtml(payload.source) + '</p>',
                '<p><strong>IP Address:</strong> ' + escapeHtml(payload.ipAddress || 'Unavailable') + '</p>',
                '<p><strong>Message:</strong></p>',
                '<p>' + escapeHtml(payload.message).replace(/\n/g, '<br>') + '</p>'
            ].join('')
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Resend request failed with status ' + response.status + ': ' + errorText);
    }
}

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');

    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!hasResendConfiguration() && !hasDatabaseConnection()) {
            console.error('contact-submit: no delivery backend configured');
            return response.status(503).json({
                error: 'The contact form is not connected yet. Configure the site database, a Resend API key, or both in Vercel before using this form.'
            });
        }

        const body = parseBody(request.body);
        const name = normalizeText(body.name, 120);
        const email = normalizeText(body.email, 160).toLowerCase();
        const message = normalizeText(body.message, 5000);
        const source = normalizeText(body.source || 'contact.html', 120);
        const userAgent = normalizeText(request.headers['user-agent'], 500);
        const ipAddress = getIpAddress(request);

        if (!name) {
            return response.status(400).json({ error: 'Please provide your name.' });
        }

        if (!EMAIL_REGEX.test(email)) {
            return response.status(400).json({ error: 'Please provide a valid email address.' });
        }

        if (!message) {
            return response.status(400).json({ error: 'Please enter your message.' });
        }

        const payload = {
            name,
            email,
            message,
            source,
            userAgent,
            ipAddress
        };

        const delivery = {
            storedInDatabase: false,
            emailed: false
        };

        if (hasDatabaseConnection()) {
            try {
                await storeMessage(payload);
                delivery.storedInDatabase = true;
            } catch (error) {
                console.error('contact-submit: database delivery failed', {
                    message: error && error.message ? error.message : 'unknown',
                    code: error && error.code ? error.code : 'n/a'
                });
            }
        }

        if (hasResendConfiguration()) {
            try {
                await sendNotificationEmail(payload);
                delivery.emailed = true;
            } catch (error) {
                console.error('contact-submit: email delivery failed', {
                    message: error && error.message ? error.message : 'unknown',
                    code: error && error.code ? error.code : 'n/a'
                });
            }
        }

        if (!delivery.storedInDatabase && !delivery.emailed) {
            return response.status(500).json({
                error: 'The contact form is temporarily unavailable. Please try again.'
            });
        }

        return response.status(201).json({
            success: true,
            emailed: delivery.emailed,
            storedInDatabase: delivery.storedInDatabase,
            message: delivery.emailed
                ? 'Your message has been sent. The school will get back to you soon.'
                : 'Your message has been received successfully.'
        });
    } catch (error) {
        console.error('contact-submit: runtime error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a'
        });

        return response.status(500).json({
            error: 'The contact form is temporarily unavailable. Please try again.'
        });
    }
}
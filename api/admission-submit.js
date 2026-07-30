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
            return createPool({ connectionString: getConnectionString() });
        });
    }
    return poolPromise;
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function pickArray(value) {
    if (!value) return null;
    if (Array.isArray(value)) return value.filter(Boolean);
    return [String(value)];
}

async function sendAdmissionEmail(fields, attachmentSummary) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) return false;

    const to = String(process.env.APPLICATION_NOTIFY_TO || 'info@saysinternationalschool.com').trim();
    const from = String(process.env.APPLICATION_NOTIFY_FROM || 'Says International School <onboarding@resend.dev>').trim();
    const replyTo = String(process.env.APPLICATION_REPLY_TO || fields.email || '').trim();

    const rows = [
        ['Student', fields.student_name],
        ['Gender', fields.gender],
        ['Religion', fields.religion],
        ['Nationality', fields.nationality],
        ['Grade applying for', fields.grade],
        ['Day or boarding', fields.enrollment_type],
        ['Parent / guardian', fields.parent_name],
        ['Email', fields.email],
        ['Mobile', fields.mobile_phone],
        ['Home phone', fields.home_phone],
        ['Previously applied', (fields.previouslyApplied || '') + (fields.previous_year ? ' (' + fields.previous_year + ')' : '')],
        ['Vision issues', fields.vision],
        ['Hearing issues', fields.hearing],
        ['Speech / language issues', fields.speech],
        ['Development delays', fields.development_delays],
        ['Allergies', fields.allergies],
        ['Communicable disease', fields.communicable_disease],
        ['Emergency-care condition', fields.emergency_care],
        ['Heart condition', fields.heart_condition],
        ['Medical notes', fields.medical_notes],
        ['Preferred hospital', fields.preferred_hospital],
        ['Insurance', fields.insurance],
        ['Serious condition details', fields.condition_details],
        ['Emergency contact', (fields.relative_name || '') + (fields.relative_tel ? ' — ' + fields.relative_tel : '')],
        ['Documents uploaded', attachmentSummary || 'None'],
    ];

    const text = rows.map(function (r) { return r[0] + ': ' + (r[1] || '—'); }).join('\n');
    const html = '<h2>New admission application</h2>' +
        '<table style="border-collapse:collapse">' +
        rows.map(function (r) {
            return '<tr><td style="padding:4px 12px 4px 0;vertical-align:top"><strong>' +
                escapeHtml(r[0]) + '</strong></td><td style="padding:4px 0">' +
                escapeHtml(r[1] || '—') + '</td></tr>';
        }).join('') +
        '</table>';

    const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: from,
            to: [to],
            reply_to: replyTo || undefined,
            subject: 'New admission application: ' + (fields.student_name || 'Unknown student'),
            text: text,
            html: html,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Resend request failed with status ' + response.status + ': ' + errorText);
    }

    return true;
}

async function storeAdmission(fields, urls, req) {
    const db = await getPool();

    await db.query(
        'INSERT INTO student_admissions (' +
            'student_name, gender, religion, nationality, parent_name, email,' +
            'mobile_phone, home_phone, grade, enrollment_type, previously_applied, previous_year,' +
            'vision, hearing, speech, development_delays, allergies,' +
            'communicable_disease, emergency_care, heart_condition, medical_notes,' +
            'relative_name, relative_tel, preferred_hospital, insurance, condition_details,' +
            'birth_certificate_url, passport_photo_url, report_card_urls,' +
            'ip_address, user_agent' +
        ') VALUES (' +
            '$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31' +
        ')',
        [
            fields.student_name,
            fields.gender,
            fields.religion,
            fields.nationality,
            fields.parent_name,
            fields.email,
            fields.mobile_phone,
            fields.home_phone,
            fields.grade,
            fields.enrollment_type,
            fields.previouslyApplied,
            fields.previous_year,
            fields.vision,
            fields.hearing,
            fields.speech,
            fields.development_delays,
            fields.allergies,
            fields.communicable_disease,
            fields.emergency_care,
            fields.heart_condition,
            fields.medical_notes,
            fields.relative_name,
            fields.relative_tel,
            fields.preferred_hospital,
            fields.insurance,
            fields.condition_details,
            urls.birthCertUrl,
            urls.passportUrl,
            urls.reportCardUrls,
            req.headers['x-forwarded-for'] || null,
            req.headers['user-agent'] || null,
        ]
    );
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const fields = req.body && typeof req.body === 'object' ? req.body : {};

        if (!fields.student_name) {
            return res.status(400).json({ error: 'Student name is required' });
        }

        if (!fields.email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const birthCertUrl = fields.birth_certificate_url || null;
        const passportUrl = fields.passport_photo_url || null;
        const reportCardUrls = pickArray(fields.report_card_urls);

        await storeAdmission(fields, { birthCertUrl: birthCertUrl, passportUrl: passportUrl, reportCardUrls: reportCardUrls }, req);

        const attachmentSummary = [
            birthCertUrl && 'birth certificate',
            passportUrl && 'passport photo',
            reportCardUrls && reportCardUrls.length && (reportCardUrls.length + ' report card' + (reportCardUrls.length > 1 ? 's' : '')),
        ].filter(Boolean).join(', ');

        let emailed = false;
        try {
            emailed = await sendAdmissionEmail(fields, attachmentSummary);
        } catch (emailError) {
            console.error('admission-submit: email delivery failed:', emailError && emailError.message);
        }

        return res.status(201).json({
            success: true,
            emailed: emailed,
            message: 'Application saved successfully',
        });
    } catch (error) {
        const message = error && error.message ? error.message : 'unknown';
        const code = error && error.code ? error.code : 'n/a';
        console.error('admission-submit: runtime error', { message: message, code: code });
        return res.status(500).json({
            error: 'Failed to save application',
            debug: { message: message, code: code },
        });
    }
}

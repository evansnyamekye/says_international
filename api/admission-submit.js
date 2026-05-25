const RESEND_API_URL = 'https://api.resend.com/emails';

export const config = {
    api: {
        bodyParser: false,
    },
};

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

function parseForm(req) {
    return new Promise(function (resolve, reject) {
        import('formidable').then(function (mod) {
            const formidable = mod.default || mod;
            const form = formidable({ multiples: true, keepExtensions: true });
            form.parse(req, function (err, fields, files) {
                if (err) return reject(err);
                const flatFields = {};
                for (const key of Object.keys(fields)) {
                    const value = fields[key];
                    flatFields[key] = Array.isArray(value) ? value[0] : value;
                }
                resolve({ fields: flatFields, files: files });
            });
        }).catch(reject);
    });
}

async function uploadOne(file, prefix) {
    const fs = await import('node:fs/promises');
    const blobMod = await import('@vercel/blob');
    const buffer = await fs.readFile(file.filepath);
    const blob = await blobMod.put(
        'admissions/' + prefix + '/' + Date.now() + '-' + file.originalFilename,
        buffer,
        { access: 'public', contentType: file.mimetype || undefined }
    );
    return blob.url;
}

async function uploadField(files, key, prefix) {
    const entry = files[key];
    if (!entry) return null;
    const list = Array.isArray(entry) ? entry : [entry];
    const urls = await Promise.all(list.map(function (f) { return uploadOne(f, prefix); }));
    return urls;
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
            'mobile_phone, home_phone, grade, previously_applied, previous_year,' +
            'vision, hearing, speech, development_delays, allergies,' +
            'communicable_disease, emergency_care, heart_condition, medical_notes,' +
            'relative_name, relative_tel, preferred_hospital, insurance, condition_details,' +
            'birth_certificate_url, passport_photo_url, report_card_urls,' +
            'ip_address, user_agent' +
        ') VALUES (' +
            '$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30' +
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
        const parsed = await parseForm(req);
        const fields = parsed.fields;
        const files = parsed.files;

        if (!fields.student_name) {
            return res.status(400).json({ error: 'Student name is required' });
        }

        if (!fields.email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const uploads = await Promise.all([
            uploadField(files, 'birth_certificate', 'birth-certificates'),
            uploadField(files, 'passport_photo', 'passport-photos'),
            uploadField(files, 'report_cards', 'report-cards'),
        ]);

        const birthCertUrls = uploads[0];
        const passportUrls = uploads[1];
        const reportCardUrls = uploads[2];

        const birthCertUrl = (birthCertUrls && birthCertUrls[0]) || null;
        const passportUrl = (passportUrls && passportUrls[0]) || null;

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
        console.error('admission-submit: runtime error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a',
        });
        return res.status(500).json({ error: 'Failed to save application' });
    }
}

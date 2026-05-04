import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_URL = 'https://api.resend.com/emails';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PASSPORT_PHOTO_SIZE = 2 * 1024 * 1024;
const MAX_REPORT_CARDS = 5;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export const config = {
    api: {
        bodyParser: false
    }
};

function hasResendConfiguration() {
    return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

function normalizeText(value, maxLength) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function normalizeFieldValue(value, maxLength) {
    const rawValue = Array.isArray(value) ? value[0] : value;
    return normalizeText(rawValue, maxLength);
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
        to: normalizeText(process.env.APPLICATION_NOTIFY_TO || 'saysinterschool@gmail.com', 160),
        from: normalizeText(process.env.APPLICATION_NOTIFY_FROM || 'Says International School <onboarding@resend.dev>', 160),
        replyTo: normalizeText(process.env.APPLICATION_REPLY_TO || '', 160)
    };
}

async function createFormParser() {
    const formidableModule = await import('formidable');
    const formidableFactory = formidableModule.formidable || formidableModule.default || formidableModule;

    return formidableFactory({
        multiples: true,
        keepExtensions: true,
        maxFiles: 7,
        maxFileSize: MAX_FILE_SIZE,
        allowEmptyFiles: false
    });
}

async function parseMultipartForm(request) {
    const form = await createFormParser();

    return new Promise(function (resolve, reject) {
        form.parse(request, function (error, fields, files) {
            if (error) {
                reject(error);
                return;
            }

            resolve({ fields, files });
        });
    });
}

function getFiles(input) {
    if (!input) {
        return [];
    }

    return Array.isArray(input) ? input.filter(Boolean) : [input];
}

function assertAllowedFile(file, label, maxSize) {
    const fileName = normalizeText(file.originalFilename || label, 160);
    const extension = path.extname(fileName).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new Error(label + ' must be a PDF, JPG, JPEG, or PNG file.');
    }

    if (!file.size || file.size > maxSize) {
        throw new Error(label + ' exceeds the allowed upload size.');
    }

    return fileName;
}

async function fileToAttachment(file, label, maxSize) {
    const fileName = assertAllowedFile(file, label, maxSize);
    const fileBuffer = await readFile(file.filepath);

    return {
        filename: fileName,
        content: fileBuffer.toString('base64')
    };
}

async function buildAttachments(files) {
    const birthCertificateFiles = getFiles(files.birth_certificate);
    const passportPhotoFiles = getFiles(files.passport_photo);
    const reportCardFiles = getFiles(files.report_cards);

    if (!birthCertificateFiles.length) {
        throw new Error('Birth certificate is required.');
    }

    if (!passportPhotoFiles.length) {
        throw new Error('Passport photo is required.');
    }

    if (reportCardFiles.length > MAX_REPORT_CARDS) {
        throw new Error('Please upload no more than 5 report card files.');
    }

    const attachments = [];
    attachments.push(await fileToAttachment(birthCertificateFiles[0], 'Birth certificate', MAX_FILE_SIZE));
    attachments.push(await fileToAttachment(passportPhotoFiles[0], 'Passport photo', MAX_PASSPORT_PHOTO_SIZE));

    for (const reportCardFile of reportCardFiles) {
        attachments.push(await fileToAttachment(reportCardFile, 'Report card', MAX_FILE_SIZE));
    }

    return attachments;
}

function buildApplicationPayload(fields) {
    const payload = {
        studentName: normalizeFieldValue(fields.student_name, 160),
        gender: normalizeFieldValue(fields.gender, 60),
        religion: normalizeFieldValue(fields.religion, 80),
        nationality: normalizeFieldValue(fields.nationality, 120),
        parentName: normalizeFieldValue(fields.parent_name, 160),
        email: normalizeFieldValue(fields.email, 160).toLowerCase(),
        mobilePhone: normalizeFieldValue(fields.mobile_phone, 60),
        homePhone: normalizeFieldValue(fields.home_phone, 60),
        grade: normalizeFieldValue(fields.grade, 80),
        previouslyApplied: normalizeFieldValue(fields.previouslyApplied, 20),
        previousYear: normalizeFieldValue(fields.previous_year, 40),
        vision: normalizeFieldValue(fields.vision, 20),
        hearing: normalizeFieldValue(fields.hearing, 20),
        speech: normalizeFieldValue(fields.speech, 20),
        delays: normalizeFieldValue(fields.delays, 20),
        allergies: normalizeFieldValue(fields.allergies, 20),
        communicableDisease: normalizeFieldValue(fields.communicable_disease, 20),
        emergencyCare: normalizeFieldValue(fields.emergency_care, 20),
        heartCondition: normalizeFieldValue(fields.heart_condition, 20),
        specifyCondition: normalizeFieldValue(fields.specify_condition, 20),
        conditionDetails: normalizeFieldValue(fields.condition_details, 2000),
        preferredHospital: normalizeFieldValue(fields.preferred_hospital, 160),
        insurance: normalizeFieldValue(fields.insurance, 160),
        medicalNotes: normalizeFieldValue(fields.medical_notes, 2500),
        relativeName: normalizeFieldValue(fields.relative_name, 160),
        relativeTel: normalizeFieldValue(fields.relative_tel, 60),
        source: normalizeFieldValue(fields.source, 120) || 'application.html'
    };

    if (!payload.studentName) {
        throw new Error('Student name is required.');
    }

    if (!payload.parentName) {
        throw new Error('Parent or guardian name is required.');
    }

    if (!EMAIL_REGEX.test(payload.email)) {
        throw new Error('Please provide a valid email address.');
    }

    if (!payload.mobilePhone) {
        throw new Error('Mobile phone number is required.');
    }

    if (!payload.grade) {
        throw new Error('Please select the grade being applied for.');
    }

    if (!payload.relativeName || !payload.relativeTel) {
        throw new Error('Emergency contact name and telephone number are required.');
    }

    if (payload.previouslyApplied === 'Yes' && !payload.previousYear) {
        throw new Error('Please provide the previous application or attendance year.');
    }

    if (payload.specifyCondition === 'Yes' && !payload.conditionDetails) {
        throw new Error('Please provide details for the serious condition section.');
    }

    return payload;
}

function buildTextBody(payload, attachmentCount) {
    return [
        'A new admission application was submitted from the school website.',
        '',
        'Student name: ' + payload.studentName,
        'Gender: ' + payload.gender,
        'Religion/Faith of birth: ' + payload.religion,
        'Nationality: ' + payload.nationality,
        'Applying for grade: ' + payload.grade,
        'Previously applied/attended: ' + payload.previouslyApplied,
        'Previous year: ' + (payload.previousYear || 'Not provided'),
        '',
        'Parent/Guardian name: ' + payload.parentName,
        'Parent email: ' + payload.email,
        'Mobile phone: ' + payload.mobilePhone,
        'Home phone: ' + (payload.homePhone || 'Not provided'),
        '',
        'Medical information',
        'Vision: ' + (payload.vision || 'No'),
        'Hearing: ' + (payload.hearing || 'No'),
        'Speech or Language: ' + (payload.speech || 'No'),
        'Development Delays: ' + (payload.delays || 'No'),
        'Allergies: ' + (payload.allergies || 'No'),
        'Communicable disease: ' + (payload.communicableDisease || 'No'),
        'Emergency care needed: ' + (payload.emergencyCare || 'No'),
        'Heart condition limiting exercise: ' + (payload.heartCondition || 'No'),
        'Serious condition specified: ' + (payload.specifyCondition || 'No'),
        'Condition details: ' + (payload.conditionDetails || 'Not provided'),
        'Preferred hospital: ' + (payload.preferredHospital || 'Not provided'),
        'Insurance/Health coverage: ' + (payload.insurance || 'Not provided'),
        'Medical notes: ' + (payload.medicalNotes || 'Not provided'),
        '',
        'Emergency contact name: ' + payload.relativeName,
        'Emergency contact telephone: ' + payload.relativeTel,
        '',
        'Source page: ' + payload.source,
        'Attachments included: ' + String(attachmentCount)
    ].join('\n');
}

function buildHtmlBody(payload, attachmentCount) {
    const rows = [
        ['Student name', payload.studentName],
        ['Gender', payload.gender],
        ['Religion/Faith of birth', payload.religion],
        ['Nationality', payload.nationality],
        ['Applying for grade', payload.grade],
        ['Previously applied/attended', payload.previouslyApplied],
        ['Previous year', payload.previousYear || 'Not provided'],
        ['Parent/Guardian name', payload.parentName],
        ['Parent email', payload.email],
        ['Mobile phone', payload.mobilePhone],
        ['Home phone', payload.homePhone || 'Not provided'],
        ['Vision', payload.vision || 'No'],
        ['Hearing', payload.hearing || 'No'],
        ['Speech or Language', payload.speech || 'No'],
        ['Development Delays', payload.delays || 'No'],
        ['Allergies', payload.allergies || 'No'],
        ['Communicable disease', payload.communicableDisease || 'No'],
        ['Emergency care needed', payload.emergencyCare || 'No'],
        ['Heart condition limiting exercise', payload.heartCondition || 'No'],
        ['Serious condition specified', payload.specifyCondition || 'No'],
        ['Condition details', payload.conditionDetails || 'Not provided'],
        ['Preferred hospital', payload.preferredHospital || 'Not provided'],
        ['Insurance/Health coverage', payload.insurance || 'Not provided'],
        ['Medical notes', payload.medicalNotes || 'Not provided'],
        ['Emergency contact name', payload.relativeName],
        ['Emergency contact telephone', payload.relativeTel],
        ['Source page', payload.source],
        ['Attachments included', String(attachmentCount)]
    ];

    return [
        '<h2>New admission application</h2>',
        '<p>A parent or guardian submitted a new application through the school website.</p>',
        '<table cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%;">',
        rows.map(function (row) {
            return '<tr><th align="left" style="background:#f4f7fb;">' + escapeHtml(row[0]) + '</th><td>' + escapeHtml(row[1]) + '</td></tr>';
        }).join(''),
        '</table>'
    ].join('');
}

async function sendNotificationEmail(payload, attachments) {
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
            subject: 'New application: ' + payload.studentName + ' (' + payload.grade + ')',
            text: buildTextBody(payload, attachments.length),
            html: buildHtmlBody(payload, attachments.length),
            attachments
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
        if (!hasResendConfiguration()) {
            return response.status(503).json({
                error: 'The application form email is not connected yet. Add RESEND_API_KEY and optionally APPLICATION_NOTIFY_TO, APPLICATION_NOTIFY_FROM, and APPLICATION_REPLY_TO in Vercel.'
            });
        }

        const { fields, files } = await parseMultipartForm(request);
        const payload = buildApplicationPayload(fields);
        const attachments = await buildAttachments(files);

        await sendNotificationEmail(payload, attachments);

        return response.status(200).json({
            success: true,
            message: 'Application submitted successfully.'
        });
    } catch (error) {
        console.error('application-submit: runtime error', {
            message: error && error.message ? error.message : 'unknown',
            code: error && error.code ? error.code : 'n/a'
        });

        return response.status(500).json({
            error: error && error.message ? error.message : 'Application submission is temporarily unavailable. Please try again.'
        });
    }
}
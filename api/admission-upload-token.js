function readJsonBody(req) {
    return new Promise(function (resolve, reject) {
        const chunks = [];
        req.on('data', function (chunk) { chunks.push(chunk); });
        req.on('end', function () {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

export const config = {
    api: { bodyParser: false },
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = await readJsonBody(req);
        const mod = await import('@vercel/blob/client');
        const handleUpload = mod.handleUpload;

        const jsonResponse = await handleUpload({
            body: body,
            request: req,
            onBeforeGenerateToken: async function (pathname) {
                if (!pathname.startsWith('admissions/')) {
                    throw new Error('Invalid upload path');
                }
                return {
                    allowedContentTypes: [
                        'image/jpeg',
                        'image/png',
                        'image/jpg',
                        'application/pdf',
                    ],
                    maximumSizeInBytes: 15 * 1024 * 1024,
                    addRandomSuffix: true,
                    tokenPayload: '',
                };
            },
            onUploadCompleted: async function () {
                return;
            },
        });

        return res.status(200).json(jsonResponse);
    } catch (error) {
        const message = error && error.message ? error.message : 'Upload token failed';
        console.error('admission-upload-token: error', { message: message });
        return res.status(400).json({ error: message });
    }
}

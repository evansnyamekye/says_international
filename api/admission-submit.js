export default async function handler(request, response) {

    // Prevent caching
    response.setHeader('Cache-Control', 'no-store');

    // Allow only POST requests
    if (request.method !== 'POST') {

        response.setHeader('Allow', 'POST');

        return response.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {

        // Receive frontend data
        const body = request.body;

        // Log received data in Vercel logs
        console.log('Received application:', body);

        // Temporary success response
        // (Testing stage only)
        return response.status(200).json({
            success: true,
            message: 'Application received successfully'
        });

    } catch (error) {

        console.error('admission-submit error:', error);

        return response.status(500).json({
            error: 'Server error'
        });
    }
}
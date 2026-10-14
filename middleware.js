export const config = {
    matcher: '/:path*',
};

const PRIMARY_HOST = 'saysinternationalschool.com';

export default function middleware(request) {
    const url = new URL(request.url);

    if (url.hostname !== PRIMARY_HOST && url.hostname.endsWith('.vercel.app')) {
        url.hostname = PRIMARY_HOST;
        url.protocol = 'https:';
        url.port = '';
        return Response.redirect(url.toString(), 308);
    }
}

## SAYS International School

Static school website built from HTML, CSS, JavaScript, and vendor assets.

## Deploy To Vercel

This repository can be deployed to Vercel as a static site.

### Deploy commands

```bash
npm run vercel:preview
npm run vercel:prod
```

### Important limitation

Some pages still submit forms to PHP handlers, including `plugins/quform/process.php` and `contact.php`. Vercel will host the static site, but those PHP endpoints will not execute there.

Pages affected include the contact and enquiry flows. To make those forms work on Vercel, replace the PHP handlers with one of these options:

1. Vercel Functions
2. A third-party form service
3. An external backend hosted somewhere that supports PHP

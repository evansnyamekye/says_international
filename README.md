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

## Application Form Email Setup

The online application form now submits through the Vercel function `api/application-submit.js`.

### Required Vercel environment variables

Set these in the Vercel project before testing the admissions form:

```bash
RESEND_API_KEY=your_resend_api_key
APPLICATION_NOTIFY_TO=saysinterschool@gmail.com
APPLICATION_NOTIFY_FROM=Says International School <your-verified-sender@yourdomain.com>
APPLICATION_REPLY_TO=saysinterschool@gmail.com
```

### Notes

- `APPLICATION_NOTIFY_TO` is the inbox that receives completed application emails and attached documents.
- `APPLICATION_NOTIFY_FROM` must be a sender address verified in Resend. Gmail can receive the message, but it should not be used as the sending address unless it is verified through your mail provider and Resend setup.
- If `APPLICATION_NOTIFY_TO` is not set, the code already falls back to `saysinterschool@gmail.com`.
- Parents can reply directly to the submission email because the backend uses the parent email as the reply-to when no fixed reply address is set.

### Recommended production test

1. Deploy to Vercel.
2. Submit one sample application with a birth certificate and passport photo.
3. Confirm the email arrives in `saysinterschool@gmail.com` with all form details and attachments.
4. Open the attachments from the email and confirm they are printable.

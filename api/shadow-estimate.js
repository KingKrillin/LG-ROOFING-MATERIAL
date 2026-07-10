// Vercel serverless function — the site's first backend code.
// Sends a shadow copy of every estimate submission directly to a personal
// inbox via Resend, independent of Formspree (which still handles the real,
// business-facing submission — this is a redundant diagnostic/backup
// channel only, per instruction).
//
// Requires one Vercel environment variable (set in the Vercel project
// dashboard, never committed to the repo):
//   RESEND_API_KEY  - from resend.com, after signing up (email + password,
//                     no domain setup required — sending from the shared
//                     onboarding@resend.dev address works immediately).

const { Resend } = require('resend');

const SHADOW_TO = 'christpher.business.acc.2026@gmail.com';
const SHADOW_FROM = 'LG Estimate <onboarding@resend.dev>';
const MAX_FIELD_LENGTH = 5000;

function sanitizeField(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, MAX_FIELD_LENGTH);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot: a hidden field real users never fill in. Bots that blindly
  // fill every field trip this and get silently dropped (reported as ok so
  // they don't learn anything from the response).
  if (sanitizeField(body._gotcha)) {
    return res.status(200).json({ ok: true });
  }

  const name = sanitizeField(body.name);
  const phone = sanitizeField(body.phone);
  const email = sanitizeField(body.email);
  const address = sanitizeField(body.address);
  const notes = sanitizeField(body.notes);
  const fulfillment = sanitizeField(body.fulfillment);
  const estimateTotal = sanitizeField(body.estimate_total);
  const estimateBreakdown = sanitizeField(body.estimate_breakdown);

  if (!name || !phone || !email) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('Shadow email not configured: missing RESEND_API_KEY env var');
    return res.status(500).json({ ok: false, error: 'Email not configured' });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: SHADOW_FROM,
      to: [SHADOW_TO],
      reply_to: email,
      subject: 'New Estimate Request — LG Roofing Materials [SHADOW COPY]',
      text: [
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
        `Address: ${address}`,
        `Notes: ${notes}`,
        `Fulfillment: ${fulfillment}`,
        `Estimate Total: ${estimateTotal}`,
        '',
        '--- Breakdown ---',
        estimateBreakdown,
      ].join('\n'),
    });

    if (error) {
      console.error('Shadow email send failed:', error);
      return res.status(500).json({ ok: false, error: 'Send failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Shadow email send failed:', err);
    return res.status(500).json({ ok: false, error: 'Send failed' });
  }
};

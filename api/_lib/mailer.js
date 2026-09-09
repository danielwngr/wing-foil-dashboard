import nodemailer from 'nodemailer';

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export function hasMailerConfig() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendEmail({ to, subject, html, text }) {
  await getTransporter().sendMail({
    from: `Launch Conditions <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

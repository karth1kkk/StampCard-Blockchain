import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  REWARD_EMAIL_FROM,
} = process.env;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, wallet } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    console.warn('SMTP configuration missing. Skipping reward email send.');
    return res.status(202).json({
      delivered: false,
      reason: 'smtp-not-configured',
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });

    const subject = 'Your BrewToken free drink is ready!';
    const text = [
      'Congratulations!',
      '',
      'You have earned a free drink with the BrewToken loyalty programme.',
      'Visit the BrewToken coffee bar and let the merchant know your wallet address to redeem it.',
      wallet ? `Wallet on record: ${wallet}` : '',
      '',
      'Enjoy your reward ☕',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <h2 style="font-family: sans-serif; color: #0f172a;">Congratulations!</h2>
      <p style="font-family: sans-serif; color: #334155;">
        You have earned a <strong>free drink</strong> with the BrewToken loyalty programme.
      </p>
      <p style="font-family: sans-serif; color: #334155;">
        Visit the BrewToken coffee bar and let the merchant know your wallet address to redeem it.
      </p>
      ${
        wallet
          ? `<p style="font-family: sans-serif; color: #475569; font-size: 12px;">Wallet on record: <code>${wallet}</code></p>`
          : ''
      }
      <p style="font-family: sans-serif; color: #334155;">Enjoy your reward ☕</p>
    `;

    const info = await transporter.sendMail({
      from: REWARD_EMAIL_FROM || SMTP_USER,
      to: email,
      subject,
      text,
      html,
    });

    return res.status(200).json({
      delivered: true,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Reward email send failed:', error);
    return res.status(500).json({ error: error?.message || 'Unable to send reward email' });
  }
}



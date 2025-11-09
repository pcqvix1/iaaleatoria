
import { sql } from '@vercel/postgres';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// It's highly recommended to store the Client ID in an environment variable
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "413829830677-q5inimb5f2pj7iu95mkege78hrkt80vo.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'O token do Google não foi fornecido.' });
    }

    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.name) {
      return res.status(401).json({ message: 'Token do Google inválido.' });
    }

    const { email, name } = payload;

    const { rows: existingUsers } = await sql`SELECT * FROM users WHERE email = ${email};`;

    if (existingUsers.length > 0) {
      // User exists, log them in
      const user = existingUsers[0];
      const userToReturn = { id: user.id, name: user.name, email: user.email };
      return res.status(200).json(userToReturn);
    } else {
      // User doesn't exist, create a new one
      // Generate a secure, random password for the new user, as one is not provided by Google OAuth
      const randomPassword = randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const { rows: newUsers } = await sql`
        INSERT INTO users (name, email, password)
        VALUES (${name}, ${email}, ${hashedPassword})
        RETURNING id, name, email;
      `;
      const newUser = newUsers[0];
      return res.status(201).json(newUser);
    }
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({ message: 'Ocorreu um erro no servidor durante o login com o Google.' });
  }
}
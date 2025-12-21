
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
    }

    let user;

    // Check if user already exists
    const { rows: existingUsers } = await sql`
      SELECT id, name, email, password 
      FROM users 
      WHERE email = ${email};
    `;

    if (existingUsers.length > 0) {
      user = existingUsers[0];
    } else {
      // Create new user
      const { rows: newUsers } = await sql`
        INSERT INTO users (name, email, password)
        VALUES (${name}, ${email}, '')
        RETURNING id, name, email, password;
      `;
      user = newUsers[0];
    }
    
    const userToReturn = {
      id: user.id,
      name: user.name,
      email: user.email,
      hasPassword: !!user.password,
    };

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ user: userToReturn, token });

  } catch (error) {
    console.error('Google Login error:', error);
    return res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
  }
}

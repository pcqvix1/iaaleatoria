
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const { rows: existingUsers } = await sql`SELECT * FROM users WHERE email = ${email};`;
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING id, name, email;
    `;
    
    const newUser = rows[0];

    return res.status(201).json(newUser);

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
  }
}

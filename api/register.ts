
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

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

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
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
    
    const user = rows[0];
    const newUser = {
      ...user,
      hasPassword: true,
    };

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({ user: newUser, token });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
  }
}

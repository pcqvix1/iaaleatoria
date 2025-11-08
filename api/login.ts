
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const { rows } = await sql`SELECT * FROM users WHERE email = ${email};`;
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    const userToReturn = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return res.status(200).json(userToReturn);

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
  }
}

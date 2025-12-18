
import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { allowCors } from './cors';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
    }

    const { rows: existingUsers } = await sql`
      SELECT id, name, email, password 
      FROM users 
      WHERE email = ${email};
    `;

    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      return res.status(200).json({
        id: user.id,
        name: user.name,
        email: user.email,
        hasPassword: !!user.password,
      });
    }
    
    const { rows: newUsers } = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, '')
      RETURNING id, name, email;
    `;
    
    const newUser = {
      ...newUsers[0],
      hasPassword: false,
    };
    return res.status(201).json(newUser);

  } catch (error) {
    console.error('Google Login error:', error);
    return res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
  }
}

export default allowCors(handler);

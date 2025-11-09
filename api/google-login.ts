
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
    }

    // Check if user already exists
    const { rows: existingUsers } = await sql`SELECT * FROM users WHERE email = ${email};`;

    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      const userToReturn = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      return res.status(200).json(userToReturn);
    }
    
    // If user does not exist, create a new one
    // Create a secure, random password placeholder as it's required by the schema
    const placeholderPassword = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const hashedPassword = await bcrypt.hash(placeholderPassword, 10);

    const { rows: newUsers } = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING id, name, email;
    `;
    
    const newUser = newUsers[0];
    return res.status(201).json(newUser);

  } catch (error) {
    console.error('Google Login error:', error);
    return res.status(500).json({ message: 'Ocorreu um erro no servidor.' });
  }
}
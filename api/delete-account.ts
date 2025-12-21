
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  
  // Authentication Middleware
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Não autorizado.' });
  }
  const token = authHeader.split(' ')[1];
  let userIdFromToken: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    userIdFromToken = decoded.userId;
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido.' });
  }

  try {
    // Exclua as conversas primeiro
    await sql`DELETE FROM conversations WHERE user_id = ${userIdFromToken};`;
    
    // Em seguida, exclua o usuário
    await sql`DELETE FROM users WHERE id = ${userIdFromToken};`;

    return res.status(204).end();

  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

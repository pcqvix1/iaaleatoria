
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Authentication Middleware Logic
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Não autorizado. Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  let userId: number;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    userId = decoded.userId;
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }

  if (req.method === 'GET') {
    return getConversations(req, res, userId);
  }
  if (req.method === 'POST') {
    return saveConversations(req, res, userId);
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

async function getConversations(req: VercelRequest, res: VercelResponse, userId: number) {
  try {
    // userId agora vem do token, prevenindo manipulação e SQL Injection
    const { rows } = await sql`SELECT data FROM conversations WHERE user_id = ${userId};`;

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const conversations = rows[0].data;
    return res.status(200).json(conversations);

  } catch (error) {
    console.error('Get Conversations error:', error);
    return res.status(500).json({ message: 'Erro ao buscar conversas.' });
  }
}

async function saveConversations(req: VercelRequest, res: VercelResponse, userId: number) {
  try {
    const { conversations } = req.body;
    
    if (conversations === undefined) {
      return res.status(400).json({ message: 'Conversas são obrigatórias.' });
    }
    
    const conversationsJson = JSON.stringify(conversations);

    await sql`
      INSERT INTO conversations (user_id, data, updated_at)
      VALUES (${userId}, ${conversationsJson}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET 
          data = EXCLUDED.data,
          updated_at = NOW();
    `;

    return res.status(200).json({ message: 'Conversas salvas com sucesso.' });

  } catch (error) {
    console.error('Save Conversations error:', error);
    return res.status(500).json({ message: 'Erro ao salvar conversas.' });
  }
}

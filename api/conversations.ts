
import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return getConversations(req, res);
  }
  if (req.method === 'POST') {
    return saveConversations(req, res);
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

async function getConversations(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ message: 'ID do usuário é obrigatório.' });
    }

    const { rows } = await sql`SELECT data FROM conversations WHERE user_id = ${Number(userId)};`;

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

async function saveConversations(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId, conversations } = req.body;
    if (!userId || conversations === undefined) {
      return res.status(400).json({ message: 'ID do usuário e conversas são obrigatórios.' });
    }
    
    const conversationsJson = JSON.stringify(conversations);

    await sql`
      INSERT INTO conversations (user_id, data, updated_at)
      VALUES (${Number(userId)}, ${conversationsJson}, NOW())
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

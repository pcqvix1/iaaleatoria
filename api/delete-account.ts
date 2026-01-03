
import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { allowCors } from './_utils/cors';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'ID do usuário é obrigatório.' });
    }

    // Exclua as conversas primeiro para evitar problemas de restrição de chave estrangeira
    await sql`DELETE FROM conversations WHERE user_id = ${Number(userId)};`;
    
    // Em seguida, exclua o usuário
    await sql`DELETE FROM users WHERE id = ${Number(userId)};`;

    return res.status(204).end();

  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

export default allowCors(handler);

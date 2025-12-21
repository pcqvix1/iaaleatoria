
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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
    const { newPassword, currentPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'Nova senha é obrigatória.' });
    }
     if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const { rows } = await sql`SELECT password FROM users WHERE id = ${userIdFromToken};`;
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    const user = rows[0];

    // Se o usuário tem uma senha, verifique a senha atual
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Senha atual é obrigatória.' });
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Senha atual está incorreta.' });
      }
    }
    
    // Criptografe a nova senha e atualize
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password = ${hashedNewPassword} WHERE id = ${userIdFromToken};`;

    return res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

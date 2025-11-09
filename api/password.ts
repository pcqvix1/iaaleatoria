import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { userId, newPassword, currentPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ message: 'ID do usuário e nova senha são obrigatórios.' });
    }
     if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const { rows } = await sql`SELECT password FROM users WHERE id = ${Number(userId)};`;
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    const user = rows[0];

    // Se o usuário tem uma senha, é uma solicitação de alteração, então verifique a senha atual
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
    await sql`UPDATE users SET password = ${hashedNewPassword} WHERE id = ${Number(userId)};`;

    return res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Retorna a chave de API para o frontend usar na conexão WebSocket direta
  res.status(200).json({ apiKey: process.env.API_KEY });
}

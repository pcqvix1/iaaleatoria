
import { sql } from '@vercel/postgres';
import { NextRequest } from 'next/server'; // Importando para ter acesso aos searchParams

// Este arquivo lida com duas ações: buscar e salvar conversas.
// Vamos checar o método da requisição (GET ou POST) para decidir o que fazer.

export default async function handler(request: NextRequest) {
  if (request.method === 'GET') {
    return await getConversations(request);
  }

  if (request.method === 'POST') {
    return await saveConversations(request);
  }

  return new Response('Método não permitido', { status: 405 });
}


// Função para BUSCAR as conversas (GET)
async function getConversations(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ message: 'ID do usuário é obrigatório.' }), { status: 400 });
    }

    const { rows } = await sql`SELECT data FROM conversations WHERE user_id = ${Number(userId)};`;
    
    // Se o usuário não tiver conversas salvas, a consulta retorna 0 linhas.
    // Nesse caso, retornamos um array vazio, que é o que o frontend espera.
    if (rows.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // A coluna 'data' contém o array de conversas em formato JSON.
    const conversations = rows[0].data;

    return new Response(JSON.stringify(conversations), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get Conversations error:', error);
    return new Response(JSON.stringify({ message: 'Erro ao buscar conversas.' }), { status: 500 });
  }
}

// Função para SALVAR as conversas (POST)
async function saveConversations(request: Request) {
    try {
        const { userId, conversations } = await request.json();

        if (!userId || !conversations) {
            return new Response(JSON.stringify({ message: 'ID do usuário e conversas são obrigatórios.' }), { status: 400 });
        }
        
        // Converte o array de conversas para uma string JSON para salvar no banco
        const conversationsJson = JSON.stringify(conversations);

        // Usamos um "UPSERT":
        // Tenta INSERIR. Se já existir uma linha para esse user_id (ON CONFLICT),
        // ele faz um UPDATE na linha existente. Isso evita ter que checar se já existe.
        await sql`
            INSERT INTO conversations (user_id, data, updated_at)
            VALUES (${Number(userId)}, ${conversationsJson}, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET 
                data = EXCLUDED.data,
                updated_at = NOW();
        `;

        return new Response(JSON.stringify({ message: 'Conversas salvas com sucesso.' }), { status: 200 });

    } catch (error) {
        console.error('Save Conversations error:', error);
        return new Response(JSON.stringify({ message: 'Erro ao salvar conversas.' }), { status: 500 });
    }
}

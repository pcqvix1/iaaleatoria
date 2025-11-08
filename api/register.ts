
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

// A Vercel usa uma API similar à do Next.js para as funções serverless
export async function POST(request: Request) {
  try {
    // 1. Pega os dados enviados pelo frontend
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ message: 'Nome, e-mail e senha são obrigatórios.' }), { status: 400 });
    }

    // 2. Verifica se o usuário já existe
    const { rows: existingUsers } = await sql`SELECT * FROM users WHERE email = ${email};`;
    if (existingUsers.length > 0) {
      return new Response(JSON.stringify({ message: 'Este e-mail já está em uso.' }), { status: 409 });
    }

    // 3. Criptografa a senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Insere o novo usuário no banco de dados
    const { rows } = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING id, name, email;
    `;
    
    const newUser = rows[0];

    // 5. Retorna o usuário criado (sem a senha!)
    return new Response(JSON.stringify(newUser), { 
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ message: 'Ocorreu um erro no servidor.' }), { status: 500 });
  }
}

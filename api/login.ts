
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ message: 'E-mail e senha são obrigatórios.' }), { status: 400 });
    }

    // 1. Encontra o usuário pelo e-mail
    const { rows } = await sql`SELECT * FROM users WHERE email = ${email};`;
    const user = rows[0];

    if (!user) {
      return new Response(JSON.stringify({ message: 'E-mail ou senha inválidos.' }), { status: 401 });
    }

    // 2. Compara a senha enviada com a senha criptografada no banco
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return new Response(JSON.stringify({ message: 'E-mail ou senha inválidos.' }), { status: 401 });
    }

    // 3. Retorna os dados do usuário (sem a senha!)
    const userToReturn = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return new Response(JSON.stringify(userToReturn), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ message: 'Ocorreu um erro no servidor.' }), { status: 500 });
  }
}

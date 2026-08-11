import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const query = 'SELECT * FROM new WHERE id = $1';
    const { rows } = await pool.query(query, [username]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = rows[0];
    if (user.password !== password) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Check if the user is a new user by looking at their preferences
    // If all categories are '0', they are a new user
    const categories = ['Technology', 'Business', 'Science', 'Sports', 'Entertainment', 'Health', 'Politics', 'World'];
    const isNewUser = categories.every(cat => user[cat] === '0');

    return NextResponse.json({ 
      success: true, 
      isNewUser,
      username: user.id
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

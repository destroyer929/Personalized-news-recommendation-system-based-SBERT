import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, articleTitle, category } = body;

    if (!username || !articleTitle) {
      return NextResponse.json({ error: 'Username and article title are required' }, { status: 400 });
    }

    const currentTime = new Date().toISOString();

    const insertQuery = `
      INSERT INTO dislikes (username, category, title, time) 
      VALUES ($1, $2, $3, $4)
    `;

    await pool.query(insertQuery, [username, category || '', articleTitle, currentTime]);

    return NextResponse.json({ success: true, message: 'Dislike recorded successfully' });
  } catch (error) {
    console.error('Dislike tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

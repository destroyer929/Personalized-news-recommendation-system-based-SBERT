import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const query = 'SELECT * FROM saved_news WHERE username = $1 ORDER BY id DESC';
    const { rows } = await pool.query(query, [username]);

    return NextResponse.json({ success: true, saved: rows });
  } catch (error) {
    console.error('Failed to fetch saved news:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { username, article } = await req.json();

    if (!username || !article) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Insert ignoring duplicates (ON CONFLICT DO NOTHING)
    const query = `
      INSERT INTO saved_news (username, title, category, link, description, date, image)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username, link) DO NOTHING
    `;
    
    await pool.query(query, [
      username,
      article.title,
      article.category,
      article.link || article.url,
      article.description,
      article.date || new Date().toISOString(),
      article.image || null
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save news:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const link = searchParams.get('link');

    if (!username || !link) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const query = 'DELETE FROM saved_news WHERE username = $1 AND link = $2';
    await pool.query(query, [username, link]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete saved news:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

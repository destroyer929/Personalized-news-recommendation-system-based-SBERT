import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Check if user exists
    const checkQuery = 'SELECT * FROM new WHERE id = $1';
    const { rows } = await pool.query(checkQuery, [username]);

    if (rows.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    // Insert new user
    // The columns match the English categories we established earlier
    const insertQuery = `
      INSERT INTO new (id, password, "Technology", "Business", "Science", "Sports", "Entertainment", "Health", "Politics", "World") 
      VALUES ($1, $2, '0', '0', '0', '0', '0', '0', '0', '0')
    `;
    await pool.query(insertQuery, [username, password]);
    
    // Create personal footprint table for the user
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${username}" (
        "time" VARCHAR(50) NOT NULL,
        "footprint" VARCHAR(10000) NULL,
        "weight" FLOAT DEFAULT 1.0,
        PRIMARY KEY ("time")
      )
    `;
    await pool.query(createTableQuery);

    return NextResponse.json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

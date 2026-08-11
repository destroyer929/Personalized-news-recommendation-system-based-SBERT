import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, articleTitle, category, weight } = body;

    if (!username || !articleTitle) {
      return NextResponse.json({ error: 'Username and article title are required' }, { status: 400 });
    }

    // Format current time as a string (since the table column is VARCHAR)
    const currentTime = new Date().toISOString();
    
    // We can store both title and category as the footprint to give the ML engine more context
    const footprintStr = `${category}: ${articleTitle}`;
    
    const finalWeight = weight !== undefined ? parseFloat(weight) : 1.0;

    // Note: The table name is the username (surrounded by quotes to preserve case and prevent SQL injection/reserved word conflicts)
    const insertQuery = `
      INSERT INTO "${username}" ("time", "footprint", "weight") 
      VALUES ($1, $2, $3)
    `;

    await pool.query(insertQuery, [currentTime, footprintStr, finalWeight]);

    return NextResponse.json({ success: true, message: 'Footprint recorded successfully' });
  } catch (error) {
    console.error('Footprint tracking error:', error);
    // Log the actual DB error to see if table doesn't exist
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

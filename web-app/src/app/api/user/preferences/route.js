import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, preferences } = body;

    if (!username || !preferences) {
      return NextResponse.json({ error: 'Username and preferences are required' }, { status: 400 });
    }

    // Set selected categories to '1', others stay '0' (as per old Java logic)
    // Actually, old logic just set them to '1' if selected
    const categories = ['Technology', 'Business', 'Science', 'Sports', 'Entertainment', 'Health', 'Politics', 'World'];
    
    // We will build a dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    categories.forEach((cat) => {
      updates.push(`"${cat}" = $${paramIndex}`);
      values.push(preferences.includes(cat) ? '1' : '0');
      paramIndex++;
    });

    values.push(username);

    const updateQuery = `
      UPDATE new 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
    `;

    await pool.query(updateQuery, values);

    return NextResponse.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Preferences update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

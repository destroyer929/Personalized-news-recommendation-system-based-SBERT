import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Pagination bounds
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // 1. Fetch user preferences
    const query = 'SELECT * FROM new WHERE id = $1';
    const { rows } = await pool.query(query, [username]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = rows[0];
    const categories = ['Technology', 'Business', 'Science', 'Sports', 'Entertainment', 'Health', 'Politics', 'World'];
    const preferredCategories = categories.filter(cat => user[cat] === '1');

    // 2. Try to read personalized SBERT recommendations first
    const algoDir = path.resolve('..', 'algorithm');
    const recomPath = path.join(algoDir, 'recommendations', `${username}.json`);
    
    if (fs.existsSync(recomPath)) {
      try {
        const fileContent = fs.readFileSync(recomPath, 'utf-8');
        const recommendedNews = JSON.parse(fileContent);
        
        // The JSON file from SBERT is already perfectly sorted by relevance!
        // We will NOT sort by date here, so the most relevant articles (even if slightly older) 
        // stay exactly where they belong: at the very top of the feed.
        
        const paginatedNews = recommendedNews.slice(startIndex, endIndex);
        const hasMore = endIndex < recommendedNews.length;
        
        return NextResponse.json({ 
          success: true, 
          news: paginatedNews,
          hasMore
        });
      } catch (err) {
        console.error("Error reading recommendation JSON:", err);
      }
    }

    // 3. Fallback: Read the Excel file if no SBERT recommendations exist yet
    const excelPath = path.join(algoDir, 'englishnews.xlsx');
    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rawNews = xlsx.utils.sheet_to_json(sheet);
    
    const formattedNews = rawNews.map((row, index) => ({
      id: index,
      title: row.title || row.Title || 'Unknown Title',
      category: row.category || row.Category || 'Unknown Category',
      description: row.description || row.Description || 'No description available.',
      url: row.link || row.Link || row.url || row.Url || '#',
      image: row.image || row.Image || null
    }));

    let recommendedNews = [];
    
    if (preferredCategories.length > 0) {
      recommendedNews = formattedNews.filter(article => 
        preferredCategories.some(prefCat => 
          article.category.toLowerCase().includes(prefCat.toLowerCase())
        )
      );
    }

    if (recommendedNews.length === 0) {
      recommendedNews = formattedNews; // Just use all if no matches
    }
    
    // Sort generic fallback news by date (newest first)
    recommendedNews.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });
    
    const paginatedNews = recommendedNews.slice(startIndex, endIndex);
    const hasMore = endIndex < recommendedNews.length;

    return NextResponse.json({ 
      success: true, 
      news: paginatedNews,
      hasMore
    });
  } catch (error) {
    console.error('News fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

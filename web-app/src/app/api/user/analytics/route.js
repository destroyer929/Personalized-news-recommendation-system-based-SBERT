import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Time decay calculation matching Python SBERT logic
function calculateWeight(baseWeight, timestamp) {
  if (!timestamp) return baseWeight;
  const now = new Date();
  const past = new Date(timestamp);
  const diffTime = Math.abs(now - past);
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const decayFactor = Math.pow(0.95, diffDays);
  return baseWeight * decayFactor;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  try {
    const categoryScores = {};

    // 1. Fetch normal footprints
    try {
      const footprintQuery = `SELECT footprint, time, weight FROM "${username}"`;
      const result = await pool.query(footprintQuery);
      
      result.rows.forEach(row => {
        const text = row.footprint || "";
        const parts = text.split(':');
        if (parts.length > 1) {
          const category = parts[0].trim();
          const baseWeight = row.weight ? parseFloat(row.weight) : 1.0;
          const finalWeight = calculateWeight(baseWeight, row.time);
          
          if (!categoryScores[category]) categoryScores[category] = 0;
          categoryScores[category] += finalWeight;
        }
      });
    } catch (err) {
      // Table might not exist yet, ignore
    }

    // 2. Fetch saved news (strong signal)
    try {
      const savedQuery = `SELECT category, created_at FROM saved_news WHERE username = $1`;
      const savedResult = await pool.query(savedQuery, [username]);
      
      savedResult.rows.forEach(row => {
        const category = row.category;
        if (category) {
          const finalWeight = calculateWeight(3.0, row.created_at); // weight 3.0 for saved
          if (!categoryScores[category]) categoryScores[category] = 0;
          categoryScores[category] += finalWeight;
        }
      });
    } catch (err) {
      // ignore
    }

    // 3. Fetch dislikes (negative penalty)
    try {
      const dislikeQuery = `SELECT category, created_at FROM dislikes WHERE username = $1`;
      const dislikeResult = await pool.query(dislikeQuery, [username]);
      
      dislikeResult.rows.forEach(row => {
        const category = row.category;
        if (category) {
          const finalWeight = calculateWeight(1.0, row.created_at); // penalty
          if (!categoryScores[category]) categoryScores[category] = 0;
          categoryScores[category] -= (finalWeight * 2.0); // subtract weight
        }
      });
    } catch (err) {
      // ignore
    }

    // Process and sort scores
    let totalScore = 0;
    const chartData = [];
    
    Object.keys(categoryScores).forEach(cat => {
      // Filter out negative scores and empty categories
      if (categoryScores[cat] > 0 && cat.length > 0) {
        totalScore += categoryScores[cat];
        chartData.push({
          subject: cat,
          score: categoryScores[cat],
          fullMark: 100
        });
      }
    });

    // Normalize to percentages (0-100)
    chartData.forEach(item => {
      item.score = Math.round((item.score / totalScore) * 100);
      item.fullMark = 100; // For radar chart
    });
    
    // Sort highest to lowest
    chartData.sort((a, b) => b.score - a.score);
    
    // Take top 6 categories for a clean radar chart
    const topData = chartData.slice(0, 6);

    return NextResponse.json({ 
      data: topData,
      total_interactions: chartData.length
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

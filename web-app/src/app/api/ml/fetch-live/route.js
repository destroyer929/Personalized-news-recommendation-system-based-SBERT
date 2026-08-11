import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

export async function POST(req) {
  try {
    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const algorithmDir = path.resolve('..', 'algorithm');
    
    console.log(`Live Fetch triggered for ${username}... Starting crawler...`);
    
    // 1. Run the crawler to get fresh news
    try {
      await execAsync('python crawler_english.py', { cwd: algorithmDir });
      console.log('Crawler finished fetching live updates.');
    } catch (crawlErr) {
      console.error('Crawler failed:', crawlErr);
      return NextResponse.json({ error: 'Crawler failed' }, { status: 500 });
    }

    // 2. Run the SBERT recommendation engine to calculate new recommendations
    console.log(`Generating new personalized feed for ${username}...`);
    try {
      await execAsync(`python sbert_recommendation.py "${username}"`, { cwd: algorithmDir });
      console.log('SBERT recommendations complete.');
    } catch (mlErr) {
      console.error('ML calculation failed:', mlErr);
      return NextResponse.json({ error: 'Recommendation calculation failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Live fetch complete' });
  } catch (error) {
    console.error('Live fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

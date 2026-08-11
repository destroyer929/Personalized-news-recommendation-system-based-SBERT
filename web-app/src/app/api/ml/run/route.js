import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Resolve the path to the python scripts directory
    const algorithmDir = path.resolve('..', 'algorithm');
    
    // Command to execute the python script
    // We pass the username as an argument to sbert_recommendation.py so it runs for that user
    const command = `python sbert_recommendation.py ${username}`;

    console.log(`Executing ML script for user ${username}: ${command} in ${algorithmDir}`);

    // Execute asynchronously (don't wait for it to finish to return the response)
    // The Python scripts might take a while
    exec(command, { cwd: algorithmDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing python script for ${username}:`, error);
        return;
      }
      if (stderr) {
        console.error(`Python script stderr for ${username}:`, stderr);
      }
      console.log(`Python script stdout for ${username}:`, stdout);
    });

    return NextResponse.json({ success: true, message: 'ML Engine triggered successfully' });
  } catch (error) {
    console.error('ML trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

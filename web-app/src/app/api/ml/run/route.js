import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

// Load the protobuf definition
const PROTO_PATH = path.resolve('..', 'algorithm', 'protos', 'recommendation.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const recommendationProto = grpc.loadPackageDefinition(packageDefinition).recommendation;

export async function POST(req) {
  try {
    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    console.log(`[gRPC Client] Triggering ML Recommendation for user ${username}...`);

    return new Promise((resolve) => {
      // Create gRPC client
      const client = new recommendationProto.RecommendationService(
        'localhost:50051',
        grpc.credentials.createInsecure()
      );

      // Make RPC call
      client.GetRecommendations({ username }, (error, response) => {
        if (error) {
          console.error('[gRPC Client] Error calling RecommendationService:', error);
          resolve(NextResponse.json({ error: 'gRPC Service Error' }, { status: 500 }));
          return;
        }

        if (response.success && response.recommendations) {
          console.log(`[gRPC Client] Received ${response.recommendations.length} recommendations from ML backend.`);
          
          // Save to recommendations JSON for the frontend to consume
          const algoDir = path.resolve('..', 'algorithm');
          const recomDir = path.join(algoDir, 'recommendations');
          if (!fs.existsSync(recomDir)) {
            fs.mkdirSync(recomDir, { recursive: true });
          }
          
          const recomPath = path.join(recomDir, `${username}.json`);
          fs.writeFileSync(recomPath, JSON.stringify(response.recommendations, null, 2), 'utf-8');
          
          resolve(NextResponse.json({ success: true, message: 'ML recommendations updated via gRPC' }));
        } else {
          console.error('[gRPC Client] ML Backend returned failure:', response.message);
          resolve(NextResponse.json({ error: response.message || 'Unknown ML Error' }, { status: 500 }));
        }
      });
    });

  } catch (error) {
    console.error('ML trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

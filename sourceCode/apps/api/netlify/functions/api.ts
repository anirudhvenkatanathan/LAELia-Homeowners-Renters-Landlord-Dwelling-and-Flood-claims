// Netlify Function: wraps the Express/Apollo app (REST under /api/*, GraphQL at /graphql).
// The Mongo connection and the app are created once per warm instance and reused.
import serverless from 'serverless-http';
import mongoose from 'mongoose';
import { createApp } from '../../app';

type Handler = ReturnType<typeof serverless>;
let handlerPromise: Promise<Handler> | null = null;

async function init(): Promise<Handler> {
  const uri = process.env['MONGO_URI'] ?? process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGO_URI is not set in the Netlify environment variables.');
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
  return serverless(await createApp(), { basePath: '/.netlify/functions/api' });
}

export const handler = async (event: unknown, context: unknown) => {
  try {
    handlerPromise ??= init();
    const h = await handlerPromise;
    return await (h as (e: unknown, c: unknown) => Promise<unknown>)(event, context);
  } catch (err) {
    handlerPromise = null; // let the next request retry the connection
    console.error('API init/handler failed:', (err as Error).message);
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, message: 'Service temporarily unavailable.' }) };
  }
};

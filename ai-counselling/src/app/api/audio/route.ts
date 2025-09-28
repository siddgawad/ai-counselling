// src/app/api/audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { auth } from '@clerk/nextjs/server';
import { insertAudioMeta } from '@/db/audio';

const s3 = new S3Client({ region: process.env.AWS_REGION });
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/session' });

  const form = await req.formData();

  const file = form.get('audio');
  const tsStr = form.get('timestamp')?.toString();
  const frameStr = form.get('frameNumber')?.toString();

  if (!(file instanceof File) || !tsStr || !frameStr) {
    return NextResponse.json({ error: 'Bad form data' }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  const mime = (file.type || 'audio/webm') as 'audio/webm' | 'audio/mp4';
  if (mime !== 'audio/webm' && mime !== 'audio/mp4') {
    return NextResponse.json({ error: 'Unsupported mime' }, { status: 415 });
  }
  if (buf.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Frame too large' }, { status: 413 });
  }

  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

  const frameNumber = Number(frameStr);
  const ts_ms = Number(tsStr);

  const key = `users/${userId}/audio/${mime === 'audio/webm' ? 'webm' : 'mp4'}/frame_${frameNumber}_${ts_ms}.${mime === 'audio/webm' ? 'webm' : 'mp4'}`;

  console.log('[audio] uploading', { userId, frameNumber, ts_ms, mime, bytes: buf.length, key });

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: buf,
    ContentType: mime,
    CacheControl: 'no-store',
  }));

  const insertedId = await insertAudioMeta({
    clerk_user_id: userId,
    frameNumber,
    ts_ms,
    mime,
    bytes: buf.length,
    s3Key: key,
    checksum,
    created_at: new Date(),
  });


  console.log('[audio] stored', {
    userId,
    mongoFrameId: insertedId.toHexString(),
    frameNumber,
    ts_ms,
    s3Key: key,
  });

  return NextResponse.json({
    ok: true,
    frameId: insertedId.toHexString(),  // helpful for client debugging if you want it
    s3Key: key,
  });
}
                       
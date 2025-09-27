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

  // Convert to Buffer
  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  // Safety: enforce type and size
  const mime = file.type || 'audio/webm';
  if (mime !== 'audio/webm') {
    return NextResponse.json({ error: 'Unsupported mime' }, { status: 415 });
  }
  if (buf.length > 5 * 1024 * 1024) { // 5 MB per frame guard
    return NextResponse.json({ error: 'Frame too large' }, { status: 413 });
  }

  // Optional checksum for dedupe/integrity
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

  const frameNumber = Number(frameStr);
  const ts_ms = Number(tsStr);
  const key = `users/${userId}/audio/webm/frame_${frameNumber}_${ts_ms}.webm`;

  // Upload to S3
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: buf,
    ContentType: mime,
    CacheControl: 'no-store',
  }));

  // Store metadata in Mongo
  await insertAudioMeta({
    clerk_user_id: userId,
    frameNumber,
    ts_ms,
    mime: 'audio/webm',
    bytes: buf.length,
    s3Key: key,
    checksum,
    created_at: new Date(),
  });

  return NextResponse.json({ ok: true });
}

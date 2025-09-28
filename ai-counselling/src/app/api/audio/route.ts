import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { auth } from '@clerk/nextjs/server';
import { insertAudioMeta, type SupportedAudioMime } from '@/db/audio';

const s3 = new S3Client({ region: process.env.AWS_REGION });
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/session' });

  try {
    const form = await req.formData();
    const file = form.get('audio');
    const tsStr = form.get('timestamp')?.toString();
    const frameStr = form.get('frameNumber')?.toString();

    if (!(file instanceof File) || !tsStr || !frameStr) {
      return NextResponse.json({ error: 'Bad form data' }, { status: 400 });
    }

    const rawMime = (file.type || 'audio/webm').toLowerCase();
    const isWebm = rawMime.startsWith('audio/webm');
    const isMp4  = rawMime === 'audio/mp4' || rawMime.startsWith('audio/mp4;');

    if (!isWebm && !isMp4) {
      return NextResponse.json({ error: `Unsupported mime: ${rawMime}` }, { status: 415 });
    }

    const ext = isWebm ? 'webm' : 'm4a';
    const contentType: SupportedAudioMime = isWebm ? 'audio/webm' : 'audio/mp4';

    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (buf.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Frame too large' }, { status: 413 });
    }

    const frameNumber = Number(frameStr);
    const ts_ms = Number(tsStr);
    if (!Number.isFinite(frameNumber) || !Number.isFinite(ts_ms)) {
      return NextResponse.json({ error: 'Bad frameNumber/timestamp' }, { status: 400 });
    }

    const checksum = crypto.createHash('sha256').update(buf).digest('hex');
    const key = `users/${userId}/audio/${ext}/frame_${frameNumber}_${ts_ms}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buf,
      ContentType: contentType,
      CacheControl: 'no-store',
    }));

    await insertAudioMeta({
      clerk_user_id: userId,
      frameNumber,
      ts_ms,
      mime: contentType,        // <-- typed as union
      bytes: buf.length,
      s3Key: key,
      checksum,
      created_at: new Date(),
    });

    return NextResponse.json({ ok: true, key, bytes: buf.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Upload failed', detail: message }, { status: 500 });
  }
}

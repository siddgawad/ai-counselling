import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';

const region = process.env.AWS_REGION ?? '';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const BUCKET = process.env.S3_BUCKET ?? '';

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

export async function POST(req: NextRequest) {
  if (!region || !accessKeyId || !secretAccessKey || !BUCKET) {
    return NextResponse.json({ error: 'S3 not configured' }, { status: 500 });
  }

  try {
    const form = await req.formData();
    // IMPORTANT: expected fields from VoiceCircle (after small tweak below)
    const file = form.get('file') as File | null;        // the audio chunk
    const userId = (form.get('userId') as string) || ''; // clerk user id
    const frameId = (form.get('frameId') as string) || '';
    const ts = (form.get('timestamp') as string) || `${Date.now()}`;

    if (!file || !userId) {
      return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 });
    }

    const safeName = (file.name || 'chunk.webm').replace(/[^\w.\-]+/g, '_');
    const key = `${userId}/audio/frame_${frameId || ts}_${safeName}`;

    const body = Buffer.from(await file.arrayBuffer());
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: file.type || 'audio/webm',
    }));

    return NextResponse.json({ success: true, key });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

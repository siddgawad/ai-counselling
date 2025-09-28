// src/app/api/uploadVideo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';

const region = process.env.AWS_REGION ?? '';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const BUCKET_NAME = process.env.S3_BUCKET ?? '';

const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });

export async function POST(request: NextRequest) {
  if (!region || !accessKeyId || !secretAccessKey || !BUCKET_NAME) {
    return NextResponse.json({ error: 'Server not configured for S3' }, { status: 500 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = (formData.get('userId') as string | null) ?? null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const safeName = (file.name || 'recording.webm').replace(/[^\w.\-]+/g, '_');
    const base = userId ? `videos/${userId}` : 'videos';
    const key = `${base}/${Date.now()}_${safeName}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: file.type || 'video/webm',
    }));

    return NextResponse.json({ success: true, fileUrl: key });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

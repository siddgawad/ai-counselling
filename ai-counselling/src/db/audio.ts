// src/db/audio.ts
import { getCollection } from '@/lib/mongo';

export type AudioFrameDoc = {
  _id?: string;
  clerk_user_id: string;
  frameNumber: number;
  ts_ms: number;
  mime: 'audio/webm';
  bytes: number;            // size in bytes
  s3Key?: string;           // Option A
  gridFsId?: string;        // Option B
  checksum?: string;        // e.g., sha256 hex
  created_at: Date;
};

export async function insertAudioMeta(doc: Omit<AudioFrameDoc, '_id'>) {
  const coll = await getCollection<AudioFrameDoc>('audio_frames');
  await coll.insertOne(doc);
}

// src/db/audio.ts
import { getCollection } from '@/lib/mongo';
import type { ObjectId, InsertOneResult } from 'mongodb';

export type SupportedAudioMime = 'audio/webm' | 'audio/mp4';

export type AudioFrameDoc = {
  _id?: ObjectId;                // <-- use ObjectId for Mongo ids
  clerk_user_id: string;
  frameNumber: number;
  ts_ms: number;
  mime: SupportedAudioMime;
  bytes: number;
  s3Key?: string;
  gridFsId?: string;
  checksum?: string;
  created_at: Date;
};

export async function insertAudioMeta(
  doc: Omit<AudioFrameDoc, '_id'>
): Promise<ObjectId> {
  const coll = await getCollection<AudioFrameDoc>('audio_frames');
  const res: InsertOneResult<AudioFrameDoc> = await coll.insertOne(doc);
  return res.insertedId; // <-- return the new _id
}

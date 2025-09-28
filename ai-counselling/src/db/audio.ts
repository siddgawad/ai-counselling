import { getCollection } from '@/lib/mongo';

export type SupportedAudioMime = 'audio/webm' | 'audio/mp4';

export type AudioFrameDoc = {
  _id?: string;
  clerk_user_id: string;
  frameNumber: number;
  ts_ms: number;
  mime: SupportedAudioMime;  // <-- was 'audio/webm'
  bytes: number;
  s3Key?: string;
  gridFsId?: string;
  checksum?: string;
  created_at: Date;
};

export async function insertAudioMeta(doc: Omit<AudioFrameDoc, '_id'>) {
  const coll = await getCollection<AudioFrameDoc>('audio_frames');
  await coll.insertOne(doc);
}

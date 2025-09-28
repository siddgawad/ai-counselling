'use client';

import { useEffect, useRef, useState } from 'react';

function pickAudioMime(): string {
  const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const m of prefs) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return 'audio/webm';
}

export function useAudioChunkUploader(params: {
  userId: string;
  chunkMs?: number;                // default 5000
  fastapiBaseUrl?: string;         // optional, for process() helper
}) {
  const { userId, chunkMs = 5000, fastapiBaseUrl } = params;

  const [status, setStatus] = useState<string>('');
  const [recording, setRecording] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const frameCounterRef = useRef<number>(0);

  async function uploadChunk(blob: Blob, frameId: number): Promise<void> {
    const filename = `chunk_${Date.now()}.webm`;
    const file = new File([blob], filename, { type: blob.type || 'audio/webm' });

    const form = new FormData();
    form.append('file', file);
    form.append('userId', userId);
    form.append('frameId', String(frameId));

    const res = await fetch('/api/uploadAudio', { method: 'POST', body: form });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || 'Upload failed');
    }
  }

  async function start(): Promise<void> {
    try {
      setStatus('Requesting microphone…');
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;

      const mimeType = pickAudioMime();
      const mr = new MediaRecorder(s, { mimeType });
      mrRef.current = mr;
      frameCounterRef.current = 0;

      mr.ondataavailable = async (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return;
        const frameId = ++frameCounterRef.current;
        try {
          await uploadChunk(ev.data, frameId);
          setStatus(`Uploaded chunk #${frameId}`);
        } catch {
          setStatus(`Chunk #${frameId} upload failed`);
        }
      };

      mr.onstart = () => {
        setRecording(true);
        setStatus('Recording (uploading chunks)…');
      };

      mr.onstop = () => {
        setRecording(false);
        setStatus('Stopped');
      };

      mr.start(chunkMs); // periodic chunks
    } catch {
      setStatus('Mic permission denied or device unavailable');
    }
  }

  function stop(): void {
    const mr = mrRef.current;
    if (mr && mr.state === 'recording') mr.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function process(): Promise<void> {
    if (!fastapiBaseUrl) return;
    try {
      setStatus('Processing speech…');
      const url = `${fastapiBaseUrl}/process_speech?userid=${encodeURIComponent(userId)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setStatus(`Process failed: ${json?.error ?? 'error'}`);
        return;
      }
      setStatus('Processed. See console.');
      console.log('process_speech response:', json);
    } catch {
      setStatus('Process request failed');
    }
  }

  useEffect(() => {
    return () => {
      try {
        if (mrRef.current && mrRef.current.state === 'recording') mrRef.current.stop();
      } catch {}
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { start, stop, process, recording, status };
}

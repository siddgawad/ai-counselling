// src/app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { z } from 'zod';
import { upsertUserFromClerk } from '@/db/users';
import { getDb } from '@/lib/mongo';

// Make the secret non-nullable for TS
const SECRET = process.env.CLERK_SECRET_KEY!;
if (!SECRET) {
  throw new Error('CLERK_WEBHOOK_SECRET is not set');
}

/* ---------------- Zod schemas ---------------- */

const EmailSchema = z.object({
  id: z.string(),
  email_address: z.email(), // <-- fix: z.string().email()
});

const UserDataSchema = z.object({
  id: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  image_url: z.url().nullish(),
  primary_email_address_id: z.string().nullish(),
  email_addresses: z.array(EmailSchema),
});

// Envelope: keep data as unknown; we’ll refine per type below.
// (Avoids the “Expected 2-3 arguments” issue with z.record)
const ClerkEventSchema = z.object({
  type: z.union([
    z.literal('user.created'),
    z.literal('user.updated'),
    z.literal('user.deleted'),
  ]),
  data: z.unknown(),
});

/* ---------------- Helpers ---------------- */

function extractPrimaryEmail(
  primaryId: string | null | undefined,
  emails: z.infer<typeof EmailSchema>[],
): string | null {
  if (emails.length === 0) return null;
  if (primaryId) {
    const found = emails.find((e) => e.id === primaryId);
    if (found) return found.email_address;
  }
  return emails[0]?.email_address ?? null;
}

/* ---------------- Route handler ---------------- */

export async function POST(req: NextRequest) {
  const payload = await req.text();

  // Provide non-empty strings to satisfy svix types
  const svixHeaders = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  try {
    // Verify signature
    const wh = new Webhook(SECRET); // <-- SECRET is string (not string | undefined)
    const verified = wh.verify(payload, svixHeaders);

    // Parse event envelope safely
    const event = ClerkEventSchema.parse(verified);

    if (event.type === 'user.deleted') {
      // Deleted events have a minimal shape
      const { id } = z.object({ id: z.string() }).parse(event.data);

      const db = await getDb();
      await db.collection('users').deleteOne({ clerk_user_id: id });

      return NextResponse.json({ ok: true, action: 'deleted', id });
    }

    // created/updated → parse full user
    const user = UserDataSchema.parse(event.data);
    const email = extractPrimaryEmail(user.primary_email_address_id, user.email_addresses);

    await upsertUserFromClerk({
      clerk_user_id: user.id,
      email,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      image_url: user.image_url ?? null,
    });

    return NextResponse.json({
      ok: true,
      action: event.type === 'user.created' ? 'upsert.created' : 'upsert.updated',
      id: user.id,
    });
  } catch (err) {
    // _err intentionally unused to satisfy eslint no-unused-vars
    return NextResponse.json(
      { error: 'Webhook verification or parsing failed',err },
      { status: 400 },
    );
  }
}

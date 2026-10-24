import { timingSafeEqual } from 'node:crypto';

export function authorized(request: Request, expected: string | undefined): boolean {
  if (!expected || expected.length < 16) return false;
  const provided = request.headers.get('authorization') ?? '';
  const target = `Bearer ${expected}`;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(target);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

export function allowedTelegramUser(id: number, chatId: number, chatType: string, allowlist: string | undefined): boolean {
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(chatId) || id !== chatId || chatType !== 'private') return false;
  return (allowlist ?? '').split(',').map((value) => value.trim()).filter(Boolean).includes(String(id));
}

export async function callbackToken(secret: string, participantId: string, attemptId: string, revision: number, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify([participantId, attemptId, revision, value])));
  const nonce = Array.from(new Uint8Array(signed).slice(0, 8), (v) => v.toString(16).padStart(2, '0')).join('');
  return `${revision}:${value}:${nonce}`;
}

export async function verifyCallback(token: string, secret: string, participantId: string, attemptId: string, revision: number): Promise<string | null> {
  const match = /^(\d{1,12}):([a-z_\/]{1,24}):([a-f0-9]{16})$/.exec(token);
  if (!match || Number(match[1]) !== revision) return null;
  const expected = await callbackToken(secret, participantId, attemptId, revision, match[2]!);
  const a = new TextEncoder().encode(token);
  const b = new TextEncoder().encode(expected);
  return a.length === b.length && timingSafeEqual(a,b) ? match[2]! : null;
}

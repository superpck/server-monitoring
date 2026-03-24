import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

export const randomString = (len = 32, type='alphanumeric') => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const buffer = new Uint32Array(len);
  crypto.getRandomValues(buffer);
  
  return Array.from(buffer)
    .map((value) => charset[value % charset.length])
    .join('');
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64)
  return `${salt}:${key.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(':')
  if (!salt || !storedHash) return false
  const storedBuffer = Buffer.from(storedHash, 'hex')
  const supplied = scryptSync(password, salt, 64)
  return timingSafeEqual(storedBuffer, supplied)
}

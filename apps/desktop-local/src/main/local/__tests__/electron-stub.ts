// Stub modul 'electron' untuk vitest (di-alias via vitest.config.ts).
// Test jalan di Node biasa — safeStorage tidak tersedia, jadi session.ts
// memakai jalur fallback plaintext yang deterministik.
export const safeStorage = {
  isEncryptionAvailable: (): boolean => false,
  encryptString: (value: string): Buffer => Buffer.from(value, 'utf8'),
  decryptString: (buffer: Buffer): string => buffer.toString('utf8')
}

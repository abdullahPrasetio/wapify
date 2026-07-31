import { safeStorage } from 'electron'
import type Database from 'better-sqlite3'

// Sesi sync (§6.1 + §8 revisi): refresh token dienkripsi via safeStorage
// Electron, disimpan (base64) di sync_state bersama identitas akun & server
// URL. Sesi hidup sampai logout eksplisit; kerja harian tidak menyentuhnya.

export interface SyncSessionUser {
  id: number
  email: string
  name: string
  is_super_admin: boolean
  is_premium: boolean
}

export interface SyncSession {
  serverUrl: string
  user: SyncSessionUser
}

function setState(db: Database.Database, key: string, value: string | null): void {
  if (value === null) {
    db.prepare('DELETE FROM sync_state WHERE key = ?').run(key)
  } else {
    db.prepare(
      'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value)
  }
}

function getState(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as
    | { value: string | null }
    | undefined
  return row?.value ?? null
}

export function saveRefreshToken(db: Database.Database, token: string): void {
  // safeStorage bisa tidak tersedia (mis. Linux tanpa keyring) — fallback plaintext
  // dengan penanda supaya getRefreshToken tahu cara membacanya.
  if (safeStorage.isEncryptionAvailable()) {
    setState(db, 'refresh_token_enc', safeStorage.encryptString(token).toString('base64'))
    setState(db, 'refresh_token_plain', null)
  } else {
    setState(db, 'refresh_token_plain', token)
    setState(db, 'refresh_token_enc', null)
  }
}

export function getRefreshToken(db: Database.Database): string | null {
  const enc = getState(db, 'refresh_token_enc')
  if (enc) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch {
      return null
    }
  }
  return getState(db, 'refresh_token_plain')
}

export function deleteRefreshToken(db: Database.Database): void {
  setState(db, 'refresh_token_enc', null)
  setState(db, 'refresh_token_plain', null)
}

export function saveSession(db: Database.Database, session: SyncSession): void {
  setState(db, 'server_url', session.serverUrl)
  setState(db, 'sync_account', JSON.stringify(session.user))
}

export function getSession(db: Database.Database): SyncSession | null {
  const serverUrl = getState(db, 'server_url')
  const account = getState(db, 'sync_account')
  const hasToken = getRefreshToken(db) !== null
  if (!serverUrl || !account || !hasToken) return null
  try {
    return { serverUrl, user: JSON.parse(account) as SyncSessionUser }
  } catch {
    return null
  }
}

export function clearSession(db: Database.Database): void {
  deleteRefreshToken(db)
  setState(db, 'sync_account', null)
  // server_url sengaja dibiarkan — prefill dialog login berikutnya.
}

export function setLastFullSyncAt(db: Database.Database, iso: string): void {
  setState(db, 'last_full_sync_at', iso)
}

export function getLastFullSyncAt(db: Database.Database): string | null {
  return getState(db, 'last_full_sync_at')
}

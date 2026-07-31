// Kontrak persis §7 docs/local-app-design.md — shell (desktop / desktop-local)
// memanggil setAppMode() sekali sebelum render App(). Default selalu Cloud
// supaya apps/desktop yang tidak memanggil setAppMode() sama sekali tidak
// berubah perilaku.
export interface AppMode {
  mode: 'cloud' | 'local'
  realtime: boolean
  auth: 'required' | 'none'
  sync: boolean
}

const defaultMode: AppMode = {
  mode: 'cloud',
  realtime: true,
  auth: 'required',
  sync: false
}

let current: AppMode = defaultMode

export function setAppMode(mode: Partial<AppMode>): void {
  current = { ...defaultMode, ...mode }
}

export function getAppMode(): AppMode {
  return current
}

/** 3912 → "1:05:12", 2550 → "42:30" */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = Math.round(totalSec % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Allure en min/km : 318.75 s/km → "5:18" */
export function formatPace(durationSec: number, distanceKm: number): string {
  const secPerKm = Math.round(durationSec / distanceKm)
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}`
}

/** 12.4 → "12,4" */
export function formatKm(km: number): string {
  return km.toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** 2 h 22 */
export function formatHours(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.round((totalSec % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

// Fuseau fixé pour que le rendu serveur et le navigateur affichent la même chose
const timeZone = 'Europe/Brussels'
const dayFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone })
const timeFmt = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone })

/** "Mardi 17 novembre" */
export function formatDay(iso: string): string {
  const s = dayFmt.format(new Date(iso))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "18:42" */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

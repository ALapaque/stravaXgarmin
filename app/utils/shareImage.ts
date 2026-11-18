/** Image 1080×1920 (format story) du récap, dessinée sur un canvas. */
export interface RecapImageData {
  period: string
  km: string
  delta: string | null
  stats: { label: string; value: string }[]
  bars: { label: string; km: number }[]
  highlight?: string
}

export async function renderRecapImage(d: RecapImageData): Promise<Blob> {
  const W = 1080
  const H = 1920
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const font = (w: number, s: number, fam = 'Urbanist') => `${w} ${s}px ${fam}, system-ui, sans-serif`

  try {
    await Promise.all([document.fonts.load(font(700, 100)), document.fonts.load(font(500, 40)), document.fonts.load('500 36px "DM Mono"')])
  } catch {
    /* polices système en secours */
  }

  // Fond nuit + halos
  g.fillStyle = '#0b0d17'
  g.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, color: string) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, color)
    rg.addColorStop(1, 'rgba(11,13,23,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)
  }
  glow(120, 160, 760, 'rgba(255,90,31,0.55)')
  glow(1000, 380, 700, 'rgba(43,107,255,0.5)')
  glow(900, 1750, 600, 'rgba(255,46,147,0.3)')

  const pad = 90
  g.fillStyle = '#fff'
  g.font = font(700, 44)
  g.fillText('stravaXgarmin', pad, 150)

  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.font = font(500, 44)
  g.fillText(d.period, pad, 300)

  // Gros chiffre
  g.fillStyle = '#fff'
  g.font = font(700, 230)
  g.fillText(d.km, pad, 520)
  const kmWidth = g.measureText(d.km).width
  g.font = font(600, 80)
  g.fillText('km', pad + kmWidth + 24, 520)

  if (d.delta) {
    g.font = font(600, 42)
    const tw = g.measureText(d.delta).width
    const grad = g.createLinearGradient(pad, 0, pad + tw + 60, 0)
    grad.addColorStop(0, '#ff5a1f')
    grad.addColorStop(1, '#ff2e93')
    g.fillStyle = grad
    roundRect(g, pad, 580, tw + 60, 76, 38)
    g.fill()
    g.fillStyle = '#fff'
    g.fillText(d.delta, pad + 30, 632)
  }

  // Grille de stats
  const colW = (W - pad * 2 - 30) / 2
  d.stats.forEach((s, i) => {
    const x = pad + (i % 2) * (colW + 30)
    const y = 740 + Math.floor(i / 2) * 230
    g.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(g, x, y, colW, 200, 36)
    g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.14)'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = '#fff'
    g.font = font(700, 76)
    g.fillText(s.value, x + 36, y + 110)
    g.fillStyle = 'rgba(255,255,255,0.65)'
    g.font = '500 32px "DM Mono", ui-monospace, monospace'
    g.fillText(s.label, x + 36, y + 165)
  })

  // Barres
  const chartTop = 1240
  const chartH = 300
  const max = Math.max(...d.bars.map((b) => b.km), 1)
  const gap = 24
  const bw = (W - pad * 2 - gap * (d.bars.length - 1)) / d.bars.length
  d.bars.forEach((b, i) => {
    const x = pad + i * (bw + gap)
    const h = b.km ? Math.max((b.km / max) * chartH, 24) : 12
    const grad = g.createLinearGradient(0, chartTop + chartH - h, 0, chartTop + chartH)
    grad.addColorStop(0, b.km ? '#ff2e93' : 'rgba(255,255,255,0.15)')
    grad.addColorStop(1, b.km ? '#ff5a1f' : 'rgba(255,255,255,0.15)')
    g.fillStyle = grad
    roundRect(g, x, chartTop + chartH - h, bw, h, 14)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.65)'
    g.font = '500 30px "DM Mono", ui-monospace, monospace'
    const lw = g.measureText(b.label).width
    g.fillText(b.label, x + (bw - lw) / 2, chartTop + chartH + 54)
  })

  if (d.highlight) {
    g.fillStyle = '#fff'
    g.font = font(600, 46)
    wrap(g, d.highlight, pad, 1700, W - pad * 2, 60)
  }

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas vide'))), 'image/png'))
}

/** Image 1080×1920 d'une course : tracé, titre et chiffres, aux couleurs du thème affiché. */
export interface RunImageData {
  title: string
  type: string
  /** Couleur du type de séance, sous forme « var(--type-long) » ou couleur CSS */
  typeColor: string
  date: string
  stats: { label: string; value: string; unit?: string }[]
  highlight?: string
  /** Points [lat, lng] du parcours (ou parcours de démo) */
  points: [number, number][]
}

export async function renderRunImage(d: RunImageData): Promise<Blob> {
  const W = 1080
  const H = 1920
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  // Le thème en cours (et ses réglages sur mesure) donne couleurs, polices et arrondis
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const resolve = (color: string) => {
    const m = color.match(/^var\((--[\w-]+)\)$/)
    return m ? v(m[1]!, '#4da3ff') : color
  }
  const bg = v('--bg', '#0b0d17')
  const ink = v('--ink', '#ffffff')
  const accent = v('--primary-solid', '#ff5a1f')
  const typeColor = resolve(d.typeColor)
  const display = v('--font-display', 'system-ui').split(',')[0]!.trim()
  const body = v('--font-body', 'system-ui').split(',')[0]!.trim()
  const radius = Math.min(Number.parseFloat(v('--r-card', '24px')) * 2.2 || 40, 64)
  const strength = Number.parseFloat(v('--aurora-strength', '0.5')) || 0
  const font = (w: number, s: number, fam = display) => `${w} ${s}px ${fam}, system-ui, sans-serif`
  // Même couleur avec une transparence : le canvas la normalise, on en tire ses composantes
  const soft = (color: string, a: number) => {
    g.fillStyle = '#000'
    g.fillStyle = color
    const n = String(g.fillStyle)
    const hex = n.match(/^#([0-9a-f]{6})$/i)
    if (hex) {
      const i = Number.parseInt(hex[1]!, 16)
      return `rgba(${i >> 16}, ${(i >> 8) & 255}, ${i & 255}, ${a})`
    }
    const m = n.match(/rgba?\(([\d.]+), ?([\d.]+), ?([\d.]+)(?:, ?([\d.]+))?\)/)
    return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Number(m[4] ?? 1) * a})` : color
  }

  try {
    await Promise.all([document.fonts.load(font(700, 100)), document.fonts.load(font(500, 40, body))])
  } catch {
    /* polices système en secours */
  }

  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, color: string, a: number) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, soft(color, a))
    rg.addColorStop(1, soft(color, 0))
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)
  }
  glow(80, 120, 820, v('--aurora-1', accent), 0.75 * strength)
  glow(1040, 420, 760, v('--aurora-3', typeColor), 0.7 * strength)
  glow(540, 620, 620, typeColor, 0.22)

  const pad = 84
  g.fillStyle = ink
  g.font = font(700, 40)
  g.fillText('stravaXgarmin', pad, 130)

  // Carte : quadrillage discret puis tracé lumineux
  const box = { x: pad, y: 190, w: W - pad * 2, h: 760 }
  g.save()
  roundRect(g, box.x, box.y, box.w, box.h, radius)
  g.fillStyle = soft(ink, 0.05)
  g.fill()
  g.clip()
  g.strokeStyle = soft(ink, 0.07)
  g.lineWidth = 2
  for (let x = box.x; x < box.x + box.w; x += 76) {
    g.beginPath()
    g.moveTo(x, box.y)
    g.lineTo(x, box.y + box.h)
    g.stroke()
  }
  for (let y = box.y; y < box.y + box.h; y += 76) {
    g.beginPath()
    g.moveTo(box.x, y)
    g.lineTo(box.x + box.w, y)
    g.stroke()
  }
  g.restore()
  roundRect(g, box.x, box.y, box.w, box.h, radius)
  g.strokeStyle = soft(ink, 0.16)
  g.lineWidth = 2
  g.stroke()

  const inner = 90
  const pts = fitRoute(d.points, box.w - inner * 2, box.h - inner * 2).map(([x, y]) => [box.x + inner + x, box.y + inner + y] as [number, number])
  if (pts.length > 1) {
    const path = () => {
      g.beginPath()
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    }
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.save()
    g.shadowColor = typeColor
    g.shadowBlur = 50
    g.strokeStyle = typeColor
    g.lineWidth = 14
    path()
    g.stroke()
    g.restore()
    g.strokeStyle = typeColor
    g.lineWidth = 10
    path()
    g.stroke()
    const dot = ([x, y]: [number, number], r: number, fill: string, stroke: string) => {
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fillStyle = fill
      g.fill()
      g.strokeStyle = stroke
      g.lineWidth = 6
      g.stroke()
    }
    dot(pts[0]!, 14, bg, typeColor)
    dot(pts[pts.length - 1]!, 18, typeColor, bg)
  }

  // Type, titre, date
  g.fillStyle = typeColor
  g.font = font(700, 34, body)
  g.fillText(d.type.toUpperCase().split('').join('\u200a'), pad, 1040)
  g.fillStyle = ink
  g.font = font(700, 84)
  const afterTitle = wrap(g, d.title, pad, 1140, W - pad * 2, 96, 2)
  g.fillStyle = soft(ink, 0.65)
  g.font = font(500, 38, body)
  g.fillText(d.date, pad, afterTitle + 64)

  // Chiffres
  const top = afterTitle + 130
  const gap = 24
  const colW = (W - pad * 2 - gap) / 2
  d.stats.slice(0, 4).forEach((s, i) => {
    const x = pad + (i % 2) * (colW + gap)
    const y = top + Math.floor(i / 2) * 204
    roundRect(g, x, y, colW, 180, Math.min(radius, 44))
    g.fillStyle = soft(ink, 0.07)
    g.fill()
    g.strokeStyle = soft(ink, 0.14)
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = soft(ink, 0.6)
    g.font = font(700, 26, body)
    g.fillText(s.label.toUpperCase(), x + 34, y + 58)
    g.fillStyle = ink
    g.font = font(700, 76)
    g.fillText(s.value, x + 34, y + 140)
    if (s.unit) {
      const vw = g.measureText(s.value).width
      g.fillStyle = soft(ink, 0.6)
      g.font = font(600, 32, body)
      g.fillText(s.unit, x + 34 + vw + 12, y + 140)
    }
  })

  if (d.highlight) {
    const y = top + 2 * 204 + 20
    g.font = font(700, 40, body)
    const tw = Math.min(g.measureText(d.highlight).width, W - pad * 2 - 72)
    roundRect(g, pad, y, tw + 72, 84, 42)
    g.fillStyle = accent
    g.fill()
    g.fillStyle = v('--on-primary', '#ffffff')
    g.fillText(d.highlight, pad + 36, y + 56, tw)
  }

  return new Promise((resolve2, reject) => c.toBlob((b) => (b ? resolve2(b) : reject(new Error('canvas vide'))), 'image/png'))
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

/** Écrit le texte sur plusieurs lignes ; renvoie la position de la dernière ligne. */
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, maxLines = 6) {
  let line = ''
  let lines = 1
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (g.measureText(test).width > max && line) {
      if (lines === maxLines) {
        line = `${line}…`
        break
      }
      g.fillText(line, x, y)
      line = word
      y += lh
      lines++
    } else line = test
  }
  g.fillText(line, x, y, max)
  return y
}

/** Partage natif (mobile) ou téléchargement en secours. */
export async function shareOrDownload(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}

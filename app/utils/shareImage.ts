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

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (g.measureText(test).width > max && line) {
      g.fillText(line, x, y)
      line = word
      y += lh
    } else line = test
  }
  g.fillText(line, x, y)
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

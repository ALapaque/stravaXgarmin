/* Images à partager (format story, 1080×1920), dessinées sur un canvas : le bilan, et une course. */
import type { ShareChart } from '#shared/utils/runchart'

/** Image du bilan. */
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

/**
 * Image 1080×1920 d'une course, aux couleurs du thème affiché : en haut le tracé (dehors) ou, sans tracé,
 * la séance en graphique (tapis, GPS absent), puis le titre et les chiffres. Le cadre du haut n'est jamais
 * vide : sans tracé ni graphique, il disparaît et le texte prend sa place.
 */
export interface RunImageData {
  title: string
  type: string
  /** Couleur du type de séance, sous forme « var(--type-long) » ou couleur CSS */
  typeColor: string
  date: string
  stats: { label: string; value: string; unit?: string }[]
  highlight?: string
  /** Points [lat, lng] du parcours (ou parcours de démo) ; vide sans tracé */
  points: [number, number][]
  /** Sans tracé : le graphique de la séance (règle : shareChart) ; null s'il n'y a rien à dessiner */
  chart?: ShareChart | null
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
  const mono = v('--font-mono', 'ui-monospace').split(',')[0]!.trim()
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
    await Promise.all([document.fonts.load(font(700, 100)), document.fonts.load(font(500, 40, body)), document.fonts.load(font(500, 26, mono))])
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

  // Cadre du haut : le tracé, sinon le graphique de la séance, sinon rien (pas de cadre vide)
  const box = { x: pad, y: 190, w: W - pad * 2, h: 760 }
  const inner = 90
  const pts = fitRoute(d.points, box.w - inner * 2, box.h - inner * 2).map(([x, y]) => [box.x + inner + x, box.y + inner + y] as [number, number])
  const chart = pts.length > 1 ? null : (d.chart ?? null)
  const framed = pts.length > 1 || Boolean(chart)

  if (framed) {
    g.save()
    roundRect(g, box.x, box.y, box.w, box.h, radius)
    g.fillStyle = soft(ink, 0.05)
    g.fill()
    if (pts.length > 1) {
      // Carte : quadrillage discret sous le tracé
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
    }
    g.restore()
    roundRect(g, box.x, box.y, box.w, box.h, radius)
    g.strokeStyle = soft(ink, 0.16)
    g.lineWidth = 2
    g.stroke()
  }

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
  } else if (chart) {
    drawChart(chart)
  }

  /*
   * La séance en graphique, comme en haut de la page d'une course : une barre par tour (largeur = durée,
   * hauteur = vitesse), teintée par nature d'étape ou par intensité, le cardio par-dessus, l'axe du temps
   * et une légende (jamais la couleur seule).
   */
  function drawChart(c: ShareChart) {
    const px = box.x + 56
    const pw = box.w - 112
    const muted = soft(ink, 0.62)
    const ghost = soft(ink, 0.3)

    // Légende mise en lignes d'abord : elle fixe la hauteur laissée au graphique
    type Item = { key: string; label: string; mark: number; w: number }
    g.font = font(500, 27, body)
    const items: Item[] = c.legend.map((l) => ({ key: l.key, label: l.label, mark: l.key === 'hr' ? 34 : 24, w: 0 }))
    if (c.hint) items.push({ key: 'hint', label: c.hint, mark: 0, w: 0 })
    for (const it of items) it.w = (it.mark ? it.mark + 12 : 0) + g.measureText(it.label).width
    const between = 34
    const rows: Item[][] = []
    let used = 0
    for (const it of items) {
      const row = rows[rows.length - 1]
      if (!row || used + between + it.w > pw) {
        rows.push([it])
        used = it.w
      } else {
        row.push(it)
        used += between + it.w
      }
    }
    const rowH = 46
    const axisH = c.ticks.length ? 62 : 26
    const top = box.y + 64
    const ph = box.h - 64 - axisH - rows.length * rowH - 34
    const base = top + ph

    // Repères de temps
    g.save()
    g.strokeStyle = soft(ink, 0.12)
    g.lineWidth = 2
    g.setLineDash([6, 10])
    for (const t of c.ticks) {
      if (t.x <= 0) continue
      g.beginPath()
      g.moveTo(px + t.x * pw, top)
      g.lineTo(px + t.x * pw, base)
      g.stroke()
    }
    g.restore()

    const colorOf = (b: ShareChart['bars'][number]) => (c.linked ? resolve(b.kind ? LAP_KIND_COLORS[b.kind] ?? LAP_NO_KIND_COLOR : LAP_NO_KIND_COLOR) : soft(typeColor, LAP_TIER_MIX[b.tier]! / 100))
    /** Hachures à 45° dans un rectangle (étape entamée, étape pas faite) */
    const hatch = (x: number, y: number, w: number, h: number, color: string, lw: number, step: number) => {
      g.save()
      g.beginPath()
      g.rect(x, y, w, h)
      g.clip()
      g.strokeStyle = color
      g.lineWidth = lw
      for (let k = -h; k < w + h; k += step) {
        g.beginPath()
        g.moveTo(x + k, y + h)
        g.lineTo(x + k + h, y)
        g.stroke()
      }
      g.restore()
    }

    for (const b of c.bars) {
      const w = Math.max(b.w * pw - 4, 6)
      const x = px + b.x * pw + 2
      const h = Math.max(b.level * ph, 10)
      const y = base - h
      const r = Math.min(10, w / 2, radius)
      const color = colorOf(b)
      if (b.state === 'missed') {
        hatch(x, y, w, h, ghost, 3, 13)
        g.strokeStyle = ghost
        g.lineWidth = 2
        g.strokeRect(x + 1, y + 1, w - 2, h - 1)
        continue
      }
      g.beginPath()
      g.roundRect(x, y, w, h, [r, r, 0, 0])
      if (b.state === 'partial') {
        g.fillStyle = soft(color, 0.3)
        g.fill()
        hatch(x, y, w, h, color, 5, 13)
        continue
      }
      const grad = g.createLinearGradient(0, y, 0, base)
      grad.addColorStop(0, color)
      grad.addColorStop(1, soft(color, 0.3))
      g.fillStyle = grad
      g.fill()
    }

    // Ligne de base
    g.strokeStyle = soft(ink, 0.3)
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(px, base)
    g.lineTo(px + pw, base)
    g.stroke()

    // Cardio : trait d'encre cerclé du fond, lisible sur toutes les barres
    if (c.hr) {
      const line = () => {
        g.beginPath()
        c.hr!.forEach(([hx, hy], i) => {
          const x = px + hx * pw
          const y = base - hy * ph
          if (i) g.lineTo(x, y)
          else g.moveTo(x, y)
        })
      }
      g.save()
      g.lineJoin = 'round'
      g.lineCap = 'round'
      if (!c.bars.length) {
        // Courbe seule : une aire douce dessous, dans la teinte du type
        line()
        g.lineTo(px + c.hr[c.hr.length - 1]![0] * pw, base)
        g.lineTo(px + c.hr[0]![0] * pw, base)
        g.closePath()
        const area = g.createLinearGradient(0, top, 0, base)
        area.addColorStop(0, soft(typeColor, 0.5))
        area.addColorStop(1, soft(typeColor, 0.04))
        g.fillStyle = area
        g.fill()
      }
      g.strokeStyle = soft(bg, 0.6)
      g.lineWidth = 14
      line()
      g.stroke()
      g.strokeStyle = ink
      g.lineWidth = 5
      line()
      g.stroke()
      g.restore()
    }

    // Axe du temps
    g.fillStyle = muted
    g.font = font(500, 26, mono)
    for (const t of c.ticks) {
      g.textAlign = t.x <= 0 ? 'left' : 'center'
      g.fillText(t.label, px + t.x * pw, base + 44)
    }
    g.textAlign = 'left'

    // Légende
    g.font = font(500, 27, body)
    rows.forEach((row, k) => {
      const y = base + axisH + 34 + k * rowH
      let x = px
      row.forEach((it, j) => {
        // La consigne de lecture se cale à droite quand elle partage sa ligne
        if (it.key === 'hint' && j > 0) x = px + pw - it.w
        if (it.key === 'hr') {
          g.fillStyle = ink
          g.fillRect(x, y - 12, it.mark, 5)
        } else if (it.key === 'missed') {
          hatch(x, y - 22, it.mark, it.mark, ghost, 3, 9)
          g.strokeStyle = ghost
          g.lineWidth = 2
          g.strokeRect(x + 1, y - 21, it.mark - 2, it.mark - 2)
        } else if (it.mark) {
          const color = resolve(LAP_LEGEND_COLORS[it.key as keyof typeof LAP_LEGEND_COLORS] ?? LAP_NO_KIND_COLOR)
          if (it.key === 'partial') {
            g.fillStyle = soft(color, 0.3)
            g.fillRect(x, y - 22, it.mark, it.mark)
            hatch(x, y - 22, it.mark, it.mark, color, 4, 9)
          } else {
            g.beginPath()
            g.roundRect(x, y - 22, it.mark, it.mark, 5)
            g.fillStyle = color
            g.fill()
          }
        }
        g.fillStyle = muted
        g.fillText(it.label, x + (it.mark ? it.mark + 12 : 0), y)
        x += it.w + between
      })
    })
  }

  // Type, titre, date. Sans cadre au-dessus : le bloc se centre dans l'image et les chiffres grandissent
  const gap = 24
  const tileH = framed ? 180 : 236
  const valueSize = framed ? 76 : 100
  const rowsOfStats = Math.ceil(Math.min(d.stats.length, 4) / 2)
  g.font = font(700, 84)
  const titleLines = countLines(g, d.title, W - pad * 2, 2)
  const blockH = 100 + (titleLines - 1) * 96 + 64 + 66 + rowsOfStats * (tileH + gap) - gap + (d.highlight ? 124 : 0)
  const typeY = framed ? 1040 : Math.round(190 + (1650 - blockH) / 2)
  g.fillStyle = typeColor
  g.font = font(700, 34, body)
  g.fillText(d.type.toUpperCase().split('').join('\u200a'), pad, typeY)
  g.fillStyle = ink
  g.font = font(700, 84)
  const afterTitle = wrap(g, d.title, pad, typeY + 100, W - pad * 2, 96, 2)
  g.fillStyle = soft(ink, 0.65)
  g.font = font(500, 38, body)
  g.fillText(d.date, pad, afterTitle + 64)

  // Chiffres
  const top = afterTitle + 130
  const colW = (W - pad * 2 - gap) / 2
  d.stats.slice(0, 4).forEach((s, i) => {
    const x = pad + (i % 2) * (colW + gap)
    const y = top + Math.floor(i / 2) * (tileH + gap)
    roundRect(g, x, y, colW, tileH, Math.min(radius, 44))
    g.fillStyle = soft(ink, 0.07)
    g.fill()
    g.strokeStyle = soft(ink, 0.14)
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = soft(ink, 0.6)
    g.font = font(700, 26, body)
    g.fillText(s.label.toUpperCase(), x + 34, y + 58)
    g.fillStyle = ink
    g.font = font(700, valueSize)
    g.fillText(s.value, x + 34, y + tileH - 40)
    if (s.unit) {
      const vw = g.measureText(s.value).width
      g.fillStyle = soft(ink, 0.6)
      g.font = font(600, 32, body)
      g.fillText(s.unit, x + 34 + vw + 12, y + tileH - 40)
    }
  })

  if (d.highlight) {
    const y = top + rowsOfStats * (tileH + gap) - gap + 44
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

/** Nombre de lignes que prendra un texte (même découpe que « wrap », sans rien écrire). */
function countLines(g: CanvasRenderingContext2D, text: string, max: number, maxLines = 6) {
  let line = ''
  let lines = 1
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (g.measureText(test).width > max && line) {
      if (lines === maxLines) break
      line = word
      lines++
    } else line = test
  }
  return lines
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

<script setup lang="ts">
/*
 * Vraie carte du parcours, gratuite : MapLibre + tuiles OpenFreeMap (sans clé ni limite).
 * Chargée seulement dans le navigateur et seulement quand on l'affiche (environ 1 Mo).
 * Le tracé se dessine progressivement ; en attendant la carte, le tracé simple reste visible.
 * Déplacer la carte demande deux doigts, pour ne pas bloquer le défilement de la page.
 */
import type { Activity } from '~/composables/useActivities'
import type { Map as MlMap } from 'maplibre-gl'

const props = defineProps<{ activity: Activity }>()
const el = ref<HTMLElement>()
const ready = ref(false)
const failed = ref(false)
let map: MlMap | undefined
let raf = 0

const STYLE = 'https://tiles.openfreemap.org/styles/dark'
const FALLBACK = 'https://tiles.openfreemap.org/styles/positron'

/** Coordonnées [lng, lat] : la vraie trace Strava, ou en démo un parcours inventé posé sur Bruxelles. */
const coords = computed<[number, number][]>(() => {
  const a = props.activity
  if (a.route) return decodePolyline(a.route).map(([la, lo]) => [lo, la])
  if (!a.stravaId) return demoRoute(a.id, a.type).map(([y, x]) => [4.3528 + x * 0.016, 50.8466 + y * 0.011])
  return []
})

onMounted(async () => {
  if (coords.value.length < 2 || !el.value) return
  try {
    const [ml, { default: workerUrl }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
    ml.setWorkerUrl(workerUrl)
    const pts = coords.value
    const lngs = pts.map((p) => p[0])
    const lats = pts.map((p) => p[1])
    const color = getComputedStyle(el.value).getPropertyValue('--c').trim() || '#4da3ff'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const m = new ml.Map({
      container: el.value,
      style: STYLE,
      bounds: [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      fitBoundsOptions: { padding: { top: 36, right: 36, bottom: 110, left: 36 } },
      attributionControl: { compact: true },
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: 0,
    })
    map = m

    let styled = false
    m.on('error', () => {
      // Style sombre indisponible : style clair de secours, puis on abandonne
      if (!styled && map) {
        styled = true
        map.setStyle(FALLBACK)
      }
    })

    m.on('load', () => {
      if (!map) return
      styled = true
      map.addSource('route', { type: 'geojson', data: line(reduce ? pts : pts.slice(0, 2)) })
      map.addLayer({ id: 'glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': 12, 'line-blur': 8, 'line-opacity': 0.55 } })
      map.addLayer({ id: 'line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': 4 } })
      map.addSource('ends', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [pts[0]!, pts[pts.length - 1]!].map((c, i) => ({ type: 'Feature', properties: { end: i }, geometry: { type: 'Point', coordinates: c } })),
        },
      })
      map.addLayer({
        id: 'ends',
        type: 'circle',
        source: 'ends',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'end'], 1], 7, 5],
          'circle-color': ['case', ['==', ['get', 'end'], 1], color, '#0b0d17'],
          'circle-stroke-color': ['case', ['==', ['get', 'end'], 1], '#ffffff', color],
          'circle-stroke-width': 2.5,
        },
      })
      ready.value = true
      if (!reduce) draw(pts)
    })
  } catch {
    failed.value = true
  }
})

function line(c: [number, number][]) {
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: c } }
}

/** Le tracé avance du départ à l'arrivée en 1,8 s. */
function draw(pts: [number, number][]) {
  const t0 = performance.now()
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / 1800)
    const eased = 1 - Math.pow(1 - k, 3)
    const n = Math.max(2, Math.round(eased * pts.length))
    ;(map?.getSource('route') as { setData?: (d: unknown) => void } | undefined)?.setData?.(line(pts.slice(0, n)))
    if (k < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  map?.remove()
})
</script>

<template>
  <div class="route-map" :class="{ ready }" :style="{ '--c': RUN_TYPES[activity.type].color }">
    <div class="fallback" aria-hidden="true">
      <RouteTrace :activity="activity" :width="1.6" :delay="200" />
    </div>
    <div ref="el" class="gl" role="img" :aria-label="`Carte du parcours : ${activity.garminName}`" />
  </div>
</template>

<style scoped>
.route-map {
  position: relative;
  width: 100%;
  height: 100%;
}

.fallback {
  position: absolute;
  inset: 0;
  padding: 26px 30px 90px;
  transition: opacity 0.6s ease;
}

.gl {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.8s ease;
}

.ready .gl {
  opacity: 1;
}

.ready .fallback {
  opacity: 0;
}

/* Attribution discrète, en haut pour ne pas passer sous le titre */
.gl :deep(.maplibregl-ctrl-bottom-right) {
  top: 0;
  bottom: auto;
}

.gl :deep(.maplibregl-ctrl-attrib) {
  margin: 8px 8px 0 0;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  font-size: 10px;
}

.gl :deep(.maplibregl-ctrl-attrib a) {
  color: inherit;
}

.gl :deep(.maplibregl-ctrl-attrib-button) {
  filter: invert(1);
}

.gl :deep(.maplibregl-cooperative-gesture-screen) {
  font-family: var(--font-body);
  font-size: 15px;
  border-radius: inherit;
}
</style>

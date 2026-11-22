/** Mode démo : données fictives, uniquement à la demande et toujours signalé à l'écran. */
export function useDemo() {
  const flag = useCookie<boolean>(DEMO_COOKIE, { default: () => false, maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
  const { accounts } = useAccounts()
  const active = computed(() => flag.value === true && !accounts.value.strava.connected)
  const stamp = useDemoStamp()

  /** Données de démo du jour (ou rien), sans toucher à l'état des connexions. */
  function fillData(on: boolean) {
    const demo = on ? demoData() : null
    useState('activities').value = demo?.activities ?? []
    useState('history').value = demo?.history ?? []
    useState('notifications').value = demo?.notifications ?? []
    useDebriefState().value = demo?.debriefs ?? {}
    useTypeOverrides().value = {}
    useState('streams').value = {}
    usePublished().value = {}
    usePlan().reset(on)
    useFitness().reset(on)
    stamp.value = on ? { version: DEMO_VERSION, day: TODAY } : null
  }

  function fill(on: boolean) {
    fillData(on)
    useHealth().reset(on)
  }

  async function enter() {
    flag.value = true
    fill(true)
    await navigateTo('/')
  }

  async function exit() {
    flag.value = false
    fill(false)
    await navigateTo('/')
  }

  /*
   * Aligne les données sur le drapeau (au démarrage, sans compte connecté).
   * Une démo gardée d'un autre jour ou d'une autre version est régénérée : sinon « hier » désignerait
   * une course d'avant-hier, et une ancienne démo n'aurait ni tours ni débriefs. L'état des connexions
   * est gardé (une lecture en échec montrée en démo le reste).
   */
  function reset() {
    const activities = useState<{ stravaId?: number }[]>('activities')
    const hasReal = activities.value.some((a) => a.stravaId)
    if (flag.value) {
      const stale = !stamp.value || stamp.value.version !== DEMO_VERSION || stamp.value.day !== TODAY
      if (hasReal || !activities.value.length) fill(true)
      else if (stale) {
        fillData(true)
        useHealth().refreshDemo(false, true)
      }
    } else if (activities.value.length) fill(false)
  }

  /** Un vrai compte vient d'être connecté : on quitte la démo sans bruit. */
  function leaveSilently() {
    if (!flag.value) return
    flag.value = false
    stamp.value = null
    useState('history').value = []
    useState('notifications').value = []
    useDebriefState().value = {}
    useTypeOverrides().value = {}
    useState('streams').value = {}
    usePublished().value = {}
    useHealth().reset(false)
    usePlan().reset(false)
    useFitness().reset(false)
  }

  return { active, enter, exit, reset, leaveSilently }
}

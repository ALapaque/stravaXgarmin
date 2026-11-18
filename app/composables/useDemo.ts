/** Mode démo : données fictives, uniquement à la demande et toujours signalé à l'écran. */
export function useDemo() {
  const flag = useCookie<boolean>(DEMO_COOKIE, { default: () => false, maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
  const { accounts } = useAccounts()
  const active = computed(() => flag.value === true && !accounts.value.strava.connected)

  function fill(on: boolean) {
    useState('activities').value = on ? demoActivities() : []
    useState('history').value = on ? demoHistory() : []
    useState('notifications').value = on ? demoNotifications() : []
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

  /** Aligne les données sur le drapeau (au démarrage, sans compte connecté). */
  function reset() {
    const activities = useState<{ stravaId?: number }[]>('activities')
    const hasReal = activities.value.some((a) => a.stravaId)
    if (flag.value) {
      if (hasReal || !activities.value.length) fill(true)
    } else if (activities.value.length) fill(false)
  }

  /** Un vrai compte vient d'être connecté : on quitte la démo sans bruit. */
  function leaveSilently() {
    if (!flag.value) return
    flag.value = false
    useState('history').value = []
    useState('notifications').value = []
  }

  return { active, enter, exit, reset, leaveSilently }
}

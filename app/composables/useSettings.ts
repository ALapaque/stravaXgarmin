export function useSettings() {
  return useState('settings', () => ({
    autoSync: true,
    notifications: true,
    overwriteEdited: false,
    accounts: { strava: true, garmin: true, chatgpt: false },
  }))
}

export function useToast() {
  const message = useState<string | null>('toast', () => null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(text: string) {
    message.value = text
    clearTimeout(timer)
    timer = setTimeout(() => (message.value = null), 2600)
  }

  return { message, show }
}

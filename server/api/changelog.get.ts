/** Version déployée et notes de version, lues dans CHANGELOG.md au moment du build. */
export default defineEventHandler(() => {
  const { changelog, public: pub } = useRuntimeConfig()
  return { version: pub.version as string, releases: parseChangelog(changelog as string) }
})

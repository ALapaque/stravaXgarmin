export default defineEventHandler(async (event) => {
  await (await aiSession(event)).clear()
  return { ok: true }
})

export default defineEventHandler(async (event) => {
  await (await openaiSession(event)).clear()
  return { ok: true }
})

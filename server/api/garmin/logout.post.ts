export default defineEventHandler(async (event) => {
  await (await garminSession(event)).clear()
  await (await garminMfaSession(event)).clear()
  return { ok: true }
})

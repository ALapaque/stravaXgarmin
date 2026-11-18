export default defineEventHandler(async (event) => {
  await (await stravaSession(event)).clear()
  return { ok: true }
})

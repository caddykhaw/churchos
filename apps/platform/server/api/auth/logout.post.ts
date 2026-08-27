export default defineEventHandler((event) => {
  deleteCookie(event, '__session', { path: '/' })
  return { success: true }
})

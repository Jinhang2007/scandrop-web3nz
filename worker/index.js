export default {
  async fetch(request, env) {
    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response('ScanDrop is ready, but its static assets are unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  },
}

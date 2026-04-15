export function getStatusClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('tbd') || s.includes('tbc') || s.includes('to be confirmed') || s.includes('hold')) return 'badge-hold'
  if (s.includes('go') || s.includes('in flight') || s.includes('inflight') || s.includes('green') || s.includes('confirmed') || s.includes('scheduled')) return 'badge-go'
  if (s.includes('success')) return 'badge-success'
  if (s.includes('fail')) return 'badge-failure'
  return 'badge-default'
}

export function getStatusClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go') || s.includes('in flight') || s.includes('inflight') || s.includes('green')) return 'badge-go'
  if (s.includes('hold') || s.includes('tbd') || s.includes('tbc')) return 'badge-hold'
  if (s.includes('success')) return 'badge-success'
  if (s.includes('fail')) return 'badge-failure'
  return 'badge-default'
}

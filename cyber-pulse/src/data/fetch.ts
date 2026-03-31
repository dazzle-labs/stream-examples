export function fetchSource(url: string, init?: RequestInit): Promise<Response> {
  if (import.meta.env.DEV) {
    return fetch(`/cors-proxy?url=${encodeURIComponent(url)}`, init)
  }
  return fetch(url, {
    ...init,
    headers: {
      'User-Agent': 'CyberPulse/1.0 (security-dashboard)',
      ...init?.headers,
    },
  })
}

export function cachedFetch<T>(
  key: string,
  url: string,
  parse: (text: string) => T,
  maxAgeMs: number,
  init?: RequestInit,
): Promise<T> {
  const cached = localStorage.getItem(key)
  const cachedTime = localStorage.getItem(`${key}:time`)
  if (cached && cachedTime) {
    const age = Date.now() - Number(cachedTime)
    if (age < maxAgeMs) {
      return Promise.resolve(parse(cached))
    }
  }
  return fetchSource(url, init)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.text()
    })
    .then(text => {
      localStorage.setItem(key, text)
      localStorage.setItem(`${key}:time`, String(Date.now()))
      return parse(text)
    })
}

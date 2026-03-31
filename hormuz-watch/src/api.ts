const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

export function yahooUrl(path: string): string {
  return isDev ? `/api/yahoo${path}` : `https://query1.finance.yahoo.com${path}`
}

export function googleNewsUrl(path: string): string {
  return isDev ? `/api/news${path}` : `https://news.google.com${path}`
}

export function centcomUrl(path: string): string {
  return isDev ? `/api/centcom${path}` : `https://www.centcom.mil${path}`
}

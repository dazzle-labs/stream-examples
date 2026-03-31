const isDev = import.meta.env.DEV

export function yahooUrl(path: string): string {
  return isDev ? `/api/yahoo${path}` : `https://query1.finance.yahoo.com${path}`
}

export function googleNewsUrl(path: string): string {
  return isDev ? `/api/news${path}` : `https://news.google.com${path}`
}

export function centcomUrl(path: string): string {
  return isDev ? `/api/centcom${path}` : `https://www.centcom.mil${path}`
}

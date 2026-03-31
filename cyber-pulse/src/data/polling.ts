import type {
  InfoconLevel,
  TopPort,
  TopIP,
  CVEEntry,
  KEVEntry,
  FeodoC2,
  Breach,
  RansomwarePayment,
  ServiceStatus,
  OONIIncident,
  FeedItem,
  CommunityPost,
} from './types'
import { store, addTickerEvent, updateBroadcastMode } from './store'
import { fetchSource, cachedFetch } from './fetch'

const CVE_REGEX = /CVE-\d{4}-\d{4,}/g

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function getNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  return typeof value === 'number' ? value : 0
}

function getArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key]
  return Array.isArray(value) ? value : []
}

function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? ''
}

function extractCVEIds(text: string): string[] {
  return [...new Set(text.match(CVE_REGEX) ?? [])]
}

function severityFromCvss(score: number): string {
  if (score >= 9.0) return 'critical'
  if (score >= 7.0) return 'high'
  if (score >= 4.0) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

function safeJson(text: string): unknown {
  try {
    const result: unknown = JSON.parse(text)
    return result
  } catch {
    return null
  }
}

function pollInterval(callback: () => void, intervalMs: number) {
  callback()
  setInterval(callback, intervalMs)
}

function buildFeedQueue() {
  const items: FeedItem[] = []

  for (const kev of store.kevEntries) {
    items.push({
      id: kev.cveID,
      type: 'kev',
      title: kev.vulnerabilityName,
      description: kev.shortDescription,
      severity: 'critical',
      cvssScore: 10,
      source: 'CISA KEV',
      timestamp: kev.dateAdded,
      isKEV: true,
      epssScore: 0,
      vendorProject: kev.vendorProject,
      product: kev.product,
    })
  }

  for (const cve of store.recentCVEs) {
    if (items.some(item => item.id === cve.id)) continue
    items.push({
      id: cve.id,
      type: 'cve',
      title: cve.id,
      description: cve.description,
      severity: cve.severity,
      cvssScore: cve.cvssScore,
      source: 'NVD',
      timestamp: cve.published,
      isKEV: cve.isKEV,
      epssScore: cve.epssScore,
      vendorProject: cve.vendorProject,
      product: cve.product,
    })
  }

  for (const advisory of store.githubAdvisories) {
    if (items.some(item => item.id === advisory.id)) continue
    items.push({
      id: advisory.id,
      type: 'advisory',
      title: advisory.id,
      description: advisory.description,
      severity: advisory.severity,
      cvssScore: advisory.cvssScore,
      source: 'GitHub Advisory',
      timestamp: advisory.published,
      isKEV: advisory.isKEV,
      epssScore: advisory.epssScore,
      vendorProject: advisory.vendorProject,
      product: advisory.product,
    })
  }

  for (const rssItem of store.rssItems) {
    items.push({
      id: rssItem.id,
      type: 'news',
      title: rssItem.title,
      description: '',
      severity: 'info',
      cvssScore: 0,
      source: rssItem.source,
      timestamp: rssItem.timestamp,
      isKEV: false,
      epssScore: 0,
      vendorProject: '',
      product: '',
    })
  }

  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
    none: 5,
  }

  items.sort((itemA, itemB) => {
    if (itemA.isKEV && !itemB.isKEV) return -1
    if (!itemA.isKEV && itemB.isKEV) return 1
    const severityA = severityOrder[itemA.severity] ?? 5
    const severityB = severityOrder[itemB.severity] ?? 5
    if (severityA !== severityB) return severityA - severityB
    return itemB.cvssScore - itemA.cvssScore
  })

  store.feedQueue = items.slice(0, 200)
}

function buildCommunityPosts() {
  const posts: CommunityPost[] = [
    ...store.communityPosts,
    ...store.blueskyPosts,
    ...store.rssItems,
  ]

  const seen = new Set<string>()
  const deduped: CommunityPost[] = []
  for (const post of posts) {
    if (!seen.has(post.id)) {
      seen.add(post.id)
      deduped.push(post)
    }
  }

  deduped.sort((postA, postB) => {
    const timeA = new Date(postA.timestamp).getTime()
    const timeB = new Date(postB.timestamp).getTime()
    return timeB - timeA
  })

  store.communityPosts = deduped.slice(0, 100)
}

function parseNvdCves(text: string): CVEEntry[] {
  const parsed = safeJson(text)
  if (!isRecord(parsed)) return []
  const vulnerabilities = getArray(parsed, 'vulnerabilities')
  const results: CVEEntry[] = []

  for (const entry of vulnerabilities) {
    if (!isRecord(entry)) continue
    const cve = entry['cve']
    if (!isRecord(cve)) continue

    const id = getString(cve, 'id')
    const descriptions = getArray(cve, 'descriptions')
    const firstDescription = descriptions[0]
    const description = isRecord(firstDescription) ? getString(firstDescription, 'value') : ''

    const published = getString(cve, 'published')
    const lastModified = getString(cve, 'lastModified')

    let cvssScore = 0
    const metrics = cve['metrics']
    if (isRecord(metrics)) {
      const cvssV31 = getArray(metrics, 'cvssMetricV31')
      const firstMetric = cvssV31[0]
      if (isRecord(firstMetric)) {
        const cvssData = firstMetric['cvssData']
        if (isRecord(cvssData)) {
          cvssScore = getNumber(cvssData, 'baseScore')
        }
      }
    }

    results.push({
      id,
      description,
      cvssScore,
      severity: severityFromCvss(cvssScore),
      published,
      lastModified,
      vendorProject: '',
      product: '',
      isKEV: store.kevEntries.some(kev => kev.cveID === id),
      epssScore: 0,
      epssPercentile: 0,
    })
  }

  return results
}

function parseKev(text: string): KEVEntry[] {
  const parsed = safeJson(text)
  if (!isRecord(parsed)) return []
  const vulnerabilities = getArray(parsed, 'vulnerabilities')
  const results: KEVEntry[] = []

  for (const entry of vulnerabilities) {
    if (!isRecord(entry)) continue
    results.push({
      cveID: getString(entry, 'cveID'),
      vendorProject: getString(entry, 'vendorProject'),
      product: getString(entry, 'product'),
      vulnerabilityName: getString(entry, 'vulnerabilityName'),
      dateAdded: getString(entry, 'dateAdded'),
      shortDescription: getString(entry, 'shortDescription'),
      knownRansomwareCampaignUse: getString(entry, 'knownRansomwareCampaignUse'),
    })
  }

  return results
}

function parseGithubAdvisories(text: string): CVEEntry[] {
  const parsed = safeJson(text)
  if (!Array.isArray(parsed)) return []
  const results: CVEEntry[] = []

  for (const entry of parsed) {
    if (!isRecord(entry)) continue
    const ghsaId = getString(entry, 'ghsa_id')
    const cveId = getString(entry, 'cve_id')
    const summary = getString(entry, 'summary')
    const severity = getString(entry, 'severity').toLowerCase()
    const publishedAt = getString(entry, 'published_at')

    const cvssObj = entry['cvss']
    const cvssScore = isRecord(cvssObj) ? getNumber(cvssObj, 'score') : 0

    results.push({
      id: cveId || ghsaId,
      description: summary,
      cvssScore,
      severity: severity || severityFromCvss(cvssScore),
      published: publishedAt,
      lastModified: publishedAt,
      vendorProject: '',
      product: '',
      isKEV: false,
      epssScore: 0,
      epssPercentile: 0,
    })
  }

  return results
}

function parseFeodo(text: string): FeodoC2[] {
  const parsed = safeJson(text)
  if (!Array.isArray(parsed)) return []
  const results: FeodoC2[] = []

  for (const entry of parsed) {
    if (!isRecord(entry)) continue
    results.push({
      ip_address: getString(entry, 'ip_address'),
      port: getNumber(entry, 'port'),
      status: getString(entry, 'status'),
      hostname: getString(entry, 'hostname'),
      as_number: getNumber(entry, 'as_number'),
      as_name: getString(entry, 'as_name'),
      country: getString(entry, 'country'),
      first_seen: getString(entry, 'first_seen'),
      last_online: getString(entry, 'last_online'),
      malware: getString(entry, 'malware'),
    })
  }

  return results
}

function parseStatuspage(name: string, text: string): ServiceStatus | null {
  const parsed = safeJson(text)
  if (!isRecord(parsed)) return null
  const page = parsed['page']
  const status = parsed['status']
  if (!isRecord(page) || !isRecord(status)) return null

  return {
    name: getString(page, 'name') || name,
    status: getString(status, 'description'),
    description: getString(status, 'description'),
    updatedAt: getString(page, 'updated_at'),
    indicator: getString(status, 'indicator'),
  }
}

function parseGcpIncidents(text: string): ServiceStatus | null {
  const parsed = safeJson(text)
  if (!Array.isArray(parsed)) return null
  const activeIncidents = parsed.filter(
    entry => isRecord(entry) && getString(entry, 'end') === '',
  )
  if (activeIncidents.length > 0) {
    return {
      name: 'Google Cloud',
      status: `${activeIncidents.length} active incident(s)`,
      description: `${activeIncidents.length} active incident(s)`,
      updatedAt: new Date().toISOString(),
      indicator: 'major',
    }
  }
  return {
    name: 'Google Cloud',
    status: 'All Services Available',
    description: 'All Services Available',
    updatedAt: new Date().toISOString(),
    indicator: 'none',
  }
}

function parseAwsHealth(text: string): ServiceStatus | null {
  const cleaned = text.replace(/^\uFEFF/, '')
  const parsed = safeJson(cleaned)
  if (!isRecord(parsed)) return null

  const archive = getArray(parsed, 'archive')
  const current = getArray(parsed, 'current')
  const activeCount = current.length

  if (activeCount > 0) {
    return {
      name: 'AWS',
      status: `${activeCount} active event(s)`,
      description: `${activeCount} active event(s)`,
      updatedAt: new Date().toISOString(),
      indicator: 'major',
    }
  }
  return {
    name: 'AWS',
    status: `Operational (${archive.length} archived)`,
    description: 'Operational',
    updatedAt: new Date().toISOString(),
    indicator: 'none',
  }
}

function parseHibpBreaches(text: string): Breach[] {
  const parsed = safeJson(text)
  if (!Array.isArray(parsed)) return []
  const results: Breach[] = []

  for (const entry of parsed) {
    if (!isRecord(entry)) continue
    results.push({
      Name: getString(entry, 'Name'),
      Title: getString(entry, 'Title'),
      Domain: getString(entry, 'Domain'),
      BreachDate: getString(entry, 'BreachDate'),
      PwnCount: getNumber(entry, 'PwnCount'),
      DataClasses: getArray(entry, 'DataClasses').filter(
        (item): item is string => typeof item === 'string',
      ),
      IsVerified: entry['IsVerified'] === true,
    })
  }

  return results
}

function parseRansomwhere(text: string): RansomwarePayment[] {
  const parsed = safeJson(text)
  if (!isRecord(parsed)) return []
  const resultArray = getArray(parsed, 'result')
  const results: RansomwarePayment[] = []

  for (const entry of resultArray) {
    if (!isRecord(entry)) continue
    const transactions = getArray(entry, 'transactions')
    const parsedTransactions: Array<{ amount: number; amountUSD: number; time: string }> = []

    for (const transaction of transactions) {
      if (!isRecord(transaction)) continue
      parsedTransactions.push({
        amount: getNumber(transaction, 'amount'),
        amountUSD: getNumber(transaction, 'amountUSD'),
        time: getString(transaction, 'time'),
      })
    }

    results.push({
      address: getString(entry, 'address'),
      blockchain: getString(entry, 'blockchain'),
      transactions: parsedTransactions,
    })
  }

  return results
}

function parseOoni(text: string): OONIIncident[] {
  const parsed = safeJson(text)
  if (!isRecord(parsed)) return []
  const incidents = getArray(parsed, 'incidents')
  const results: OONIIncident[] = []

  for (const entry of incidents) {
    if (!isRecord(entry)) continue
    results.push({
      id: getString(entry, 'id'),
      title: getString(entry, 'title'),
      short_description: getString(entry, 'short_description'),
      start_time: getString(entry, 'start_time'),
      end_time: getString(entry, 'end_time'),
      CCs: getArray(entry, 'CCs').filter((item): item is string => typeof item === 'string'),
      ASNs: getArray(entry, 'ASNs').filter((item): item is number => typeof item === 'number'),
      published: entry['published'] === true,
      event_type: getString(entry, 'event_type'),
    })
  }

  return results
}

function parseHnAlgolia(text: string): CommunityPost[] {
  const parsed = safeJson(text)
  if (!isRecord(parsed)) return []
  const hits = getArray(parsed, 'hits')
  const results: CommunityPost[] = []

  for (const hit of hits) {
    if (!isRecord(hit)) continue
    const title = getString(hit, 'title')
    const objectID = getString(hit, 'objectID')
    const url = getString(hit, 'url')
    const points = getNumber(hit, 'points')
    const createdAt = getString(hit, 'created_at')

    results.push({
      id: `hn-${objectID}`,
      source: 'hn',
      title,
      url: url || `https://news.ycombinator.com/item?id=${objectID}`,
      score: points,
      timestamp: createdAt,
      cveIds: extractCVEIds(title),
    })
  }

  return results
}

function parseReddit(text: string): CommunityPost[] {
  const parsed = safeJson(text)
  if (!isRecord(parsed)) return []
  const data = parsed['data']
  if (!isRecord(data)) return []
  const children = getArray(data, 'children')
  const results: CommunityPost[] = []

  for (const child of children) {
    if (!isRecord(child)) continue
    const childData = child['data']
    if (!isRecord(childData)) continue

    const title = getString(childData, 'title')
    const permalink = getString(childData, 'permalink')
    const score = getNumber(childData, 'score')
    const createdUtc = getNumber(childData, 'created_utc')
    const id = getString(childData, 'id')

    results.push({
      id: `reddit-${id}`,
      source: 'reddit',
      title,
      url: permalink ? `https://www.reddit.com${permalink}` : '',
      score,
      timestamp: new Date(createdUtc * 1000).toISOString(),
      cveIds: extractCVEIds(title),
    })
  }

  return results
}

function parseMastodon(text: string, sourceLabel: 'mastodon'): CommunityPost[] {
  const parsed = safeJson(text)
  if (!Array.isArray(parsed)) return []
  const results: CommunityPost[] = []

  for (const entry of parsed) {
    if (!isRecord(entry)) continue
    const id = getString(entry, 'id')
    const content = getString(entry, 'content')
    const createdAt = getString(entry, 'created_at')
    const url = getString(entry, 'url')
    const plainText = stripHtml(content)
    const reblogsCount = getNumber(entry, 'reblogs_count')
    const favouritesCount = getNumber(entry, 'favourites_count')

    results.push({
      id: `mastodon-${id}`,
      source: sourceLabel,
      title: plainText.slice(0, 200),
      url,
      score: reblogsCount + favouritesCount,
      timestamp: createdAt,
      cveIds: extractCVEIds(plainText),
    })
  }

  return results
}

function parseRssFeed(text: string, sourceName: string): CommunityPost[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const items = doc.querySelectorAll('item, entry')
  const results: CommunityPost[] = []

  for (const item of items) {
    const title = item.querySelector('title')?.textContent ?? ''
    const link = item.querySelector('link')?.textContent
      ?? item.querySelector('link')?.getAttribute('href')
      ?? ''
    const pubDate = item.querySelector('pubDate, published, updated')?.textContent ?? ''
    const description = item.querySelector('description, summary, content')?.textContent ?? ''

    results.push({
      id: `rss-${sourceName}-${link || title}`,
      source: 'rss',
      title,
      url: link,
      score: 0,
      timestamp: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      cveIds: extractCVEIds(`${title} ${description}`),
    })
  }

  return results
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetchSource(url)
  if (!response.ok) return null
  const text = await response.text()
  return safeJson(text)
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchSource(url)
  if (!response.ok) return ''
  return response.text()
}

function isInfoconLevel(value: string): value is InfoconLevel {
  return value === 'green' || value === 'yellow' || value === 'orange' || value === 'red'
}

async function pollSansInfocon() {
  try {
    const data = await fetchJson('https://isc.sans.edu/api/infocon?json')
    if (!isRecord(data)) return
    const status = getString(data, 'status')
    if (isInfoconLevel(status)) {
      const previous = store.sansInfocon
      store.sansInfocon = status
      store.lastUpdated['sansInfocon'] = Date.now()
      if (status !== previous && previous !== 'green') {
        addTickerEvent('SANS ISC', `Infocon changed to ${status.toUpperCase()}`, status === 'red' ? 'critical' : 'warning')
      }
    }
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollSansTopPorts() {
  try {
    const data = await fetchJson('https://isc.sans.edu/api/topports/records/20?json')
    if (!Array.isArray(data)) return
    const ports: TopPort[] = []
    for (const entry of data) {
      if (!isRecord(entry)) continue
      ports.push({
        targetport: getNumber(entry, 'targetport'),
        records: getNumber(entry, 'records'),
        sources: getNumber(entry, 'sources'),
        targets: getNumber(entry, 'targets'),
      })
    }
    store.sansTopPorts = ports
    store.lastUpdated['sansTopPorts'] = Date.now()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollSansTopIPs() {
  try {
    const data = await fetchJson('https://isc.sans.edu/api/topips/records/20?json')
    if (!Array.isArray(data)) return
    const ips: TopIP[] = []
    for (const entry of data) {
      if (!isRecord(entry)) continue
      ips.push({
        source: getString(entry, 'source'),
        count: getNumber(entry, 'count'),
        attacks: getNumber(entry, 'attacks'),
        firstseen: getString(entry, 'firstseen'),
        lastseen: getString(entry, 'lastseen'),
      })
    }
    store.sansTopIPs = ips
    store.lastUpdated['sansTopIPs'] = Date.now()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollStatuspages() {
  const pages: Array<{ name: string; url: string }> = [
    { name: 'GitHub', url: 'https://www.githubstatus.com/api/v2/status.json' },
    { name: 'Cloudflare', url: 'https://www.cloudflarestatus.com/api/v2/status.json' },
    { name: 'Discord', url: 'https://discordstatus.com/api/v2/status.json' },
    { name: 'OpenAI', url: 'https://status.openai.com/api/v2/status.json' },
    { name: 'Datadog', url: 'https://status.datadoghq.com/api/v2/status.json' },
    { name: 'Reddit', url: 'https://www.redditstatus.com/api/v2/status.json' },
    { name: 'Atlassian', url: 'https://status.atlassian.com/api/v2/status.json' },
  ]

  const results = await Promise.allSettled(
    pages.map(async (page) => {
      const text = await fetchText(page.url)
      if (!text) return
      const status = parseStatuspage(page.name, text)
      if (status) {
        const previous = store.serviceStatuses[page.name]
        store.serviceStatuses[page.name] = status
        if (status.indicator !== 'none' && previous?.indicator === 'none') {
          addTickerEvent('Status', `${status.name} degraded: ${status.description}`, 'warning')
        }
      }
    }),
  )

  void results

  try {
    const gcpText = await fetchText('https://status.cloud.google.com/incidents.json')
    if (gcpText) {
      const gcpStatus = parseGcpIncidents(gcpText)
      if (gcpStatus) {
        store.serviceStatuses['GCP'] = gcpStatus
      }
    }
  } catch { /* silent */ }

  try {
    const awsText = await fetchText('https://health.aws.amazon.com/public/currentevents')
    if (awsText) {
      const awsStatus = parseAwsHealth(awsText)
      if (awsStatus) {
        store.serviceStatuses['AWS'] = awsStatus
      }
    }
  } catch { /* silent */ }

  store.degradedServiceCount = Object.values(store.serviceStatuses)
    .filter(status => status.indicator !== 'none').length
  store.lastUpdated['serviceStatuses'] = Date.now()
  updateBroadcastMode()
}

async function pollNvdCves() {
  try {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?lastModStartDate=${twoHoursAgo.toISOString()}&lastModEndDate=${now.toISOString()}`
    const text = await fetchText(url)
    if (!text) return
    const cves = parseNvdCves(text)
    const previousCount = store.recentCVEs.length

    for (const cve of cves) {
      cve.isKEV = store.kevEntries.some(kev => kev.cveID === cve.id)
    }

    store.recentCVEs = cves
    store.lastUpdated['recentCVEs'] = Date.now()

    const today = new Date().toISOString().split('T')[0] ?? ''
    store.cvesPublishedToday = cves.filter(
      cve => cve.published.startsWith(today),
    ).length

    if (cves.length > previousCount) {
      const newCritical = cves.filter(
        cve => cve.severity === 'critical' && !store.feedQueue.some(item => item.id === cve.id),
      )
      for (const cve of newCritical) {
        addTickerEvent('NVD', `New critical CVE: ${cve.id} (CVSS ${cve.cvssScore})`, 'critical')
      }
    }

    buildFeedQueue()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollGithubAdvisories() {
  try {
    const text = await fetchText('https://api.github.com/advisories?per_page=20')
    if (!text) return
    const advisories = parseGithubAdvisories(text)
    store.githubAdvisories = advisories
    store.lastUpdated['githubAdvisories'] = Date.now()
    buildFeedQueue()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollCisaKev() {
  try {
    const kevEntries = await cachedFetch(
      'cyber-pulse:kev',
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      parseKev,
      900_000,
    )
    const previousCount = store.kevEntries.length
    store.kevEntries = kevEntries
    store.lastUpdated['kevEntries'] = Date.now()

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? ''
    store.kevAdditionsThisWeek = kevEntries.filter(
      kev => kev.dateAdded >= oneWeekAgo,
    ).length

    if (kevEntries.length > previousCount && previousCount > 0) {
      addTickerEvent('CISA KEV', `${kevEntries.length - previousCount} new actively exploited vulnerabilities`, 'critical')
    }

    for (const cve of store.recentCVEs) {
      cve.isKEV = kevEntries.some(kev => kev.cveID === cve.id)
    }

    buildFeedQueue()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollHibpBreaches() {
  try {
    const breaches = await cachedFetch(
      'cyber-pulse:hibp',
      'https://haveibeenpwned.com/api/v3/breaches',
      parseHibpBreaches,
      900_000,
    )
    store.breaches = breaches

    const sorted = [...breaches].sort(
      (breachA, breachB) => new Date(breachB.BreachDate).getTime() - new Date(breachA.BreachDate).getTime(),
    )
    const latest = sorted[0]
    if (latest) {
      if (!store.latestBreach || store.latestBreach.Name !== latest.Name) {
        addTickerEvent('HIBP', `Latest breach: ${latest.Title} (${latest.PwnCount.toLocaleString()} accounts)`, 'warning')
      }
      store.latestBreach = latest
    }

    store.lastUpdated['breaches'] = Date.now()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollRansomwhere() {
  try {
    const payments = await cachedFetch(
      'cyber-pulse:ransomwhere',
      'https://api.ransomwhe.re/export',
      parseRansomwhere,
      3_600_000,
    )
    store.ransomwarePayments = payments
    store.lastUpdated['ransomwarePayments'] = Date.now()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollFeodoTracker() {
  try {
    const text = await fetchText('https://feodotracker.abuse.ch/downloads/ipblocklist.json')
    if (!text) return
    const c2s = parseFeodo(text)
    store.feodoC2s = c2s
    store.activeC2Count = c2s.filter(c2 => c2.status === 'online').length
    store.lastUpdated['feodoC2s'] = Date.now()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollOoni() {
  try {
    const text = await fetchText('https://api.ooni.io/api/v1/incidents/search?limit=10&only_ongoing=true')
    if (!text) return
    const incidents = parseOoni(text)
    const previousCount = store.ooniIncidents.length
    store.ooniIncidents = incidents
    store.lastUpdated['ooniIncidents'] = Date.now()

    if (incidents.length > previousCount && previousCount > 0) {
      const newest = incidents[0]
      if (newest) {
        addTickerEvent('OONI', `Internet censorship incident: ${newest.title}`, 'warning')
      }
    }

    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollHnAlgolia() {
  try {
    const text = await fetchText(
      'https://hn.algolia.com/api/v1/search_by_date?query=CVE+OR+vulnerability+OR+breach+OR+ransomware&tags=story&hitsPerPage=20',
    )
    if (!text) return
    const posts = parseHnAlgolia(text)
    const existingNonHn = store.communityPosts.filter(post => post.source !== 'hn')
    store.communityPosts = [...posts, ...existingNonHn]
    store.lastUpdated['hnAlgolia'] = Date.now()
    buildCommunityPosts()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollReddit() {
  try {
    const netsecText = await fetchText('https://www.reddit.com/r/netsec/new.json?limit=10')
    const netsecPosts = netsecText ? parseReddit(netsecText) : []

    const existingNonReddit = store.communityPosts.filter(post => post.source !== 'reddit')
    store.communityPosts = [...netsecPosts, ...existingNonReddit]
    store.lastUpdated['reddit'] = Date.now()
    buildCommunityPosts()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollMastodon() {
  try {
    const infosecText = await fetchText('https://infosec.exchange/api/v1/timelines/public?local=true&limit=40')
    const infosecPosts = infosecText ? parseMastodon(infosecText, 'mastodon') : []

    const cveText = await fetchText('https://mastodon.social/api/v1/timelines/tag/cve?limit=40')
    const cvePosts = cveText ? parseMastodon(cveText, 'mastodon') : []

    const existingNonMastodon = store.communityPosts.filter(post => post.source !== 'mastodon')
    store.communityPosts = [...infosecPosts, ...cvePosts, ...existingNonMastodon]
    store.lastUpdated['mastodon'] = Date.now()
    buildCommunityPosts()
    updateBroadcastMode()
  } catch { /* silent */ }
}

async function pollRssFeeds() {
  const feeds: Array<{ name: string; url: string }> = [
    { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
    { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
    { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  ]

  const allItems: CommunityPost[] = []

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const text = await fetchText(feed.url)
      if (!text) return
      const items = parseRssFeed(text, feed.name)
      allItems.push(...items)
    }),
  )

  void results

  store.rssItems = allItems
  store.lastUpdated['rssItems'] = Date.now()
  buildFeedQueue()
  buildCommunityPosts()
  updateBroadcastMode()
}

export function startPolling() {
  pollInterval(() => {
    void pollSansInfocon()
    void pollSansTopPorts()
    void pollSansTopIPs()
  }, 30_000)

  pollInterval(() => {
    void pollStatuspages()
  }, 60_000)

  pollInterval(() => {
    void pollHnAlgolia()
    void pollReddit()
  }, 120_000)

  pollInterval(() => {
    void pollNvdCves()
    void pollGithubAdvisories()
    void pollFeodoTracker()
    void pollOoni()
    void pollMastodon()
    void pollRssFeeds()
  }, 300_000)

  pollInterval(() => {
    void pollCisaKev()
    void pollHibpBreaches()
  }, 900_000)

  pollInterval(() => {
    void pollRansomwhere()
  }, 3_600_000)
}

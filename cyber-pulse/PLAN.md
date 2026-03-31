# cyber-pulse

Real-time cybersecurity threat monitoring dashboard for Dazzle. A 24/7 live stream that feels like looking through the window of a SOC. Dark, electric, alive. Quiet periods show the internet's "background radiation." When something real happens, the entire screen escalates.

The core tension: **the internet is always under attack, but most of the time you can't see it.**

---

## Scenes

The dashboard cycles through multiple full-screen scenes (not a static layout). Each scene is a self-contained visual that tells one part of the story. Hard cuts between scenes, matching the Dazzle aesthetic. A persistent top bar with Threat Weather score and SANS infocon level anchors every scene.

### Scene 1: Attack Map ("Background Radiation")

A world map rendered on Canvas 2D. Animated particles flow from DShield top source countries to target regions. Particle intensity and color correspond to attack volume. Port labels float near clusters. A Geiger counter metaphor: the more particles, the more "radiation."

**Data sources:**
- SANS ISC `/api/topips/records/20?json` (top attacking IPs, geolocated)
- SANS ISC `/api/topports/records/10?json` (top attacked ports)
- SANS ISC `/api/sources/attacks/20?json` (top source countries)
- Shodan InternetDB `https://internetdb.shodan.io/{ip}` (enrich IPs with open ports/vulns, no auth)

**Visual:** Dark globe or flat mercator projection. Cyan/magenta particle trails. Port numbers as small monospace labels. Source country names pulse on first appearance. Attack volume counter in corner.

---

### Scene 2: Vulnerability Feed

A full-screen scrolling feed of recent CVEs, styled like a terminal. New entries animate in from the bottom. Critical/High severity CVEs get larger treatment with expanded details. CVEs that are on CISA KEV (actively exploited) get a pulsing red "EXPLOITED" badge. EPSS scores shown as probability bars.

**Data sources:**
- NVD API `https://services.nvd.nist.gov/rest/json/cves/2.0?lastModStartDate=...` (new/modified CVEs)
- CISA KEV `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` (actively exploited)
- GitHub Advisory API `https://api.github.com/advisories` (OSS vulns with EPSS scores, free token)
- OSV.dev `https://api.osv.dev/v1/query` (package-level impact)
- NVD Change History `https://services.nvd.nist.gov/rest/json/cvehistory/2.0` (track modifications)

**Visual:** Dark terminal aesthetic. Green/amber/red color coding by CVSS severity. Monospace font for CVE IDs. Each entry: CVE ID, CVSS score badge, short description, affected vendor/product, EPSS percentile bar. KEV entries glow red.

---

### Scene 3: Service Status Grid

A grid of 25-30 major internet services, each represented by a logo/icon and colored health indicator. Polls Statuspage.io endpoints. When services degrade, they pulse and expand. When multiple services degrade simultaneously, connecting lines illuminate between them, showing potential cascade. A timeline at the bottom shows recent incidents.

**Data sources (all Statuspage.io pattern, no auth, JSON):**
- GitHub: `https://www.githubstatus.com/api/v2/summary.json`
- Cloudflare: `https://www.cloudflarestatus.com/api/v2/summary.json`
- Discord: `https://discordstatus.com/api/v2/summary.json`
- OpenAI: `https://status.openai.com/api/v2/summary.json`
- Datadog: `https://status.datadoghq.com/api/v2/summary.json`
- Twilio: `https://status.twilio.com/api/v2/summary.json`
- Reddit: `https://www.redditstatus.com/api/v2/summary.json`
- Atlassian: `https://status.atlassian.com/api/v2/summary.json`
- AWS: `https://health.aws.amazon.com/public/currentevents` (JSON, UTF-16)
- GCP: `https://status.cloud.google.com/incidents.json` (custom JSON)
- Azure: `https://azure.status.microsoft/en-us/status/feed/` (RSS)

**Downdetector alternative:** Downdetector has no public API and blocks scrapers. The Statuspage.io approach is strictly better: we get the same data (and more) directly from official sources, with structured JSON, no auth, and no legal risk.

**Visual:** Dark grid. Service icons in muted gray when healthy. Yellow/orange/red pulse when degraded. Incident count badges. When cascade detected (cloud provider down + downstream services follow within 10min), animated connection lines in red.

---

### Scene 4: Threat Intelligence Feed

A curated, real-time feed combining community signals and threat intel. Security news from RSS feeds, Hacker News security stories, Reddit /r/netsec top posts, infosec Mastodon/Bluesky posts mentioning CVEs. Styled like a news ticker crossed with a social feed.

**Data sources:**
- Hacker News Algolia: `https://hn.algolia.com/api/v1/search_by_date?query=CVE+OR+vulnerability+OR+breach+OR+ransomware&tags=story` (no auth, 10k req/hr)
- Reddit /r/netsec: `https://www.reddit.com/r/netsec/new.json?limit=10` (User-Agent header required, no OAuth for read)
- Reddit /r/cybersecurity: `https://www.reddit.com/r/cybersecurity/new.json?limit=10`
- Bluesky Jetstream: `wss://jetstream2.us-east.bsky.network/subscribe` (WebSocket, filter client-side for CVE/vuln/breach keywords)
- infosec.exchange: `https://infosec.exchange/api/v1/timelines/public?local=true&limit=40` (no auth, 300 req/5min)
- Mastodon hashtags: `https://mastodon.social/api/v1/timelines/tag/cve?limit=40` (no auth)

**RSS feeds (all verified, no auth):**
- Krebs on Security: `https://krebsonsecurity.com/feed/`
- The Hacker News: `https://feeds.feedburner.com/TheHackersNews`
- BleepingComputer: `https://www.bleepingcomputer.com/feed/`
- Ars Technica Security: `https://arstechnica.com/security/feed/`
- Schneier on Security: `https://www.schneier.com/feed/atom/`
- Google Project Zero: `https://projectzero.google/feed.xml`
- Cisco Talos: `https://blog.talosintelligence.com/rss/` (needs browser User-Agent)
- Dark Reading: `https://www.darkreading.com/rss.xml`

**Visual:** Cards sliding in from right. Source icon (HN orange, Reddit blue, Mastodon purple, RSS amber). Title, source, timestamp, upvote/boost count. CVE IDs auto-highlighted in cyan. High-engagement posts get larger treatment.

---

### Scene 5: Exploit Lifecycle Tracker

For the top 5-10 most critical active CVEs, show where each one is in its exploit maturity lifecycle. A horizontal pipeline visualization.

**Lifecycle stages:**
1. **Published** - CVE exists in NVD (source: NVD API)
2. **Advisory Issued** - Vendor/GitHub advisory published (source: GitHub Advisory API)
3. **PoC Available** - Proof-of-concept code published (source: GitHub search for repos matching `CVE-YYYY-NNNNN`)
4. **Weaponized** - Added to CISA KEV or seen in Nuclei/Metasploit (source: KEV JSON, GitHub commits API for nuclei-templates and metasploit-framework)
5. **Commoditized** - Appearing in automated attack tooling (source: Abuse.ch feeds, SANS ISC port correlation)

**Data sources:**
- NVD API (publication dates, CVSS)
- GitHub Advisory API (advisory dates, patched versions)
- CISA KEV (exploitation confirmation)
- GitHub Search: `https://api.github.com/search/repositories?q=CVE-2026+exploit&sort=updated` (10 req/min unauth, 30 auth)
- Nuclei templates: `https://api.github.com/repos/projectdiscovery/nuclei-templates/commits` (new exploit templates)
- Metasploit: `https://api.github.com/repos/rapid7/metasploit-framework/commits?path=modules/exploits` (new modules)

**Visual:** Horizontal pipeline/funnel. CVE cards flow left-to-right through stages. Color intensifies as maturity increases (cyan -> yellow -> orange -> red). Stage transition is animated. Running stat: "median time from CVE to public exploit."

---

### Scene 6: Malware & Botnet Activity

Real-time view of botnet command-and-control infrastructure and malware distribution. A network graph of C2 servers, malicious URLs, and malware families.

**Data sources (all free, no auth for bulk feeds):**
- Feodo Tracker: `https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json` (botnet C2 IPs with malware family, port, country, status)
- URLhaus CSV: `https://urlhaus.abuse.ch/downloads/csv_recent/` (recent malicious URLs, updated every ~2min)
- ThreatFox CSV: `https://threatfox.abuse.ch/export/csv/recent/` (recent IOCs with malware families)
- SSL Blacklist: `https://sslbl.abuse.ch/blacklist/sslblacklist.csv` (malicious SSL certificates)
- MalwareBazaar hashes: `https://bazaar.abuse.ch/export/txt/sha256/recent/` (recent malware samples)
- OpenPhish: `https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt` (phishing URLs)

**Visual:** Network graph. Malware family names as large nodes (Emotet, QakBot, Dridex, etc.). C2 server IPs as smaller nodes connected to their family. Country flags on C2 nodes. Pulsing connections when C2 is "online." New additions animate in with spring physics. Counter: "X active C2 servers tracked."

---

### Scene 7: Internet Freedom Monitor

Global view of internet censorship and shutdowns. Combines OONI censorship measurement data with BGP routing anomalies from RIPE.

**Data sources:**
- OONI Incidents: `https://api.ooni.io/api/v1/incidents/search?limit=10&only_ongoing=true` (no auth, ongoing censorship events)
- OONI Measurements: `https://api.ooni.io/api/v1/measurements?anomaly=true&limit=20` (anomalous measurements by country)
- RIPE RIS Live: `wss://ris-live.ripe.net/v1/ws/` (real-time BGP updates, no auth)
- RIPEstat: `https://stat.ripe.net/data/routing-status/data.json?resource=AS{n}` (ASN routing visibility, no auth)
- CIRCL BGP Ranking: `POST https://bgpranking.circl.lu/json/asn` (ASN maliciousness ranking, no auth)

**Visual:** World map with countries colored by OONI anomaly density. Ongoing censorship incidents shown as pulsing borders. BGP withdrawal events shown as connectivity lines disappearing. Detail panel for active incidents (e.g., "Gabon: Social media blocked since..."). Correlation badge when OONI + BGP data agree.

---

### Scene 8: Threat Weather Overview

The "summary" scene. Shows the composite Threat Weather Score as a large central gauge, surrounded by contributing signals arranged in a radar/compass layout.

**Derived metric (computed client-side):**
- SANS infocon level (green=0, yellow=25, orange=50, red=100)
- CVE severity surge (% critical/high in last 24h vs. 30-day baseline)
- KEV additions rate (last 7 days vs. monthly average)
- Port attack diversity (distinct ports under attack, more = worse)
- Service degradation count (from Statuspage polling)
- OONI censorship event count
- Malware IOC submission rate (from Abuse.ch feeds)
- Social signal volume (CVE mentions across HN/Reddit/Bluesky/Mastodon vs. baseline)

**Visual:** Central gauge (0-100) with bands: Clear (0-20, blue), Advisory (20-40, cyan), Watch (40-60, yellow), Warning (60-80, orange), Critical (80-100, red). Surrounding indicators show each contributing signal with its own mini gauge. Background shifts color with score: deep blue calm to amber/red storm. 30-day sparkline at bottom.

---

### Scene 9: Breach Tracker

Recent data breaches and ransomware incidents. A timeline of confirmed breaches with scale indicators.

**Data sources:**
- HIBP Breaches: `https://haveibeenpwned.com/api/v3/breaches` (all 967+ breaches, no auth, User-Agent required)
- HIBP Latest: `https://haveibeenpwned.com/api/v3/latestBreach` (most recent, no auth)
- Ransomwhere: `https://api.ransomwhe.re/export` (11,186 ransomware payment records with Bitcoin addresses and USD amounts, no auth)

**Visual:** Timeline flowing left to right. Each breach is a circle sized by PwnCount (number of affected accounts). Color by data classes exposed (passwords = red, email = amber, personal = magenta). Ransomware payments shown as a running total with BTC/USD amounts. "Records exposed today" counter.

---

## Breaking Mode

When the cross-source correlation engine detects convergence of 3+ independent signals on the same event, the normal scene cycle pauses and the full screen transitions to a "breaking incident" view.

**Trigger conditions (any 3+ of):**
- New CVSS 9.0+ CVE published
- Same CVE added to CISA KEV
- PoC exploit appears on GitHub
- Related service(s) degrading on Statuspage
- Social media spike (CVE ID trending on HN/Reddit/Bluesky)
- SANS ISC related port attack volume spike
- Nuclei/Metasploit template published for the CVE

**Visual:** Screen flashes briefly. Background shifts to darker red-tinged palette. Full-screen incident card with: CVE ID (large), CVSS score, affected product, description, timeline of correlated signals, affected services, social mentions count. Returns to normal scene cycle after 2-3 minutes or when manually dismissed.

---

## Persistent Elements (all scenes)

### Top Bar (40px)
- **Threat Weather Score:** gauge, always visible
- **SANS Infocon:** colored dot (green/yellow/orange/red)
- **Active incidents:** count badge
- **UTC clock**

### Bottom Ticker (24px)
- Scrolling ticker of latest CVE IDs + short descriptions, latest breach names, latest service incidents. Pulls from all data sources.

---

## Data Architecture

### Feeder (`feeder.ts`)

Node.js script running on a server. Polls all REST/RSS sources at their respective intervals, normalizes data into a common event format, deduplicates, and pushes to the Dazzle stage via the event API.

**Polling tiers:**
| Interval | Sources |
|----------|---------|
| 30s | SANS ISC infocon, top ports, top IPs |
| 60s | Statuspages (25-30 services), GCP incidents, AWS currentevents |
| 120s | NVD CVEs (with API key), GitHub Advisories, HN Algolia, Reddit |
| 300s | CISA KEV, Feodo Tracker, URLhaus, ThreatFox, OONI incidents, OSV.dev, HIBP, Mastodon, RSS feeds |
| 3600s | DShield block list, AbuseIPDB blacklist, Ransomwhere, Go vuln DB |

**Normalization:** All events become `{ type, severity, timestamp, title, description, source, metadata }`.

### Frontend (`src/App.tsx`)

React 19 + TypeScript strict + Tailwind + Vite. Receives events from feeder. Also connects directly to:
- Bluesky Jetstream WebSocket (client-side keyword filtering)
- RIPE RIS Live WebSocket (BGP anomaly detection)

Scene cycling managed by a state machine. Each scene is a React component. Canvas 2D for map/particle/gauge visualizations. React components for feed/grid/timeline scenes.

---

## API Keys Required (all free)

| Key | Source | Why |
|-----|--------|-----|
| NVD API key | `https://nvd.nist.gov/developers/request-an-api-key` | 10x rate limit (50 vs 5 requests per 30s) |
| GitHub PAT | `https://github.com/settings/tokens` | 5000 vs 60 requests/hour |
| Cloudflare Radar | `https://dash.cloudflare.com/` (free account, create API token with Radar Read) | Outage annotations |
| AbuseIPDB | `https://www.abuseipdb.com/register` | Blacklist endpoint (1000 checks/day) |
| abuse.ch Auth-Key | `https://auth.abuse.ch/` | API endpoints (CSV feeds work without) |

**Zero auth needed for MVP:** SANS ISC, CISA KEV, NVD (lower rate), all Statuspages, GCP/AWS status, Feodo Tracker, URLhaus CSV, OONI, OSV.dev, HIBP breaches, HN Algolia, Mastodon, all RSS feeds, Bluesky Jetstream, RIPE RIS Live, Ransomwhere, Shodan InternetDB, CIRCL BGP Ranking.

---

## Verified Endpoint Reference

Every endpoint below has been tested and confirmed returning data as of 2026-03-31.

### Vulnerability & Exploit Data

| Source | Endpoint | Auth | Format | Rate Limit |
|--------|----------|------|--------|------------|
| NVD CVEs | `GET https://services.nvd.nist.gov/rest/json/cves/2.0` | Optional key | JSON | 5/30s (50 with key) |
| NVD Change History | `GET https://services.nvd.nist.gov/rest/json/cvehistory/2.0` | Optional key | JSON | Same |
| CISA KEV | `GET https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | None | JSON | None documented |
| GitHub Advisories | `GET https://api.github.com/advisories` | Optional token | JSON | 60/hr (5000 with token) |
| OSV.dev Query | `POST https://api.osv.dev/v1/query` | None | JSON | Generous |
| OSV.dev Batch | `POST https://api.osv.dev/v1/querybatch` | None | JSON | Generous |
| Go Vuln DB | `GET https://vuln.go.dev/index/vulns.json` | None | JSON | None documented |
| CVE.org | `GET https://cveawg.mitre.org/api/cve/{CVE-ID}` | None (single) | JSON | Moderate |
| CIRCL CVE | `GET https://cve.circl.lu/api/last/{count}` | None | JSON | None documented |

### Attack Telemetry & Honeypots

| Source | Endpoint | Auth | Format | Rate Limit |
|--------|----------|------|--------|------------|
| SANS ISC Infocon | `GET https://isc.sans.edu/api/infocon?json` | None (custom UA) | JSON | None documented |
| SANS ISC Top Ports | `GET https://isc.sans.edu/api/topports/records/{count}?json` | None (custom UA) | JSON | None documented |
| SANS ISC Top IPs | `GET https://isc.sans.edu/api/topips/records/{count}?json` | None (custom UA) | JSON | None documented |
| SANS ISC Sources | `GET https://isc.sans.edu/api/sources/attacks/{count}?json` | None (custom UA) | JSON | None documented |
| SANS ISC Port History | `GET https://isc.sans.edu/api/porthistory/{port}/{days}?json` | None (custom UA) | JSON | None documented |
| SANS ISC Handler | `GET https://isc.sans.edu/api/handler?json` | None (custom UA) | JSON | None documented |
| DShield Block List | `GET https://feeds.dshield.org/block.txt` | None | TSV | None documented |
| Shodan InternetDB | `GET https://internetdb.shodan.io/{ip}` | None | JSON | Generous |
| CIRCL BGP Ranking | `POST https://bgpranking.circl.lu/json/asn` | None | JSON | None documented |
| AbuseIPDB Blacklist | `GET https://api.abuseipdb.com/api/v2/blacklist` | Free key | JSON | 5/day |
| GreyNoise Community | `GET https://api.greynoise.io/v3/community/{ip}` | Optional key | JSON | 50/day (free key) |

### Malware & Threat Intel

| Source | Endpoint | Auth | Format | Rate Limit |
|--------|----------|------|--------|------------|
| Feodo Tracker | `GET https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json` | None | JSON | None (CC0) |
| URLhaus CSV | `GET https://urlhaus.abuse.ch/downloads/csv_recent/` | None | CSV | None |
| ThreatFox CSV | `GET https://threatfox.abuse.ch/export/csv/recent/` | None | CSV | None |
| SSL Blacklist | `GET https://sslbl.abuse.ch/blacklist/sslblacklist.csv` | None | CSV | None |
| MalwareBazaar Hashes | `GET https://bazaar.abuse.ch/export/txt/sha256/recent/` | None | Text | None |
| OpenPhish | `GET https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt` | None | Text | GitHub limits |
| Emerging Threats | `GET https://rules.emergingthreats.net/blockrules/compromised-ips.txt` | None | Text | None |
| Bambenek C2 IPs | `GET https://osint.bambenekconsulting.com/feeds/c2-ipmasterlist-high.txt` | None | CSV | None |
| IPsum Threat Scores | `GET https://raw.githubusercontent.com/stamparm/ipsum/master/levels/3.txt` | None | Text | GitHub limits |

### Breach & Ransomware

| Source | Endpoint | Auth | Format | Rate Limit |
|--------|----------|------|--------|------------|
| HIBP All Breaches | `GET https://haveibeenpwned.com/api/v3/breaches` | None (UA required) | JSON | Generous |
| HIBP Latest Breach | `GET https://haveibeenpwned.com/api/v3/latestBreach` | None (UA required) | JSON | Generous |
| HIBP Data Classes | `GET https://haveibeenpwned.com/api/v3/dataclasses` | None (UA required) | JSON | Generous |
| Ransomwhere Payments | `GET https://api.ransomwhe.re/export` | None | JSON | None documented |

### Service Status

| Source | Endpoint | Auth | Format |
|--------|----------|------|--------|
| GitHub | `GET https://www.githubstatus.com/api/v2/summary.json` | None | JSON |
| Cloudflare | `GET https://www.cloudflarestatus.com/api/v2/summary.json` | None | JSON |
| Discord | `GET https://discordstatus.com/api/v2/summary.json` | None | JSON |
| OpenAI | `GET https://status.openai.com/api/v2/summary.json` | None | JSON |
| Datadog | `GET https://status.datadoghq.com/api/v2/summary.json` | None | JSON |
| Twilio | `GET https://status.twilio.com/api/v2/summary.json` | None | JSON |
| Reddit | `GET https://www.redditstatus.com/api/v2/summary.json` | None | JSON |
| Atlassian | `GET https://status.atlassian.com/api/v2/summary.json` | None | JSON |
| GCP | `GET https://status.cloud.google.com/incidents.json` | None | JSON |
| AWS | `GET https://health.aws.amazon.com/public/currentevents` | None | JSON (UTF-16) |
| Azure | `GET https://azure.status.microsoft/en-us/status/feed/` | None | RSS |
| Cloudflare Radar | `GET https://api.cloudflare.com/client/v4/radar/annotations/outages` | Free token | JSON |

### Internet Freedom & Routing

| Source | Endpoint | Auth | Format |
|--------|----------|------|--------|
| OONI Incidents | `GET https://api.ooni.io/api/v1/incidents/search?only_ongoing=true` | None | JSON |
| OONI Measurements | `GET https://api.ooni.io/api/v1/measurements?anomaly=true` | None | JSON |
| RIPE RIS Live | `wss://ris-live.ripe.net/v1/ws/` | None | JSON/WebSocket |
| RIPEstat Routing | `GET https://stat.ripe.net/data/routing-status/data.json?resource=AS{n}` | None | JSON |

### Community Signals

| Source | Endpoint | Auth | Format | Rate Limit |
|--------|----------|------|--------|------------|
| Bluesky Jetstream | `wss://jetstream2.us-east.bsky.network/subscribe` | None | JSON/WebSocket | None |
| HN Algolia | `GET https://hn.algolia.com/api/v1/search_by_date?query=...&tags=story` | None | JSON | 10k/hr |
| HN Firebase | `GET https://hacker-news.firebaseio.com/v0/newstories.json` | None | JSON | None |
| Reddit /r/netsec | `GET https://www.reddit.com/r/netsec/new.json` | UA header | JSON | ~100/10min |
| Reddit /r/cybersecurity | `GET https://www.reddit.com/r/cybersecurity/new.json` | UA header | JSON | ~100/10min |
| infosec.exchange | `GET https://infosec.exchange/api/v1/timelines/public?local=true` | None | JSON | 300/5min |
| Mastodon #cve | `GET https://mastodon.social/api/v1/timelines/tag/cve` | None | JSON | 300/5min |
| Mastodon #infosec | `GET https://mastodon.social/api/v1/timelines/tag/infosec` | None | JSON | 300/5min |

### Security News RSS (all verified, no auth)

| Source | Feed URL |
|--------|----------|
| Krebs on Security | `https://krebsonsecurity.com/feed/` |
| The Hacker News | `https://feeds.feedburner.com/TheHackersNews` |
| BleepingComputer | `https://www.bleepingcomputer.com/feed/` |
| Ars Technica Security | `https://arstechnica.com/security/feed/` |
| Schneier on Security | `https://www.schneier.com/feed/atom/` |
| Google Project Zero | `https://projectzero.google/feed.xml` |
| Cisco Talos | `https://blog.talosintelligence.com/rss/` |
| Dark Reading | `https://www.darkreading.com/rss.xml` |
| MSRC (API) | `https://api.msrc.microsoft.com/cvrf/v3.0/updates` |

### Exploit Publication Tracking

| Source | Endpoint | Auth |
|--------|----------|------|
| GitHub Exploit Search | `GET https://api.github.com/search/repositories?q=exploit+CVE-YYYY&sort=updated` | Optional token |
| Nuclei Templates | `GET https://api.github.com/repos/projectdiscovery/nuclei-templates/commits` | Optional token |
| Metasploit Modules | `GET https://api.github.com/repos/rapid7/metasploit-framework/commits?path=modules/exploits` | Optional token |
| Metasploit CVE Feed | `GET https://feeds.ecrimelabs.net/data/metasploit-cve` | None |

### Certificate Transparency (optional, self-hosted)

| Source | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| Google CT Log List | `GET https://www.gstatic.com/ct/log_list/v3/log_list.json` | None | 30+ active logs |
| Google CT Entries | `GET https://ct.googleapis.com/logs/us1/argon2026h1/ct/v1/get-entries?start=N&end=M` | None | Base64 DER certs |
| certstream (public) | `wss://certstream.calidog.io` | None | **UNRELIABLE, frequently down** |
| certstream-server-go | Self-hosted Docker | N/A | Recommended alternative |

---

## Downdetector

Downdetector (owned by Ookla) has **no public API**. Scraping is blocked by Cloudflare and prohibited by their Terms of Service. Unofficial npm packages and GitHub scrapers exist but break regularly and carry legal risk.

**Our approach is strictly better:** By polling 25+ Statuspage.io endpoints directly, we get the same (and more structured) data that Downdetector aggregates, directly from the official source, with no auth, no scraping, and no legal risk. We also get GCP/AWS/Azure native status feeds. The Statuspage.io pattern covers GitHub, Cloudflare, Discord, OpenAI, Datadog, Twilio, Reddit, Atlassian, and many more.

For services without a Statuspage (e.g., smaller SaaS), Cloudflare Radar's outage annotations (free API key) provide a secondary signal.

---

## Why Not

Sources investigated and rejected:

| Source | Reason |
|--------|--------|
| Downdetector | No API, scraping blocked + TOS violation |
| CISA RSS feeds | Retired May 2025, no longer active |
| CISA AIS TAXII | Requires PKI cert + government enrollment |
| CIRCL Passive DNS | Requires institutional registration |
| certstream.calidog.io | Service is dead/unreliable since 2023 |
| crt.sh | Frequently returns 502, overloaded |
| BinaryEdge | 403 without paid key |
| Shadowserver | Requires organizational enrollment |
| ThousandEyes | Paid only for API access |
| IODA API | Could not verify working API endpoints |
| VirusTotal | 4 req/min, 500/day too restrictive for live dashboard |
| T-Pot community data | No public feed, Sicherheitstacho appears defunct |

# cyber-pulse

Real-time cybersecurity threat monitoring dashboard for [Dazzle](https://dazzle.fm). Pulls from 43 live data sources to show vulnerability disclosures, service outages, botnet activity, breach data, and community signals.

## What it shows

- **Hero card**: cycles through the most critical active threats (CVSS 9+, actively exploited KEV entries) with full details
- **Vulnerability feed**: auto-scrolling list of recent CVEs from NVD, CISA KEV, and GitHub Advisories
- **Threat weather score**: composite 0-100 score computed from SANS ISC infocon, CVE velocity, KEV rate, service health, port diversity, malware activity, and community signals
- **Service status**: real-time health of GitHub, Cloudflare, Discord, OpenAI, Datadog, Reddit, Atlassian, GCP, AWS
- **Bottom ticker**: breach alerts, service outages, port scanning activity, community posts from HN/Reddit/Mastodon

## Data sources

All client-side, no server code. Fetches directly from public APIs (CORS-free in Dazzle, proxied in dev).

- **SANS ISC**: infocon level, top attacked ports, top attacking IPs
- **NVD**: recent CVEs with CVSS scores
- **CISA KEV**: known exploited vulnerabilities
- **GitHub Advisories**: open source security advisories
- **Feodo Tracker**: botnet C2 server infrastructure
- **URLhaus / ThreatFox / SSL Blacklist**: malware distribution URLs and IOCs
- **HIBP**: data breach records and latest breaches
- **Ransomwhere**: ransomware payment tracking
- **Statuspage.io**: service health for 9 major platforms
- **GCP / AWS**: cloud provider incident feeds
- **OONI**: internet censorship incidents
- **HN / Reddit / Mastodon**: security community signals
- **Bluesky Jetstream**: real-time firehose filtered for security keywords
- **RIPE RIS Live**: BGP routing updates

## Run locally

```
npm install
npm run dev
```

## Deploy to Dazzle

```
npm run build
dazzle stage create cyber-pulse
dazzle stage up --stage cyber-pulse
dazzle stage sync ./dist --stage cyber-pulse --watch
```

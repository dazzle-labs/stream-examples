# science-pulse

Real-time science and research monitoring dashboard for Dazzle. A 24/7 live stream that feels like standing in the control room of a research institution that watches all of science. Dark, precise, alive. Papers flow in from arXiv and bioRxiv. Earthquakes ripple across the globe. Solar wind data updates every minute. AI summarizes why each discovery matters.

The core tension: **thousands of discoveries happen every day, and almost nobody sees them in real time.**

---

## Scenes

The dashboard cycles through multiple full-screen scenes. Each scene is a self-contained visual that tells one part of the story. Hard cuts between scenes, matching the Dazzle aesthetic. A persistent top bar with Science Pulse score and paper counters anchors every scene.

### Scene 1: Paper Feed ("The Firehose")

A full-screen scrolling feed of the latest preprints and papers, styled like a mission control terminal. New entries animate in from the bottom. Each paper gets an AI-generated one-line "why it matters" summary. Papers with high citation velocity or Altmetric buzz get larger treatment.

**Data sources:**
- arXiv RSS: `https://rss.arxiv.org/rss/cs.AI+cs.LG+physics+q-bio+stat.ML` (daily batch at 20:00 ET, full abstracts, no auth)
- bioRxiv API: `https://api.biorxiv.org/details/biorxiv/{start}/{end}/0/100` (~300 preprints/day, no auth)
- medRxiv API: `https://api.biorxiv.org/details/medrxiv/{start}/{end}/0/100` (~70 preprints/day, no auth)
- Semantic Scholar: `https://api.semanticscholar.org/graph/v1/paper/search?fields=title,tldr,citationVelocity,influentialCitationCount` (auto-generated TLDRs for ~60M papers, free API key)
- OpenAlex: `https://api.openalex.org/works?filter=from_publication_date:{today}&sort=cited_by_count:desc&select=id,title,publication_date,cited_by_count,primary_topic,authorships` (250M+ works, free with `mailto`)

**Visual:** Dark terminal. Monospace for paper IDs and metadata. Each entry: arXiv/DOI ID, title, authors (truncated), institution, one-line AI summary, category badges. Papers with `citationVelocity > threshold` get a pulsing cyan "TRENDING" badge. bioRxiv vs. arXiv vs. PubMed distinguished by subtle left-border color.

---

### Scene 2: Discovery Globe

A world map rendered on Canvas 2D showing where science is happening right now. Author affiliations from papers are geolocated. Earthquakes ripple out from epicenters. iNaturalist species observations bloom as colored dots. Solar flare alerts pulse from the sun icon. A living visualization of Earth's research and natural activity.

**Data sources:**
- USGS Earthquakes: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson` (every minute, no auth, ~5 quakes/hour)
- iNaturalist: `https://api.inaturalist.org/v1/observations?per_page=20&order=desc&order_by=created_at&quality_grade=research&photos=true` (continuous, 190M+ observations, no auth)
- OpenAlex author affiliations (geolocated institutions from paper metadata)
- Open-Meteo weather: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m` (15-min updates, no auth)

**Visual:** Dark globe or flat mercator. Earthquake epicenters as expanding concentric rings (magnitude = size, depth = color). iNaturalist observations as small colored dots by taxon (green = plants, blue = birds, orange = mammals, purple = insects). Author affiliation clusters as glowing hotspots. Running counters: "X earthquakes today," "Y species observed today."

---

### Scene 3: Space Weather Monitor

A full-screen real-time display of solar activity and space weather. Charts update every minute. The sun's current state, solar wind conditions, geomagnetic activity, and aurora forecast. When a solar flare fires, the entire scene escalates.

**Data sources (all NOAA SWPC, no auth, no rate limits):**
- X-ray flux (1-min): `https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json`
- Solar wind plasma (1-min): `https://services.swpc.noaa.gov/products/solar-wind/plasma-6-hour.json` (density, speed, temperature)
- Solar wind magnetic field (1-min): `https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json` (Bx, By, Bz, Bt)
- Planetary Kp index (1-min est.): `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`
- NOAA Space Weather Scales: `https://services.swpc.noaa.gov/products/noaa-scales.json` (R/S/G scales + 3-day forecast)
- Latest X-ray flares: `https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json`
- Aurora forecast: `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json` (65K points, every 30 min)
- SWPC alerts: `https://services.swpc.noaa.gov/products/alerts.json` (real-time)
- NASA DONKI solar flares: `https://api.nasa.gov/DONKI/FLR?api_key=KEY` (flare class, source location, linked CMEs)
- NASA DONKI CMEs: `https://api.nasa.gov/DONKI/CME?api_key=KEY` (speed, direction, ENLIL model data)

**Visual:** Four quadrant layout. Top-left: X-ray flux chart (rolling 6-hour window, log scale, flare class bands C/M/X marked). Top-right: solar wind speed + density dual-axis chart. Bottom-left: Bz component chart (negative = storm trigger, highlighted red when southward). Bottom-right: Kp index bar chart (color-coded green/yellow/red by storm level). Center overlay: current NOAA R/S/G scale badges. When Kp >= 5 or X-class flare detected, background shifts to amber/red.

---

### Scene 4: Launch Tracker

Upcoming space launches with countdown timers. A timeline of the next 10 launches, expanding the nearest one into a detail view with mission info, rocket type, launch site, and weather probability.

**Data sources:**
- Launch Library 2: `https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=10&format=json` (363+ upcoming launches, all providers, free 15 req/hr)
- ISS position: `http://api.open-notify.org/iss-now.json` (real-time lat/lon, no auth)
- People in space: `http://api.open-notify.org/astros.json` (current crew manifest, no auth)
- NASA EPIC: `https://api.nasa.gov/EPIC/api/natural?api_key=KEY` (full-Earth images every ~2 hours)

**Visual:** Left 60%: next launch detail card with rocket silhouette, mission patch, countdown timer (days:hours:min:sec), launch site on mini-map, weather probability gauge, launch provider logo. Right 40%: scrolling list of next 10 launches. Bottom strip: ISS current position on world map track line, crew count badge, latest EPIC Earth image thumbnail.

---

### Scene 5: Science News Ticker

A full-screen news feed combining science journalism and institutional press releases. Cards slide in from the right. Sources are distinguished by colored icons. Headlines cycle through categories: physics, biology, space, climate, technology.

**Data sources (all RSS, no auth):**
- Phys.org: `https://phys.org/rss-feed/science-news/` (50+ articles/day, needs browser User-Agent)
- ScienceDaily: `https://www.sciencedaily.com/rss/all.xml` (30+ articles/day)
- Scientific American: `https://www.scientificamerican.com/platform/syndication/rss/` (5-10/day)
- Ars Technica Science: `https://feeds.arstechnica.com/arstechnica/science` (3-5/day, full HTML content)
- MIT Tech Review: `https://www.technologyreview.com/feed/` (3-5/day)
- Nature News: `https://www.nature.com/nature.rss` (needs User-Agent)
- Science (AAAS): `https://www.science.org/rss/news_current.xml` (3-5/day, includes images)
- The Conversation: `https://theconversation.com/articles.atom?section=science` (5-10/day, Creative Commons)
- Newswise: `https://feeds.feedburner.com/NewswiseScinews` (30+ press releases/day)
- MIT News: `https://news.mit.edu/rss/research` (2-3/day, includes images)
- New Scientist: `https://www.newscientist.com/section/news/feed/` (5-10/day)

**Visual:** Cards sliding in from right. Source icon with brand color (Nature blue, Science red, Ars orange, etc.). Title in large text, one-line summary below, source name + timestamp. Category tag (Physics, Biology, Space, Climate, Tech). High-engagement or "breaking" stories get a larger treatment with image if available from the feed.

---

### Scene 6: Climate and Earth Vitals

A dashboard of Earth's vital signs. CO2 concentration, global temperature anomaly, earthquake activity, air quality, ocean conditions. Worldometer-style animated counters that tick in real time. The "heartbeat" of the planet.

**Data sources:**
- Mauna Loa CO2: `https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv` (daily, no auth, current: ~431 ppm)
- Global temperature anomaly: `https://global-warming.org/api/temperature-api` (monthly, no auth)
- Methane: `https://global-warming.org/api/methane-api` (monthly, no auth)
- N2O: `https://global-warming.org/api/nitrous-oxide-api` (monthly, no auth)
- Open-Meteo air quality: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi,pm2_5,ozone` (hourly, no auth)
- Open-Meteo marine: `https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}&current=wave_height,wave_period,swell_wave_height` (15-min, no auth)
- NOAA CO-OPS tides: `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=8518750&product=water_level&datum=MLLW&units=english&time_zone=gmt&format=json` (6-min updates, no auth)
- USGS Water Services: `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=06934500&parameterCd=00060,00065&period=PT2H` (15-min, 13K+ stream gauges)
- USGS Earthquakes 24h: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`

**Visual:** Large Worldometer-style counters: CO2 ppm (with daily delta), global temp anomaly (with trend arrow), methane ppb, earthquakes today, papers published today. Below: four mini-charts showing 30-day trends for CO2, temperature, sea level, AQI. Color coding: values that are rising/worsening pulse in warm amber; stable in cool blue.

---

### Scene 7: Deep Dive (AI Commentary)

A single paper or discovery gets the full-screen treatment. Claude generates a 3-4 sentence "why this matters" commentary based on the paper's abstract. Styled like a TV news feature: large title, author names, institution logos, the AI summary displayed as text that types itself out character by character.

**Data sources:**
- Selected from Scene 1's pipeline: papers with highest citationVelocity, influentialCitationCount, or Altmetric score
- Semantic Scholar TLDR as baseline: `fields=tldr`
- Semantic Scholar recommendations: `POST https://api.semanticscholar.org/recommendations/v1/papers/` (related papers for "see also")
- Claude API for expanded commentary (called from feeder, not frontend)

**Visual:** Full dark screen. Large title text in white. Author names and affiliations in muted gray below. AI-generated commentary types out in cyan monospace, line by line. A "related papers" sidebar shows 3-4 connected papers with their own TLDRs. Category and field visualization shows where this paper sits in the taxonomy. Paper DOI/arXiv link as a QR code in the corner.

---

### Scene 8: Pulse Overview

The "summary" scene. Shows the composite Science Pulse Score as a large central gauge, surrounded by contributing signals. How active is the scientific world right now?

**Derived metric (computed client-side):**
- Papers published today (arXiv + bioRxiv + medRxiv daily counts)
- Earthquake activity (count and max magnitude in last 24h)
- Space weather intensity (Kp index, flare activity)
- News volume (RSS article count in last 6h vs. baseline)
- Launch proximity (hours until next launch)
- Climate anomaly magnitude (CO2 delta, temp anomaly)

**Visual:** Central gauge (0-100) with bands: Quiet (0-20, deep blue), Active (20-40, cyan), Busy (40-60, teal), Surge (60-80, amber), Historic (80-100, bright white). Surrounding indicators show each contributing signal with its own mini gauge. Background color shifts with score. 7-day activity sparkline at bottom. "Right now" summary text: "X papers published, Y earthquakes, next launch in Z hours."

---

## Breaking Mode

When cross-source correlation detects convergence of 3+ independent signals on the same topic, the normal scene cycle pauses for a "breaking discovery" view.

**Trigger conditions (any 3+ of):**
- Paper with extremely high citation velocity appears
- Same topic trending on multiple news RSS feeds
- Related Altmetric spike detected
- Major earthquake (6.0+) or space weather event (X-class flare, G3+ storm)
- NASA/ESA press release + paper on same topic
- Multiple preprints on same topic within 24h (convergent discovery)

**Visual:** Screen flashes briefly. Background shifts to brighter palette. Full-screen discovery card with: title, source, summary, timeline of correlated signals, related papers, news coverage links. Returns to normal cycle after 2-3 minutes.

---

## Persistent Elements (all scenes)

### Top Bar (40px)
- **Science Pulse Score:** gauge, always visible
- **Papers today:** running counter (arXiv + bioRxiv + medRxiv)
- **Next launch:** countdown timer
- **UTC clock**

### Bottom Ticker (24px)
- Scrolling ticker of latest paper titles, earthquake events, news headlines, and space weather alerts. Pulls from all data sources.

---

## Data Architecture

### Feeder (`feeder.ts`)

Node.js script running on a server. Polls all REST/RSS/CSV sources at their respective intervals, normalizes data, deduplicates, generates AI summaries for top papers, and pushes to the Dazzle stage via the event API.

**Polling tiers:**

| Interval | Sources |
|----------|---------|
| 60s | NOAA SWPC (X-ray flux, solar wind plasma, solar wind mag, Kp index, flares, alerts, NOAA scales) |
| 60s | USGS earthquake feed (all_hour.geojson) |
| 120s | iNaturalist recent observations |
| 300s | ISS position, people in space |
| 300s | bioRxiv + medRxiv details API (today's date range) |
| 300s | Semantic Scholar paper search (trending, with TLDR + citationVelocity) |
| 300s | OpenAlex works (today's publications, sorted by cited_by_count) |
| 300s | All RSS feeds (Phys.org, ScienceDaily, SciAm, Ars, MIT TR, Nature, Science, Conversation, Newswise, MIT News, New Scientist) |
| 600s | Launch Library 2 upcoming launches |
| 600s | Open-Meteo air quality + marine |
| 600s | NOAA CO-OPS water level + temperature |
| 600s | NOAA SWPC aurora forecast |
| 600s | NASA DONKI (solar flares, CMEs, geomagnetic storms) |
| 600s | NASA EPIC Earth images |
| 1800s | arXiv RSS feeds (daily batch, but poll to catch the update) |
| 3600s | Mauna Loa CO2, global temperature, methane, N2O |
| 3600s | USGS earthquake 24h summary (for daily stats) |
| 3600s | NASA APOD, NEO feed |
| 3600s | JPL close approaches, fireballs |

**AI summary generation:** For the top ~20 papers per cycle (by citationVelocity or newness), call Claude API to generate a one-sentence "why it matters" from the abstract. Use Semantic Scholar TLDR as fallback when Claude quota is constrained. Cache summaries by DOI/arXiv ID.

**Normalization:** All events become `{ type, category, timestamp, title, summary, source, url, metadata }`.

### Frontend (`src/App.tsx`)

React 19 + TypeScript strict + Tailwind + Vite. 1280x720 stage. Receives events from feeder via Dazzle event system. Scene cycling managed by a state machine.

Canvas 2D for: globe visualization (Scene 2), space weather charts (Scene 3), pulse gauge (Scene 8).
React components for: paper feed (Scene 1), launch tracker (Scene 4), news ticker (Scene 5), Earth vitals counters (Scene 6), deep dive (Scene 7).

---

## API Keys Required (all free)

| Key | Source | Why |
|-----|--------|-----|
| NASA API key | `https://api.nasa.gov` | DONKI, EPIC, NEO, APOD (1000 req/hr vs. 30/hr with DEMO_KEY) |
| Semantic Scholar API key | `https://www.semanticscholar.org/product/api#api-key-form` | 1 RPS baseline (unauthenticated is unusable) |
| PubMed API key | `https://www.ncbi.nlm.nih.gov/account/settings/` | 10 req/s vs. 3 req/s |
| Anthropic API key | `https://console.anthropic.com` | Claude for paper summaries and deep dive commentary |

**Zero auth needed for MVP:** arXiv RSS, bioRxiv API, medRxiv API, OpenAlex (with `mailto`), all NOAA SWPC endpoints, USGS earthquakes, iNaturalist, Open-Meteo (weather + air quality + marine), NOAA CO-OPS, USGS Water Services, ISS position/crew, all RSS news feeds, Mauna Loa CO2, global-warming.org APIs, JPL close approaches/fireballs, NWS alerts, Launch Library 2, Smithsonian volcanoes.

---

## Design

### Color Palette (dark theme, mission control aesthetic)
- Background: `#0a0e17` (near-black navy)
- Surface: `#0f1c2e` (dark navy)
- Primary accent: `#22d3ee` (bright cyan, "science/tech")
- Secondary accent: `#84cc16` (lime green, positive metrics/biology)
- Alert/breaking: `#f43f5e` (rose)
- Warning: `#f59e0b` (amber)
- Muted text: `#94a3b8` (slate)
- Bright text: `#f1f5f9` (off-white)

### Typography
- Data/numbers/IDs: JetBrains Mono (maximized lowercase height, crisp at small sizes)
- Headings/body: Inter (humanist sans-serif, pairs well with monospace data)

### Inspiration
- NASA Mission Control (blue/white/green on dark, grid structure)
- CERN event displays (vivid accents on black for different data types)
- Territory Studio FUI (The Martian: "grounded sci-fi," real data with cinematic presentation)
- Worldometer (animated counters, sense of real-time aliveness)

---

## Verified Endpoint Reference

Every endpoint below has been researched and confirmed as of 2026-03-31.

### Papers and Research

| Source | Endpoint | Auth | Format | Rate Limit | Update Freq |
|--------|----------|------|--------|------------|-------------|
| arXiv RSS | `GET https://rss.arxiv.org/rss/{categories}` | None | RSS/XML | None | Daily 20:00 ET |
| arXiv API | `GET http://export.arxiv.org/api/query?search_query=...` | None | Atom/XML | 1 req/3s | Daily batch |
| bioRxiv details | `GET https://api.biorxiv.org/details/biorxiv/{start}/{end}/{cursor}/{count}` | None | JSON | Reasonable | Daily |
| medRxiv details | `GET https://api.biorxiv.org/details/medrxiv/{start}/{end}/{cursor}/{count}` | None | JSON | Reasonable | Daily |
| Semantic Scholar | `GET https://api.semanticscholar.org/graph/v1/paper/search?fields=title,tldr,citationVelocity` | Free key | JSON | 1 RPS (key) | Daily |
| Semantic Scholar recs | `POST https://api.semanticscholar.org/recommendations/v1/papers/` | Free key | JSON | 1 RPS (key) | N/A |
| OpenAlex works | `GET https://api.openalex.org/works?filter=...&sort=...` | None (mailto) | JSON | 10 req/s | 1-2 day lag |
| PubMed esearch | `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json` | Optional key | JSON | 3/s (10 with key) | Continuous |
| PubMed esummary | `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json` | Optional key | JSON | 3/s (10 with key) | Continuous |
| Europe PMC | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json` | None | JSON | Generous | Daily |
| Crossref | `GET https://api.crossref.org/works?query=...&filter=from-pub-date:...` | None (mailto) | JSON | Polite pool | Hours |
| Crossref Event Data | `GET https://api.eventdata.crossref.org/v1/events?rows=20` | None | JSON | Open | Real-time |
| bioRxiv RSS | `GET https://connect.biorxiv.org/biorxiv_xml.php?subject=all` | None | RSS/RDF | None | Daily |

### Space and Astronomy

| Source | Endpoint | Auth | Format | Rate Limit | Update Freq |
|--------|----------|------|--------|------------|-------------|
| NOAA SWPC X-ray flux | `GET https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json` | None | JSON | None | 1 min |
| NOAA SWPC solar wind | `GET https://services.swpc.noaa.gov/products/solar-wind/plasma-6-hour.json` | None | JSON | None | 1 min |
| NOAA SWPC mag field | `GET https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json` | None | JSON | None | 1 min |
| NOAA SWPC Kp index | `GET https://services.swpc.noaa.gov/json/planetary_k_index_1m.json` | None | JSON | None | 1 min |
| NOAA scales | `GET https://services.swpc.noaa.gov/products/noaa-scales.json` | None | JSON | None | Real-time |
| NOAA flares | `GET https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json` | None | JSON | None | Real-time |
| NOAA aurora | `GET https://services.swpc.noaa.gov/json/ovation_aurora_latest.json` | None | JSON | None | 30 min |
| NOAA alerts | `GET https://services.swpc.noaa.gov/products/alerts.json` | None | JSON | None | Real-time |
| NOAA 3-day forecast | `GET https://services.swpc.noaa.gov/text/3-day-forecast.txt` | None | Text | None | 12 hrs |
| NOAA sunspots | `GET https://services.swpc.noaa.gov/json/sunspot_report.json` | None | JSON | None | Daily |
| NASA DONKI flares | `GET https://api.nasa.gov/DONKI/FLR?api_key=KEY` | API key | JSON | 1000/hr | Hours |
| NASA DONKI CMEs | `GET https://api.nasa.gov/DONKI/CME?api_key=KEY` | API key | JSON | 1000/hr | Hours |
| NASA DONKI storms | `GET https://api.nasa.gov/DONKI/GST?api_key=KEY` | API key | JSON | 1000/hr | Days |
| NASA APOD | `GET https://api.nasa.gov/planetary/apod?api_key=KEY` | API key | JSON | 1000/hr | Daily |
| NASA EPIC | `GET https://api.nasa.gov/EPIC/api/natural?api_key=KEY` | API key | JSON | 1000/hr | ~2 hrs |
| NASA NEO | `GET https://api.nasa.gov/neo/rest/v1/feed?api_key=KEY` | API key | JSON | 1000/hr | Daily |
| Launch Library 2 | `GET https://ll.thespacedevs.com/2.3.0/launches/upcoming/?format=json` | None | JSON | 15/hr | Continuous |
| ISS position | `GET http://api.open-notify.org/iss-now.json` | None | JSON | None | Real-time |
| People in space | `GET http://api.open-notify.org/astros.json` | None | JSON | None | Infrequent |
| JPL close approach | `GET https://ssd-api.jpl.nasa.gov/cad.api?date-min=...&dist-max=0.05` | None | JSON | None | Daily |
| JPL fireballs | `GET https://ssd-api.jpl.nasa.gov/fireball.api?date-min=...` | None | JSON | None | Weekly |

### Earth and Environment

| Source | Endpoint | Auth | Format | Rate Limit | Update Freq |
|--------|----------|------|--------|------------|-------------|
| USGS earthquakes (1hr) | `GET https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson` | None | GeoJSON | None | 1 min |
| USGS earthquakes (24hr) | `GET https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | None | GeoJSON | None | 1 min |
| iNaturalist | `GET https://api.inaturalist.org/v1/observations?per_page=20&order=desc&order_by=created_at` | None | JSON | 100/min | Continuous |
| Open-Meteo weather | `GET https://api.open-meteo.com/v1/forecast?current=temperature_2m,wind_speed_10m` | None | JSON | 10K/day | 15 min |
| Open-Meteo air quality | `GET https://air-quality-api.open-meteo.com/v1/air-quality?current=us_aqi,pm2_5,ozone` | None | JSON | 10K/day | 1 hr |
| Open-Meteo marine | `GET https://marine-api.open-meteo.com/v1/marine?current=wave_height,wave_period` | None | JSON | 10K/day | 15 min |
| NOAA CO-OPS tides | `GET https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&product=water_level` | None | JSON | ~30/s | 6 min |
| USGS water services | `GET https://waterservices.usgs.gov/nwis/iv/?format=json&parameterCd=00060,00065` | None | JSON | None | 15 min |
| NWS alerts | `GET https://api.weather.gov/alerts/active?status=actual` | None (UA) | GeoJSON | ~6/s | Continuous |
| Mauna Loa CO2 | `GET https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv` | None | CSV | None | Daily |
| Global temp anomaly | `GET https://global-warming.org/api/temperature-api` | None | JSON | None | Monthly |
| Methane | `GET https://global-warming.org/api/methane-api` | None | JSON | None | Monthly |
| N2O | `GET https://global-warming.org/api/nitrous-oxide-api` | None | JSON | None | Monthly |
| Smithsonian volcanoes | `GET https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&...&outputFormat=application/json` | None | GeoJSON | None | Weekly |

### Science News RSS (all verified, no auth)

| Source | Feed URL | Volume |
|--------|----------|--------|
| Phys.org | `https://phys.org/rss-feed/science-news/` (needs browser UA) | 50+/day |
| ScienceDaily | `https://www.sciencedaily.com/rss/all.xml` | 30+/day |
| Scientific American | `https://www.scientificamerican.com/platform/syndication/rss/` | 5-10/day |
| Ars Technica Science | `https://feeds.arstechnica.com/arstechnica/science` | 3-5/day |
| MIT Technology Review | `https://www.technologyreview.com/feed/` | 3-5/day |
| Nature | `https://www.nature.com/nature.rss` (needs UA) | 3-5/day |
| Science (AAAS) | `https://www.science.org/rss/news_current.xml` | 3-5/day |
| The Conversation | `https://theconversation.com/articles.atom?section=science` | 5-10/day |
| Newswise | `https://feeds.feedburner.com/NewswiseScinews` | 30+/day |
| MIT News | `https://news.mit.edu/rss/research` | 2-3/day |
| New Scientist | `https://www.newscientist.com/section/news/feed/` | 5-10/day |
| NASA News | `https://www.nasa.gov/news-release/feed/` | Several/day |
| ESA Space Science | `https://www.esa.int/rssfeed/Our_Activities/Space_Science` | Several/week |

---

## Why Not

Sources investigated and rejected:

| Source | Reason |
|--------|--------|
| SpaceX API v4 | Frozen since October 2022, no updates. Use Launch Library 2 instead |
| JAXA RSS | English feeds return 404, appears discontinued |
| EurekAlert RSS | Old feed infrastructure deprecated, URLs return 404 |
| CERN real-time data | No real-time feeds exist; data released months/years after collection |
| Altmetric API | Requires API key since Nov 2025; useful but not for MVP |
| NewsAPI.org | Free tier is dev-only, 24h delay, $449/mo for production |
| Stanford News RSS | Blocked by Cloudflare bot protection |
| PubMed trending | Website feature has no public API endpoint |
| GBIF | 3.6B records but includes museum specimens; less "live" feel than iNaturalist |
| OpenAQ v3 | Requires API key; Open-Meteo air quality is easier and no-auth |
| AirNow | Requires API key; Open-Meteo covers this |

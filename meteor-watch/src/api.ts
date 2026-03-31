import type { GmnMeteor, MeteorPoint } from './types'
import { getShowerName } from './showers'

interface DatasetteResponse {
  readonly ok: boolean
  readonly rows: GmnMeteor[]
  readonly next: string | null
  readonly truncated: boolean
}

export async function fetchGmnMeteors(): Promise<GmnMeteor[]> {
  const allRows: GmnMeteor[] = []
  const maxPages = 10
  let nextCursor: string | null = null

  for (let page = 0; page < maxPages; page++) {
    try {
      let url = 'https://explore.globalmeteornetwork.org/gmn_data_store/meteor.json?_size=1000&_sort_desc=beginning_utc_time&_shape=objects'
      if (nextCursor) {
        url += `&_next=${encodeURIComponent(nextCursor)}`
      }

      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      const json: DatasetteResponse = await res.json()
      allRows.push(...json.rows)

      if (!json.next || json.truncated) break
      nextCursor = json.next
    } catch (err) {
      console.error(`[meteor-watch] Failed to fetch GMN page ${page}:`, err)
      break
    }
  }

  console.log(`[meteor-watch] Loaded ${allRows.length} meteors across ${Math.min(maxPages, allRows.length > 0 ? Math.ceil(allRows.length / 1000) : 0)} pages`)
  return allRows
}

export function gmnToPoint(meteor: GmnMeteor): MeteorPoint {
  return {
    id: meteor.unique_trajectory_identifier,
    lat: meteor.latend_n_deg,
    lon: meteor.lonend_e_deg,
    velocity: meteor.vavg_km_s,
    magnitude: meteor.peak_absmag,
    showerCode: meteor.shower_iau_no,
    showerName: getShowerName(meteor.shower_iau_no),
    timestamp: meteor.beginning_utc_time,
    radiantRA: meteor.rageo_deg,
    radiantDec: meteor.decgeo_deg,
  }
}

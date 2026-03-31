// GMN meteor from Datasette API
export interface GmnMeteor {
  readonly unique_trajectory_identifier: string
  readonly beginning_utc_time: string
  readonly shower_iau_no: number
  readonly latbeg_n_deg: number
  readonly lonbeg_e_deg: number
  readonly htbeg_km: number
  readonly latend_n_deg: number
  readonly lonend_e_deg: number
  readonly htend_km: number
  readonly vinit_km_s: number
  readonly vavg_km_s: number
  readonly peak_absmag: number
  readonly mass_kg_tau_0_7: number | null
  readonly duration_sec: number
  readonly rageo_deg: number
  readonly decgeo_deg: number
}

// Processed meteor for visualization
export interface MeteorPoint {
  readonly id: string
  readonly lat: number
  readonly lon: number
  readonly velocity: number
  readonly magnitude: number
  readonly showerCode: number
  readonly showerName: string
  readonly timestamp: string
  readonly radiantRA: number
  readonly radiantDec: number
}

// App-level stats
export interface MeteorStats {
  readonly totalCount: number
  readonly showerBreakdown: readonly ShowerCount[]
  readonly avgVelocity: number
  readonly brightestMag: number
  readonly activeShower: string | null
  readonly dataAge: string
  readonly lastUpdated: number
  readonly refreshIntervalMin: number
}

export interface ShowerCount {
  readonly name: string
  readonly count: number
}

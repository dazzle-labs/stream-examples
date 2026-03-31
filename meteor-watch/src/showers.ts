export interface ShowerInfo {
  readonly name: string
  readonly code: string
  readonly peakMonth: number
  readonly peakDay: number
  readonly zhr: number
}

// IAU meteor shower numbers mapped to metadata
// Source: IMO Working List of Visual Meteor Showers
const SHOWERS: Readonly<Record<number, ShowerInfo>> = {
  1:   { name: 'Capricornids',         code: 'CAP', peakMonth: 7,  peakDay: 30, zhr: 5 },
  2:   { name: 'Southern Delta Aquariids', code: 'SDA', peakMonth: 7, peakDay: 30, zhr: 25 },
  4:   { name: 'Quadrantids',           code: 'QUA', peakMonth: 1,  peakDay: 4,  zhr: 120 },
  5:   { name: 'Southern Taurids',      code: 'STA', peakMonth: 10, peakDay: 10, zhr: 5 },
  6:   { name: 'Arietids',             code: 'ARI', peakMonth: 6,  peakDay: 7,  zhr: 60 },
  7:   { name: 'Perseids',             code: 'PER', peakMonth: 8,  peakDay: 12, zhr: 100 },
  8:   { name: 'Orionids',             code: 'ORI', peakMonth: 10, peakDay: 21, zhr: 20 },
  10:  { name: 'Northern Taurids',      code: 'NTA', peakMonth: 11, peakDay: 12, zhr: 5 },
  11:  { name: 'Leonids',              code: 'LEO', peakMonth: 11, peakDay: 17, zhr: 15 },
  12:  { name: 'Puppid-Velids',        code: 'PUP', peakMonth: 12, peakDay: 7,  zhr: 10 },
  13:  { name: 'Geminids',             code: 'GEM', peakMonth: 12, peakDay: 14, zhr: 150 },
  15:  { name: 'Ursids',               code: 'URS', peakMonth: 12, peakDay: 22, zhr: 10 },
  16:  { name: 'Virginids',            code: 'VIR', peakMonth: 4,  peakDay: 7,  zhr: 5 },
  17:  { name: 'Lyrids',               code: 'LYR', peakMonth: 4,  peakDay: 22, zhr: 18 },
  19:  { name: 'Mu Virginids',         code: 'MVI', peakMonth: 4,  peakDay: 25, zhr: 3 },
  20:  { name: 'Sagittariids',         code: 'SAG', peakMonth: 6,  peakDay: 19, zhr: 5 },
  26:  { name: 'June Bootids',         code: 'JBO', peakMonth: 6,  peakDay: 27, zhr: 5 },
  27:  { name: 'Piscis Austrinids',    code: 'PAU', peakMonth: 7,  peakDay: 28, zhr: 5 },
  31:  { name: 'Eta Aquariids',        code: 'ETA', peakMonth: 5,  peakDay: 6,  zhr: 50 },
  33:  { name: 'Northern Delta Aquariids', code: 'NDA', peakMonth: 8, peakDay: 13, zhr: 4 },
  36:  { name: 'Alpha Aurigids',       code: 'AUR', peakMonth: 9,  peakDay: 1,  zhr: 6 },
  40:  { name: 'Zeta Perseids',        code: 'ZPE', peakMonth: 6,  peakDay: 9,  zhr: 5 },
  69:  { name: 'Draconids',            code: 'DRA', peakMonth: 10, peakDay: 8,  zhr: 10 },
  96:  { name: 'Alpha Monocerotids',   code: 'AMO', peakMonth: 11, peakDay: 21, zhr: 5 },
  110: { name: 'Andromedids',          code: 'AND', peakMonth: 12, peakDay: 3,  zhr: 3 },
  145: { name: 'December Monocerotids', code: 'MON', peakMonth: 12, peakDay: 9,  zhr: 3 },
  164: { name: 'Phoenicids',           code: 'PHO', peakMonth: 12, peakDay: 2,  zhr: 5 },
  171: { name: 'November Orionids',    code: 'NOO', peakMonth: 11, peakDay: 28, zhr: 3 },
  175: { name: 'Kappa Cygnids',        code: 'KCG', peakMonth: 8,  peakDay: 17, zhr: 3 },
  183: { name: 'Epsilon Perseids',     code: 'EPE', peakMonth: 9,  peakDay: 9,  zhr: 5 },
  184: { name: 'September Perseids',   code: 'SPE', peakMonth: 9,  peakDay: 9,  zhr: 5 },
  191: { name: 'Chi Orionids',         code: 'XOR', peakMonth: 12, peakDay: 2,  zhr: 3 },
  206: { name: 'Leonis Minorids',      code: 'LMI', peakMonth: 10, peakDay: 24, zhr: 2 },
  208: { name: 'October Camelopardalids', code: 'OCM', peakMonth: 10, peakDay: 5, zhr: 5 },
  221: { name: 'Eta Eridanids',        code: 'ERI', peakMonth: 8,  peakDay: 9,  zhr: 3 },
  250: { name: 'November Iota Aurigids', code: 'NIA', peakMonth: 11, peakDay: 15, zhr: 5 },
  281: { name: 'October Ursae Majorids', code: 'OCU', peakMonth: 10, peakDay: 16, zhr: 3 },
  320: { name: 'December Alpha Draconids', code: 'DAD', peakMonth: 12, peakDay: 29, zhr: 5 },
  331: { name: 'Alpha Hydrids',        code: 'AHY', peakMonth: 1,  peakDay: 2,  zhr: 3 },
  334: { name: 'December Chi Virginids', code: 'XVI', peakMonth: 12, peakDay: 5,  zhr: 3 },
  340: { name: 'Xi Coronae Borealids', code: 'XCB', peakMonth: 6,  peakDay: 15, zhr: 3 },
  348: { name: 'Sigma Hydrids',        code: 'HYD', peakMonth: 12, peakDay: 12, zhr: 3 },
  372: { name: 'Phi Piscids',          code: 'PPS', peakMonth: 6,  peakDay: 14, zhr: 3 },
  404: { name: 'Gamma Ursae Minorids', code: 'GUM', peakMonth: 1,  peakDay: 18, zhr: 3 },
  506: { name: 'February Eta Draconids', code: 'FED', peakMonth: 2, peakDay: 4,  zhr: 3 },
  510: { name: 'February Hydrids',     code: 'FHY', peakMonth: 2,  peakDay: 8,  zhr: 2 },
}

export function getShowerName(iauNo: number): string {
  if (iauNo < 0) return 'Random'
  return SHOWERS[iauNo]?.name ?? 'Minor Shower'
}

export function getActiveShower(): string | null {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  let best: ShowerInfo | null = null
  let bestDist = Infinity

  for (const shower of Object.values(SHOWERS)) {
    // Simple proximity check: within 7 days of peak
    const dist = Math.abs((month - shower.peakMonth) * 30 + (day - shower.peakDay))
    if (dist < 7 && dist < bestDist && shower.zhr >= 10) {
      bestDist = dist
      best = shower
    }
  }

  return best ? `${best.name} (ZHR ~${best.zhr})` : null
}

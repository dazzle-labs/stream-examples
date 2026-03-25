// Orthographic projection for globe rendering
// Earth's axial tilt in radians (~23.4°)
const TILT = 23.4 * Math.PI / 180

const DEG_TO_RAD = Math.PI / 180

export interface ProjectionParams {
  cx: number       // center x
  cy: number       // center y
  radius: number   // globe radius in pixels
  rotation: number // current rotation angle in radians
}

export interface ProjectedPoint {
  x: number
  y: number
  visible: boolean
  depth: number  // 0 = edge, 1 = center (for lighting)
}

export function projectLatLon(
  lat: number,
  lon: number,
  params: ProjectionParams,
): ProjectedPoint {
  const latRad = lat * DEG_TO_RAD
  const lonRad = lon * DEG_TO_RAD

  const cosLat = Math.cos(latRad)
  const sinLat = Math.sin(latRad)
  const cosLon = Math.cos(lonRad - params.rotation)
  const sinLon = Math.sin(lonRad - params.rotation)
  const cosTilt = Math.cos(TILT)
  const sinTilt = Math.sin(TILT)

  // Determine visibility (point is on the front hemisphere)
  const depth = sinLat * sinTilt + cosLat * cosTilt * cosLon

  const x = params.cx + params.radius * cosLat * sinLon
  const y = params.cy - params.radius * (cosTilt * sinLat - sinTilt * cosLat * cosLon)

  return {
    x,
    y,
    visible: depth > 0,
    depth: Math.max(0, depth),
  }
}

// Project a point slightly above the globe surface (for aurora glow)
export function projectLatLonElevated(
  lat: number,
  lon: number,
  elevation: number, // fraction above surface (0.05 = 5% above)
  params: ProjectionParams,
): ProjectedPoint {
  const elevatedParams = {
    ...params,
    radius: params.radius * (1 + elevation),
  }
  return projectLatLon(lat, lon, elevatedParams)
}

// Get sun direction for day/night terminator
// Returns the longitude that faces the sun (simplified — assumes sun at rotation + π)
export function getSunLongitude(rotation: number): number {
  return rotation + Math.PI
}

// Calculate day/night factor for a given point
// Returns 0 (night) to 1 (full day)
export function getDayNightFactor(
  lon: number,
  rotation: number,
): number {
  const sunLon = getSunLongitude(rotation)
  const lonRad = lon * DEG_TO_RAD
  const diff = Math.cos(lonRad - sunLon)
  // Smooth transition across terminator
  return Math.max(0, Math.min(1, diff * 2 + 0.5))
}

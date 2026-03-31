// WebGL2 globe renderer with orthographic projection + satellite texture

// ─── Constants ───────────────────────────────────────────────────

export const W = 240
export const H = 240
export const R = 110
export const CX = W / 2
export const CY = H / 2

const TILT = 20
const TILT_R = TILT * Math.PI / 180
const COS_TILT = Math.cos(TILT_R)
const SIN_TILT = Math.sin(TILT_R)
const DEG = Math.PI / 180
export const ROT_PER = 180_000

const EARTH_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg'

// ─── Orthographic projection ─────────────────────────────────────

export function ortho(lat: number, lon: number, cLon: number): [number, number, boolean, number] {
  const φ = lat * DEG
  const λ = lon * DEG
  const λ0 = cLon * DEG
  const sinφ = Math.sin(φ)
  const cosφ = Math.cos(φ)
  const cosΔλ = Math.cos(λ - λ0)

  const cosC = SIN_TILT * sinφ + COS_TILT * cosφ * cosΔλ
  if (cosC < 0.02) return [0, 0, false, 0]

  const x = R * cosφ * Math.sin(λ - λ0)
  const y = -R * (COS_TILT * sinφ - SIN_TILT * cosφ * cosΔλ)

  return [CX + x, CY + y, true, cosC]
}

// ─── Sun position ────────────────────────────────────────────────

export function getSunPosition(): { lat: number; lon: number } {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const oneDay = 86_400_000
  const dayOfYear = Math.floor(diff / oneDay)

  const lat = 23.44 * Math.sin(((284 + dayOfYear) / 365) * 2 * Math.PI)

  const hours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  const lon = 180 - hours * (360 / 24)

  return { lat, lon }
}

// ─── Shaders ─────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_centerLon;
uniform float u_sunLat;
uniform float u_sunLon;
uniform sampler2D u_earthTex;
uniform float u_texReady;

const float PI = 3.141592653589793;
const float DEG = PI / 180.0;
const float GLOBE_R = ${R}.0;
const vec2 GLOBE_C = vec2(${CX}.0, ${CY}.0);
const float TILT = ${TILT}.0 * DEG;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 invOrtho(vec2 px) {
  vec2 d = px - GLOBE_C;
  d.y = -d.y;
  float rho = length(d);
  if (rho > GLOBE_R) return vec3(0.0, 0.0, 0.0);
  float c = asin(rho / GLOBE_R);
  float sinC = sin(c);
  float cosC = cos(c);
  float sinTilt = sin(TILT);
  float cosTilt = cos(TILT);
  float lat = asin(cosC * sinTilt + (d.y * sinC * cosTilt) / rho);
  float lon = u_centerLon * DEG +
    atan(d.x * sinC, rho * cosTilt * cosC - d.y * sinTilt * sinC);
  return vec3(lat, lon, 1.0);
}

float graticule(float latR, float lonR) {
  float lat = latR / DEG;
  float lon = lonR / DEG;
  float spacing = 30.0;
  float latLine = 1.0 - smoothstep(0.0, 1.8, abs(mod(lat + 90.0, spacing) - spacing * 0.5) - spacing * 0.5 + 1.8);
  float lonLine = 1.0 - smoothstep(0.0, 1.8, abs(mod(lon + 180.0, spacing) - spacing * 0.5) - spacing * 0.5 + 1.8);
  return max(latLine, lonLine);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  px.y = u_resolution.y - px.y;

  float distCenter = length(px - GLOBE_C) / length(u_resolution);
  vec3 bgColor = mix(vec3(0.02, 0.025, 0.05), vec3(0.005, 0.008, 0.015), distCenter);

  // Star field
  vec2 cell = floor(px / 3.0);
  float starRand = hash(cell);
  if (starRand > 0.997) {
    float twinkle = 0.5 + 0.5 * sin(u_time * 0.002 + starRand * 100.0);
    float brightness = starRand * twinkle;
    bgColor += vec3(brightness * 0.8, brightness * 0.75, brightness * 0.9);
  }

  vec3 geo = invOrtho(px);
  if (geo.z > 0.5) {
    float latR = geo.x;
    float lonR = geo.y;
    float globeDist = length(px - GLOBE_C) / GLOBE_R;

    // Sample earth texture if loaded
    vec3 globeColor;
    if (u_texReady > 0.5) {
      // Convert lat/lon (radians) to equirectangular UV
      float u = (lonR / PI + 1.0) * 0.5;  // 0..1
      float v = 1.0 - (latR / (PI * 0.5) + 1.0) * 0.5;  // 0..1, flipped
      vec3 texColor = texture2D(u_earthTex, vec2(u, v)).rgb;
      // Darken slightly and add blue tint to oceans (dark areas)
      float luminance = dot(texColor, vec3(0.299, 0.587, 0.114));
      vec3 tinted = mix(
        vec3(0.01, 0.02, 0.05),  // dark ocean blue
        texColor * 1.2,           // brighten land/city lights
        smoothstep(0.02, 0.08, luminance)
      );
      globeColor = tinted;
    } else {
      // Fallback: solid dark surface
      globeColor = vec3(0.025, 0.035, 0.065);
      globeColor += vec3(0.012, 0.018, 0.03) * (1.0 - globeDist);
    }

    // Subtle graticule overlay
    float grid = graticule(latR, lonR);
    globeColor += vec3(0.4, 0.3, 0.15) * grid * 0.06;

    // Day/night terminator
    float sunLatR = u_sunLat * DEG;
    float sunLonR = u_sunLon * DEG;
    float cosAngle = sin(sunLatR) * sin(latR) + cos(sunLatR) * cos(latR) * cos(lonR - sunLonR);

    float night = smoothstep(0.1, -0.1, cosAngle);
    // On the day side, darken the city lights; on night side, they glow
    if (u_texReady > 0.5) {
      globeColor *= mix(0.4, 1.0, night);  // dim day side (lights less visible in daylight)
      // Add subtle blue atmosphere on day side
      globeColor += vec3(0.02, 0.04, 0.08) * (1.0 - night) * 0.5;
    } else {
      globeColor *= mix(1.2, 0.25, night);
    }

    // Warm orange twilight glow at terminator
    float twilight = smoothstep(-0.3, 0.05, cosAngle) * smoothstep(0.3, 0.0, cosAngle);
    globeColor += vec3(0.4, 0.15, 0.03) * twilight * 0.1;

    // Warm orange rim glow
    float rim = smoothstep(0.65, 1.0, globeDist);
    globeColor += vec3(0.3, 0.15, 0.05) * rim * 0.12;

    bgColor = globeColor;
  } else {
    float distGlobe = length(px - GLOBE_C);

    // Atmospheric glow outside globe
    float atmoGlow = smoothstep(GLOBE_R + 80.0, GLOBE_R, distGlobe);
    bgColor += vec3(0.15, 0.08, 0.03) * atmoGlow * 0.06;

    // Thin bright atmospheric rim
    float rimLine = smoothstep(GLOBE_R + 6.0, GLOBE_R + 1.0, distGlobe)
                  * smoothstep(GLOBE_R - 2.0, GLOBE_R + 1.0, distGlobe);
    bgColor += vec3(0.5, 0.25, 0.08) * rimLine * 0.2;
  }

  gl_FragColor = vec4(bgColor, 1.0);
}
`

// ─── GlobeState ──────────────────────────────────────────────────

export interface GlobeState {
  gl: WebGL2RenderingContext
  uTime: WebGLUniformLocation
  uCenterLon: WebGLUniformLocation
  uSunLat: WebGLUniformLocation
  uSunLon: WebGLUniformLocation
  uTexReady: WebGLUniformLocation
}

// ─── Init / Render ───────────────────────────────────────────────

export function initGlobe(canvas: HTMLCanvasElement): GlobeState | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
  if (!gl) return null

  const vs = gl.createShader(gl.VERTEX_SHADER)
  if (!vs) return null
  gl.shaderSource(vs, VERT)
  gl.compileShader(vs)
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error('Vertex shader:', gl.getShaderInfoLog(vs))
    return null
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER)
  if (!fs) return null
  gl.shaderSource(fs, FRAG)
  gl.compileShader(fs)
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error('Fragment shader:', gl.getShaderInfoLog(fs))
    return null
  }

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program:', gl.getProgramInfoLog(program))
    return null
  }

  gl.useProgram(program)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]), gl.STATIC_DRAW)

  const aPos = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uResolution = gl.getUniformLocation(program, 'u_resolution')
  if (!uResolution) return null
  gl.uniform2f(uResolution, W, H)

  const uTime = gl.getUniformLocation(program, 'u_time')
  const uCenterLon = gl.getUniformLocation(program, 'u_centerLon')
  const uSunLat = gl.getUniformLocation(program, 'u_sunLat')
  const uSunLon = gl.getUniformLocation(program, 'u_sunLon')
  const uTexReady = gl.getUniformLocation(program, 'u_texReady')
  const uEarthTex = gl.getUniformLocation(program, 'u_earthTex')
  if (!uTime || !uCenterLon || !uSunLat || !uSunLon || !uTexReady || !uEarthTex) return null

  // Set texture unit 0
  gl.uniform1i(uEarthTex, 0)
  gl.uniform1f(uTexReady, 0.0)

  // Create placeholder texture (1x1 black)
  const tex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))

  // Load the real earth texture asynchronously
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.uniform1f(uTexReady, 1.0)
    console.log('[meteor-watch] Earth texture loaded')
  }
  img.onerror = () => {
    console.warn('[meteor-watch] Failed to load earth texture, using fallback')
  }
  img.src = EARTH_TEXTURE_URL

  return { gl, uTime, uCenterLon, uSunLat, uSunLon, uTexReady }
}

export function renderGlobe(
  state: GlobeState,
  time: number,
  cLon: number,
  sunLat: number,
  sunLon: number,
): void {
  const { gl, uTime, uCenterLon, uSunLat, uSunLon } = state
  gl.uniform1f(uTime, time)
  gl.uniform1f(uCenterLon, cLon)
  gl.uniform1f(uSunLat, sunLat)
  gl.uniform1f(uSunLon, sunLon)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

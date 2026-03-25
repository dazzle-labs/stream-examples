import type { AttractionMatrix } from './rules'

const MAX_RADIUS = 100
const MIN_RADIUS = 20
const FRICTION = 0.5
const BASE_DT = 1.0
const FORCE_SCALE = 0.5
const MAX_RADIUS_SQ = MAX_RADIUS * MAX_RADIUS

export interface ParticleSystem {
  count: number
  numSpecies: number
  posX: Float32Array
  posY: Float32Array
  velX: Float32Array
  velY: Float32Array
  species: Uint8Array
  // Interpolated positions for rendering (updated each frame)
  renderX: Float32Array
  renderY: Float32Array
}

// Spatial hash — pre-allocated, reused every frame
interface SpatialHash {
  cellCount: Int32Array    // number of particles per cell
  cellStart: Int32Array    // start index for each cell in the indices array
  indices: Int32Array      // particle indices sorted by cell
  cols: number
  rows: number
  totalCells: number
}

let spatialHash: SpatialHash | null = null
let lastGridCols = 0
let lastGridRows = 0

// Pre-allocated force accumulators — reused every frame
let forceX: Float32Array = new Float32Array(0)
let forceY: Float32Array = new Float32Array(0)

// Temp arrays for counting sort
let tempCellAssignment: Int32Array = new Int32Array(0)
let tempWriteOffset: Int32Array = new Int32Array(0)

// Previous positions for interpolation
let prevPosX: Float32Array = new Float32Array(0)
let prevPosY: Float32Array = new Float32Array(0)

// Flattened attraction matrix for cache-friendly access
let flatMatrix: Float32Array = new Float32Array(0)
let flatMatrixSpecies = 0

function ensureSpatialHash(cols: number, rows: number, particleCount: number): SpatialHash {
  const totalCells = cols * rows
  if (spatialHash && lastGridCols === cols && lastGridRows === rows && spatialHash.indices.length >= particleCount) {
    // Zero out counts
    spatialHash.cellCount.fill(0)
    return spatialHash
  }

  lastGridCols = cols
  lastGridRows = rows

  // Also resize the write-offset scratch array
  if (tempWriteOffset.length < totalCells) {
    tempWriteOffset = new Int32Array(totalCells)
  }

  spatialHash = {
    cellCount: new Int32Array(totalCells),
    cellStart: new Int32Array(totalCells),
    indices: new Int32Array(particleCount),
    cols,
    rows,
    totalCells,
  }
  return spatialHash
}

function ensureForceArrays(count: number): void {
  if (forceX.length < count) {
    forceX = new Float32Array(count)
    forceY = new Float32Array(count)
    tempCellAssignment = new Int32Array(count)
    prevPosX = new Float32Array(count)
    prevPosY = new Float32Array(count)
  }
}

function flattenMatrix(matrix: AttractionMatrix, numSpecies: number): Float32Array {
  if (flatMatrixSpecies !== numSpecies || flatMatrix.length !== numSpecies * numSpecies) {
    flatMatrix = new Float32Array(numSpecies * numSpecies)
    flatMatrixSpecies = numSpecies
  }
  for (let i = 0; i < numSpecies; i++) {
    const row = matrix[i]
    if (!row) continue
    for (let j = 0; j < numSpecies; j++) {
      flatMatrix[i * numSpecies + j] = row[j] ?? 0
    }
  }
  return flatMatrix
}

export function createParticles(
  count: number,
  numSpecies: number,
  width: number,
  height: number,
): ParticleSystem {
  const posX = new Float32Array(count)
  const posY = new Float32Array(count)
  const velX = new Float32Array(count)
  const velY = new Float32Array(count)
  const species = new Uint8Array(count)
  const renderX = new Float32Array(count)
  const renderY = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    posX[i] = Math.random() * width
    posY[i] = Math.random() * height
    // velX, velY default to 0
    species[i] = Math.floor(Math.random() * numSpecies)
    renderX[i] = posX[i]!
    renderY[i] = posY[i]!
  }

  return { count, numSpecies, posX, posY, velX, velY, species, renderX, renderY }
}

export function stepSimulation(
  system: ParticleSystem,
  matrix: AttractionMatrix,
  width: number,
  height: number,
  dtMultiplier: number,
): void {
  const { count, numSpecies, posX, posY, velX, velY, species } = system
  const cellSize = MAX_RADIUS
  const cols = Math.ceil(width / cellSize)
  const rows = Math.ceil(height / cellSize)
  const dt = BASE_DT * dtMultiplier

  const hash = ensureSpatialHash(cols, rows, count)
  ensureForceArrays(count)

  // Save previous positions for interpolation
  prevPosX.set(posX.subarray(0, count))
  prevPosY.set(posY.subarray(0, count))

  // Zero force accumulators
  forceX.fill(0, 0, count)
  forceY.fill(0, 0, count)

  // Flatten attraction matrix for cache-friendly lookup
  const flat = flattenMatrix(matrix, numSpecies)

  // --- Build spatial hash using counting sort ---
  // Phase 1: count particles per cell, assign each particle to a cell
  for (let i = 0; i < count; i++) {
    const col = Math.floor(posX[i]! / cellSize) % cols
    const row = Math.floor(posY[i]! / cellSize) % rows
    const cellIdx = row * cols + col
    tempCellAssignment[i] = cellIdx
    hash.cellCount[cellIdx]!++
  }

  // Phase 2: compute prefix sum to get start indices
  let offset = 0
  for (let c = 0; c < hash.totalCells; c++) {
    hash.cellStart[c] = offset
    offset += hash.cellCount[c]!
  }

  // Phase 3: place particle indices into sorted array
  tempWriteOffset.fill(0, 0, hash.totalCells)
  for (let i = 0; i < count; i++) {
    const cellIdx = tempCellAssignment[i]!
    const pos = hash.cellStart[cellIdx]! + tempWriteOffset[cellIdx]!
    hash.indices[pos] = i
    tempWriteOffset[cellIdx]!++
  }

  const halfWidth = width / 2
  const halfHeight = height / 2
  const invCellSize = 1.0 / cellSize

  // --- Compute forces ---
  for (let i = 0; i < count; i++) {
    const px = posX[i]!
    const py = posY[i]!
    const piCol = Math.floor(px * invCellSize) % cols
    const piRow = Math.floor(py * invCellSize) % rows
    const speciesI = species[i]!
    const speciesRowOffset = speciesI * numSpecies

    let fxAcc = 0.0
    let fyAcc = 0.0

    // Check 3x3 neighborhood of cells
    for (let dRow = -1; dRow <= 1; dRow++) {
      const nRow = ((piRow + dRow) % rows + rows) % rows
      const rowBase = nRow * cols

      for (let dCol = -1; dCol <= 1; dCol++) {
        const nCol = ((piCol + dCol) % cols + cols) % cols
        const cellIdx = rowBase + nCol

        const cellStart = hash.cellStart[cellIdx]!
        const cellEnd = cellStart + hash.cellCount[cellIdx]!

        for (let ci = cellStart; ci < cellEnd; ci++) {
          const j = hash.indices[ci]!
          if (j === i) continue

          let dx = posX[j]! - px
          let dy = posY[j]! - py

          // Toroidal wrap — use shortest distance
          if (dx > halfWidth) dx -= width
          else if (dx < -halfWidth) dx += width
          if (dy > halfHeight) dy -= height
          else if (dy < -halfHeight) dy += height

          const distSq = dx * dx + dy * dy
          if (distSq > MAX_RADIUS_SQ || distSq < 0.0001) continue

          const dist = Math.sqrt(distSq)
          let force: number

          if (dist < MIN_RADIUS) {
            // Repulsive at very close range
            force = (dist / MIN_RADIUS - 1) * FORCE_SCALE
          } else {
            const normalizedDist = (dist - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)
            const attraction = flat[speciesRowOffset + species[j]!]!
            force = attraction * (1 - Math.abs(2 * normalizedDist - 1)) * FORCE_SCALE
          }

          const invDist = 1.0 / dist
          fxAcc += force * dx * invDist
          fyAcc += force * dy * invDist
        }
      }
    }

    forceX[i] = fxAcc
    forceY[i] = fyAcc
  }

  // --- Apply forces, friction, and wrap positions ---
  for (let i = 0; i < count; i++) {
    const fxi = forceX[i]!
    const fyi = forceY[i]!

    const newVx = (velX[i]! + fxi * dt) * FRICTION
    const newVy = (velY[i]! + fyi * dt) * FRICTION

    velX[i] = newVx
    velY[i] = newVy

    posX[i] = ((posX[i]! + newVx * dt) % width + width) % width
    posY[i] = ((posY[i]! + newVy * dt) % height + height) % height
  }

  // Copy current positions to render positions (will be overridden by interpolation on skip frames)
  system.renderX.set(posX.subarray(0, count))
  system.renderY.set(posY.subarray(0, count))
}

export function interpolatePositions(
  system: ParticleSystem,
  t: number,
  width: number,
  height: number,
): void {
  const { count, posX, posY, renderX, renderY } = system
  const halfWidth = width / 2
  const halfHeight = height / 2

  for (let i = 0; i < count; i++) {
    let prevX = prevPosX[i]!
    let prevY = prevPosY[i]!
    const curX = posX[i]!
    const curY = posY[i]!

    // Handle toroidal wrapping for interpolation
    let dx = curX - prevX
    let dy = curY - prevY
    if (dx > halfWidth) prevX += width
    else if (dx < -halfWidth) prevX -= width
    if (dy > halfHeight) prevY += height
    else if (dy < -halfHeight) prevY -= height

    dx = curX - prevX
    dy = curY - prevY

    renderX[i] = ((prevX + dx * t) % width + width) % width
    renderY[i] = ((prevY + dy * t) % height + height) % height
  }
}

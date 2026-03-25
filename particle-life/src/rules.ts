const NUM_SPECIES = 8

export type AttractionMatrix = number[][]

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function generateRandomMatrix(): AttractionMatrix {
  const matrix: AttractionMatrix = []

  for (let i = 0; i < NUM_SPECIES; i++) {
    const row: number[] = []
    for (let j = 0; j < NUM_SPECIES; j++) {
      row.push(randomInRange(-1, 1))
    }
    matrix.push(row)
  }

  // Ensure at least some strong attractions and repulsions for interesting behavior
  const strongCount = 4 + Math.floor(Math.random() * 4)
  for (let k = 0; k < strongCount; k++) {
    const i = Math.floor(Math.random() * NUM_SPECIES)
    const j = Math.floor(Math.random() * NUM_SPECIES)
    const row = matrix[i]
    if (row) {
      row[j] = randomInRange(0.5, 1.0)
    }
  }

  const repulseCount = 3 + Math.floor(Math.random() * 4)
  for (let k = 0; k < repulseCount; k++) {
    const i = Math.floor(Math.random() * NUM_SPECIES)
    const j = Math.floor(Math.random() * NUM_SPECIES)
    const row = matrix[i]
    if (row) {
      row[j] = randomInRange(-1.0, -0.5)
    }
  }

  return matrix
}

/** Mutates `current` in place toward `target` by factor `t`. No allocation. */
export function lerpMatrix(
  current: AttractionMatrix,
  target: AttractionMatrix,
  t: number,
): AttractionMatrix {
  for (let i = 0; i < NUM_SPECIES; i++) {
    const currentRow = current[i]
    const targetRow = target[i]
    if (!currentRow || !targetRow) continue
    for (let j = 0; j < NUM_SPECIES; j++) {
      const currentVal = currentRow[j] ?? 0
      const targetVal = targetRow[j] ?? 0
      currentRow[j] = currentVal + (targetVal - currentVal) * t
    }
  }
  return current
}

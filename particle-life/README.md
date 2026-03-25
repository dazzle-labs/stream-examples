# Particle Life

An emergent artificial life simulation where simple asymmetric attraction rules between particle species produce stunningly complex behaviors — predator-prey dynamics, flowing rivers, oscillating clusters, and cell-like structures.

## What it demonstrates

- **Emergent complexity from simple rules**: A 6x6 attraction matrix governs how 6 particle species interact. Red might chase blue while blue flees red. These asymmetric relationships create lifelike dynamics with no explicit programming of behavior.
- **Spatial hashing optimization**: 4,000 particles with O(n*k) neighbor lookups via grid-based spatial partitioning, keeping the simulation smooth at 30fps.
- **Rule evolution**: The attraction matrix smoothly morphs to new random values every 30-60 seconds, preventing the system from settling into static equilibrium and creating continuous visual evolution.
- **Bioluminescent rendering**: Additive blending, soft glow effects, and particle trails create a deep-sea microscopy aesthetic.

## How to run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a browser. For production build:

```bash
npm run build
npm run preview
```

## What you should see

A dark void filled with thousands of glowing particles in six bioluminescent colors. Within seconds, they self-organize into flowing structures — streams of particles chasing each other, clusters that pulse and breathe, species that orbit around each other in dynamic equilibrium. Every 30-60 seconds the rules quietly shift, dissolving old structures and birthing new ones. No two moments are alike.

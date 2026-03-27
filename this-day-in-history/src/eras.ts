import type { Era } from './types'

const ERAS: { maxYear: number, era: Era }[] = [
  { maxYear: 1499, era: { name: 'ANCIENT', yearRange: [0, 1499], accent: '#c9853a', sepia: 0.85, saturation: 0.35, backgroundTint: 'rgba(139,105,20,0.15)', titleFont: "'Cinzel', serif", bodyFont: "'Cormorant Garamond', serif", backgroundImage: '/era-backgrounds/ancient.jpg' } },
  { maxYear: 1699, era: { name: 'RENAISSANCE', yearRange: [1500, 1699], accent: '#d4a252', sepia: 0.7, saturation: 0.45, backgroundTint: 'rgba(180,140,50,0.12)', titleFont: "'Cinzel', serif", bodyFont: "'Cormorant Garamond', serif", backgroundImage: '/era-backgrounds/renaissance.jpg' } },
  { maxYear: 1799, era: { name: 'ENLIGHTENMENT', yearRange: [1700, 1799], accent: '#b8944a', sepia: 0.55, saturation: 0.55, backgroundTint: 'rgba(160,130,60,0.10)', titleFont: "'Cormorant Garamond', serif", bodyFont: "'Source Serif 4', serif", backgroundImage: '/era-backgrounds/enlightenment.jpg' } },
  { maxYear: 1869, era: { name: 'INDUSTRIAL', yearRange: [1800, 1869], accent: '#a08050', sepia: 0.4, saturation: 0.65, backgroundTint: 'rgba(140,110,50,0.08)', titleFont: "'Cormorant Garamond', serif", bodyFont: "'Source Serif 4', serif", backgroundImage: '/era-backgrounds/industrial.jpg' } },
  { maxYear: 1913, era: { name: 'BELLE EPOQUE', yearRange: [1870, 1913], accent: '#c4a35a', sepia: 0.3, saturation: 0.7, backgroundTint: 'rgba(160,130,60,0.06)', titleFont: "'Playfair Display', serif", bodyFont: "'Source Serif 4', serif", backgroundImage: '/era-backgrounds/belle-epoque.jpg' } },
  { maxYear: 1945, era: { name: 'WORLD WARS', yearRange: [1914, 1945], accent: '#8a8a7a', sepia: 0.15, saturation: 0.5, backgroundTint: 'rgba(100,100,90,0.08)', titleFont: "'Playfair Display', serif", bodyFont: "'Source Serif 4', serif", backgroundImage: '/era-backgrounds/world-wars.jpg' } },
  { maxYear: 1968, era: { name: 'POST-WAR', yearRange: [1946, 1968], accent: '#e0c870', sepia: 0.08, saturation: 0.8, backgroundTint: 'rgba(180,160,80,0.05)', titleFont: "'Source Serif 4', serif", bodyFont: "'DM Sans', sans-serif", backgroundImage: '/era-backgrounds/post-war.jpg' } },
  { maxYear: 1984, era: { name: 'SPACE AGE', yearRange: [1969, 1984], accent: '#4ade80', sepia: 0.0, saturation: 0.85, backgroundTint: 'rgba(50,180,80,0.05)', titleFont: "'Source Serif 4', serif", bodyFont: "'DM Sans', sans-serif", backgroundImage: '/era-backgrounds/space-age.jpg' } },
  { maxYear: 1995, era: { name: 'DIGITAL DAWN', yearRange: [1985, 1995], accent: '#38bdf8', sepia: 0.0, saturation: 0.9, backgroundTint: 'rgba(50,150,220,0.05)', titleFont: "'DM Sans', sans-serif", bodyFont: "'Inter', sans-serif", backgroundImage: '/era-backgrounds/digital-dawn.jpg' } },
  { maxYear: 2004, era: { name: 'DOT-COM ERA', yearRange: [1996, 2004], accent: '#3b82f6', sepia: 0.0, saturation: 0.95, backgroundTint: 'rgba(50,100,200,0.05)', titleFont: "'DM Sans', sans-serif", bodyFont: "'Inter', sans-serif", backgroundImage: '/era-backgrounds/dot-com.jpg' } },
  { maxYear: 2012, era: { name: 'SOCIAL AGE', yearRange: [2005, 2012], accent: '#6366f1', sepia: 0.0, saturation: 1.0, backgroundTint: 'rgba(80,80,200,0.04)', titleFont: "'Space Grotesk', sans-serif", bodyFont: "'Inter', sans-serif", backgroundImage: '/era-backgrounds/social-age.jpg' } },
  { maxYear: 2018, era: { name: 'MOBILE ERA', yearRange: [2013, 2018], accent: '#8b5cf6', sepia: 0.0, saturation: 1.0, backgroundTint: 'rgba(120,70,220,0.04)', titleFont: "'Space Grotesk', sans-serif", bodyFont: "'Inter', sans-serif", backgroundImage: '/era-backgrounds/mobile-era.jpg' } },
  { maxYear: 2023, era: { name: 'STREAMING ERA', yearRange: [2019, 2023], accent: '#a78bfa', sepia: 0.0, saturation: 1.05, backgroundTint: 'rgba(140,100,220,0.04)', titleFont: "'Space Grotesk', sans-serif", bodyFont: "'Inter', sans-serif", backgroundImage: '/era-backgrounds/streaming-era.jpg' } },
  { maxYear: Infinity, era: { name: 'NOW', yearRange: [2024, 2099], accent: '#00e5ff', sepia: 0.0, saturation: 1.1, backgroundTint: 'rgba(0,200,255,0.04)', titleFont: "'Space Grotesk', sans-serif", bodyFont: "'Inter', sans-serif", backgroundImage: '/era-backgrounds/now.jpg' } },
]

export function getEra(year: number): Era {
  for (const entry of ERAS) {
    if (year <= entry.maxYear) return entry.era
  }
  return ERAS[ERAS.length - 1]!.era
}

export function getAllEras(): Era[] {
  return ERAS.map((entry) => entry.era)
}

import { useState, useEffect, useMemo } from 'react'
import { store } from '../data/store'
import type { CVEEntry } from '../data/types'

type MaturityStage = 'published' | 'advisory' | 'poc' | 'weaponized' | 'commoditized'

interface StageDefinition {
  key: MaturityStage
  label: string
  color: string
}

const STAGES: StageDefinition[] = [
  { key: 'published', label: 'PUBLISHED', color: '#00e5ff' },
  { key: 'advisory', label: 'ADVISORY', color: '#0077b6' },
  { key: 'poc', label: 'POC AVAILABLE', color: '#ffbe0b' },
  { key: 'weaponized', label: 'WEAPONIZED', color: '#f77f00' },
  { key: 'commoditized', label: 'COMMODITIZED', color: '#ef233c' },
]

function classifyCVE(cve: CVEEntry): MaturityStage {
  if (cve.isKEV) return 'weaponized'
  if (cve.severity === 'critical') return 'poc'
  if (cve.severity === 'high') return 'advisory'
  return 'published'
}

function truncateDescription(description: string, maxLength: number): string {
  if (description.length <= maxLength) return description
  return description.slice(0, maxLength) + '...'
}

function CVECard({ cve, stage }: { cve: CVEEntry; stage: StageDefinition }) {
  const stageIndex = STAGES.findIndex(stageItem => stageItem.key === stage.key)
  const intensity = 0.08 + stageIndex * 0.06

  return (
    <div
      className="px-3 py-2 rounded mb-2 font-mono"
      style={{
        background: `rgba(${hexToRgb(stage.color)}, ${intensity})`,
        border: `1px solid ${stage.color}33`,
        transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-base font-bold tracking-wide" style={{ color: stage.color }}>
          {cve.id}
        </span>
        {cve.cvssScore > 0 && (
          <span
            className="text-[16px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: stage.color,
              color: '#010208',
            }}
          >
            {cve.cvssScore.toFixed(1)}
          </span>
        )}
      </div>
      <div className="text-[16px] leading-tight" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
        {truncateDescription(cve.description, 80)}
      </div>
    </div>
  )
}

function hexToRgb(hex: string): string {
  const bigint = parseInt(hex.slice(1), 16)
  const red = (bigint >> 16) & 255
  const green = (bigint >> 8) & 255
  const blue = bigint & 255
  return `${red}, ${green}, ${blue}`
}

function StageColumn({ stage, cves }: { stage: StageDefinition; cves: CVEEntry[] }) {
  return (
    <div className="flex-1 flex flex-col min-w-0 px-2">
      <div className="text-center mb-4">
        <div
          className="text-[16px] font-mono font-bold uppercase tracking-wider mb-1"
          style={{ color: stage.color }}
        >
          {stage.label}
        </div>
        <div
          className="text-[16px] font-mono"
          style={{ color: `${stage.color}88` }}
        >
          {cves.length}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {cves.slice(0, 4).map(cve => (
          <CVECard key={cve.id} cve={cve} stage={stage} />
        ))}
      </div>
    </div>
  )
}

export function LifecycleScene() {
  const [_, setTick] = useState(0)

  useEffect(() => {
    const handle = setInterval(() => setTick(previous => previous + 1), 2000)
    return () => clearInterval(handle)
  }, [])

  const stageBuckets = useMemo(() => {
    const buckets: Record<MaturityStage, CVEEntry[]> = {
      published: [],
      advisory: [],
      poc: [],
      weaponized: [],
      commoditized: [],
    }

    const allCVEs = [...store.recentCVEs]
    allCVEs.sort((cveA, cveB) => cveB.cvssScore - cveA.cvssScore)

    for (const cve of allCVEs) {
      const stage = classifyCVE(cve)
      const bucket = buckets[stage]
      if (bucket.length < 8) {
        bucket.push(cve)
      }
    }

    return buckets
  }, [_])

  const totalClassified = Object.values(stageBuckets).reduce(
    (sum, bucket) => sum + bucket.length,
    0,
  )

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at center, #0a0800 0%, #010208 70%)' }}
    >
      <style>{`
        @keyframes pipeline-flow {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        @keyframes stage-enter {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex items-center justify-between px-12 pt-8 pb-2">
        <div>
          <div
            className="text-[16px] font-mono uppercase tracking-[0.3em] mb-1"
            style={{ color: 'rgba(255, 255, 255, 0.25)' }}
          >
            EXPLOIT MATURITY PIPELINE
          </div>
          <div className="text-base font-mono" style={{ color: 'rgba(255, 255, 255, 0.15)' }}>
            MEDIAN TIME CVE → EXPLOIT: DATA PENDING
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold" style={{ color: '#f77f00' }}>
            {totalClassified}
          </div>
          <div className="text-[16px] font-mono uppercase tracking-wider" style={{ color: 'rgba(247, 127, 0, 0.6)' }}>
            CVES TRACKED
          </div>
        </div>
      </div>

      <div className="relative mx-12 my-4 h-px">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, rgba(247, 127, 0, 0.3) 0, rgba(247, 127, 0, 0.3) 8px, transparent 8px, transparent 20px)',
            backgroundSize: '40px 1px',
            animation: 'pipeline-flow 2s linear infinite',
          }}
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
          style={{
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderLeft: '6px solid rgba(247, 127, 0, 0.4)',
          }}
        />
      </div>

      <div className="flex-1 flex px-10 pb-8 gap-1">
        {STAGES.map((stage, index) => (
          <div
            key={stage.key}
            className="flex-1 flex flex-col"
            style={{ animation: `stage-enter 0.5s ease-out ${index * 100}ms both` }}
          >
            <StageColumn stage={stage} cves={stageBuckets[stage.key]} />
            {index < STAGES.length - 1 && (
              <div className="absolute" />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-8 pb-6">
        {STAGES.map(stage => {
          const count = stageBuckets[stage.key].length
          return (
            <div key={stage.key} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: stage.color, opacity: count > 0 ? 1 : 0.3 }}
              />
              <span className="text-[16px] font-mono" style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

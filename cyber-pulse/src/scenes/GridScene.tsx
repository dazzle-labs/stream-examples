import { useState, useEffect } from 'react'
import { store } from '../data/store'
import type { ServiceStatus } from '../data/types'

const SERVICE_KEYS = [
  'GitHub',
  'Cloudflare',
  'Discord',
  'OpenAI',
  'Datadog',
  'Reddit',
  'Atlassian',
  'GCP',
  'AWS',
] as const

function indicatorColor(indicator: string): string {
  if (indicator === 'none' || indicator === 'operational') return '#06d6a0'
  if (indicator === 'minor') return '#ffbe0b'
  if (indicator === 'major') return '#f77f00'
  if (indicator === 'critical') return '#ef233c'
  return '#06d6a0'
}

function isDegraded(indicator: string): boolean {
  return indicator !== 'none' && indicator !== 'operational' && indicator !== ''
}

function ServiceCard({
  name,
  status,
  index,
}: {
  name: string
  status: ServiceStatus | undefined
  index: number
}) {
  const indicator = status?.indicator ?? 'none'
  const color = indicatorColor(indicator)
  const degraded = isDegraded(indicator)
  const animationDelay = `${index * 0.3}s`
  const animationDuration = degraded ? '1.5s' : '4s'

  return (
    <div
      className="relative flex flex-col justify-between p-4 rounded-sm overflow-hidden"
      style={{
        background: '#08080f',
        border: `1px solid ${degraded ? color + '40' : '#1a1a2a'}`,
        animation: `card-breathe ${animationDuration} ease-in-out ${animationDelay} infinite`,
      }}
    >
      {degraded && (
        <div
          className="absolute inset-0 pointer-events-none rounded-sm"
          style={{
            boxShadow: `inset 0 0 30px ${color}15, 0 0 20px ${color}10`,
          }}
        />
      )}

      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex-shrink-0 rounded-full"
          style={{
            width: 8,
            height: 8,
            background: color,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
        <span className="text-white font-mono font-bold text-lg uppercase tracking-wider">
          {name}
        </span>
      </div>

      <div
        className="font-mono text-base leading-snug truncate"
        style={{ color: degraded ? color : '#606070' }}
      >
        {status?.description ?? 'Checking...'}
      </div>
    </div>
  )
}

export function GridScene() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const handle = setInterval(() => setTick(previous => previous + 1), 2000)
    return () => clearInterval(handle)
  }, [])

  void tick

  const statuses = store.serviceStatuses
  const operationalCount = SERVICE_KEYS.filter(key => {
    const service = statuses[key]
    return !service || !isDegraded(service.indicator)
  }).length

  const allOperational = operationalCount === SERVICE_KEYS.length

  const mostRecentIncident = SERVICE_KEYS
    .map(key => statuses[key])
    .filter((service): service is ServiceStatus => service !== undefined && isDegraded(service.indicator))
    .sort((serviceA, serviceB) =>
      new Date(serviceB.updatedAt).getTime() - new Date(serviceA.updatedAt).getTime(),
    )[0]

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a1a14 0%, #010208 70%)' }}
    >
      <style>{`
        @keyframes card-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes all-clear-pulse {
          0%, 100% { opacity: 0.04; }
          50% { opacity: 0.08; }
        }
      `}</style>

      <div className="flex-shrink-0 px-10 pt-8 pb-4">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono font-bold tracking-tight"
            style={{
              fontSize: '56px',
              color: allOperational ? '#06d6a0' : '#ffbe0b',
            }}
          >
            {operationalCount}/{SERVICE_KEYS.length}
          </span>
          <span className="font-mono text-lg uppercase tracking-wider text-gray-500">
            SERVICES OPERATIONAL
          </span>
        </div>
      </div>

      <div className="flex-1 relative px-10 pb-4">
        {allOperational && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ animation: 'all-clear-pulse 5s ease-in-out infinite' }}
          >
            <span
              className="font-mono font-bold uppercase tracking-widest text-center"
              style={{ fontSize: '48px', color: '#06d6a0' }}
            >
              ALL SYSTEMS OPERATIONAL
            </span>
          </div>
        )}

        <div
          className="grid h-full"
          style={{
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
            gap: '12px',
          }}
        >
          {SERVICE_KEYS.map((key, index) => (
            <ServiceCard
              key={key}
              name={key}
              status={statuses[key]}
              index={index}
            />
          ))}
        </div>
      </div>

      {mostRecentIncident && (
        <div className="flex-shrink-0 px-10 pb-6">
          <div className="font-mono text-base text-gray-600 uppercase tracking-wider mb-1">
            LATEST INCIDENT
          </div>
          <div className="font-mono text-base truncate" style={{ color: '#808090' }}>
            {mostRecentIncident.name}: {mostRecentIncident.description}
          </div>
        </div>
      )}
    </div>
  )
}

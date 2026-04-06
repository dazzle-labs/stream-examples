import type { Milestone } from '../data/types'
import { formatCountdown } from '../data/mission'

interface MilestoneTimelineProps {
  milestones: Milestone[]
  met: number
}

export function MilestoneTimeline({ milestones, met }: MilestoneTimelineProps) {
  // Show: last 2 completed + first 6 upcoming
  const completed = milestones.filter(m => m.completed)
  const upcoming = milestones.filter(m => !m.completed)
  const visible = [
    ...completed.slice(-2),
    ...upcoming.slice(0, 6),
  ]

  return (
    <div
      className="absolute left-3 top-[58px] w-[310px] z-10 panel-glass rounded-lg overflow-hidden"
      style={{ maxHeight: 'calc(100% - 106px)' }}
    >
      <div className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(0, 229, 255, 0.1)' }}
      >
        <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: '#505868' }}>
          Mission Timeline
        </span>
        <span className="text-[9px] tabular-nums" style={{ color: '#404858' }}>
          {completed.length}/{milestones.length}
        </span>
      </div>

      <div className="px-3 py-1.5">
        {visible.map((milestone, i) => {
          const isLast = i === visible.length - 1
          const secondsUntil = milestone.metSeconds - met
          const isNext = !milestone.completed && (i === 0 || visible[i - 1]?.completed)

          return (
            <div key={milestone.label} className="flex gap-2.5" style={{ opacity: milestone.completed ? 0.5 : 1 }}>
              {/* Timeline line */}
              <div className="flex flex-col items-center w-3 shrink-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${isNext ? 'pulse-glow' : ''}`}
                  style={{
                    background: milestone.completed ? '#51cf66'
                      : isNext ? '#00e5ff'
                      : 'rgba(0, 229, 255, 0.15)',
                    border: milestone.completed ? 'none' : `1px solid ${isNext ? '#00e5ff' : 'rgba(0, 229, 255, 0.2)'}`,
                    boxShadow: isNext ? '0 0 8px rgba(0, 229, 255, 0.5)' : 'none',
                  }}
                />
                {!isLast && (
                  <div
                    className="w-px flex-1 my-0.5"
                    style={{
                      background: milestone.completed
                        ? 'rgba(81, 207, 102, 0.3)'
                        : 'rgba(0, 229, 255, 0.1)',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`pb-2 min-w-0 ${isNext ? 'fade-in-up' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-[11px] leading-tight"
                    style={{
                      color: milestone.completed ? '#606880'
                        : isNext ? '#ffffff'
                        : '#909ab0',
                    }}
                  >
                    {milestone.label}
                  </span>
                  <span
                    className="text-[9px] tabular-nums shrink-0 mt-0.5"
                    style={{
                      color: milestone.completed ? '#405038'
                        : isNext ? '#00e5ff'
                        : '#404858',
                    }}
                  >
                    {milestone.completed ? 'DONE' : formatCountdown(secondsUntil)}
                  </span>
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: '#404858' }}>
                  Day {milestone.flightDay}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

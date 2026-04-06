const CREW = [
  { name: 'Reid Wiseman', role: 'Commander' },
  { name: 'Victor Glover', role: 'Pilot' },
  { name: 'Christina Koch', role: 'Mission Specialist' },
  { name: 'Jeremy Hansen', role: 'Mission Specialist' },
] as const

function CrewRow({ name, role }: { name: string, role: string }) {
  return (
    <div className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid rgba(0, 229, 255, 0.05)' }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#51cf66' }} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold truncate" style={{ color: '#c8d6e5' }}>
          {name}
        </div>
        <div className="text-[8px]" style={{ color: '#505868' }}>{role}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[7px] uppercase" style={{ color: '#51cf66' }}>
          NOMINAL
        </div>
      </div>
    </div>
  )
}

export function CrewPanel() {
  return (
    <div className="absolute left-3 bottom-[48px] w-[200px] z-10 panel-glass rounded-lg">
      <div className="px-3 py-1.5" style={{ borderBottom: '1px solid rgba(0, 229, 255, 0.1)' }}>
        <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: '#505868' }}>
          Crew Status
        </span>
      </div>
      <div className="px-3 py-1">
        {CREW.map((member) => (
          <CrewRow key={member.name} name={member.name} role={member.role} />
        ))}
      </div>
    </div>
  )
}

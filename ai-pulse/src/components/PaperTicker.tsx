import type { Paper } from '../types'

const CATEGORY_COLORS: Record<string, string> = {
  'cs.AI': '#00d4ff',
  'cs.LG': '#00e676',
  'cs.CL': '#ffab00',
  'cs.CV': '#ff2d55',
  'stat.ML': '#a78bfa',
}

interface PaperTickerProps {
  papers: Paper[]
}

export function PaperTicker({ papers }: PaperTickerProps) {
  const doubled = [...papers, ...papers]

  return (
    <div
      className="relative overflow-hidden shrink-0"
      style={{
        height: 30,
        background: 'rgba(3, 7, 11, 0.9)',
        borderTop: '1px solid rgba(0, 212, 255, 0.06)',
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center shrink-0"
        style={{
          padding: '0 10px',
          zIndex: 2,
          background: 'linear-gradient(90deg, rgba(3, 7, 11, 0.95) 70%, transparent)',
        }}
      >
        <span
          className="font-mono text-[8px] font-bold uppercase text-primary-dim"
          style={{ letterSpacing: '0.08em' }}
        >
          ARXIV
        </span>
      </div>

      <div
        className="absolute flex items-center"
        style={{
          top: 0,
          left: 50,
          right: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center whitespace-nowrap"
          style={{
            gap: 32,
            animation: `ticker-scroll ${papers.length * 6}s linear infinite`,
          }}
        >
          {doubled.map((paper, index) => {
            const categoryColor = CATEGORY_COLORS[paper.category] ?? '#5a7089'
            return (
              <div
                key={`${paper.id}-${index}`}
                className="flex items-center shrink-0"
                style={{ gap: 8 }}
              >
                <span
                  className="font-mono text-[8px] font-semibold uppercase"
                  style={{ color: categoryColor }}
                >
                  {paper.category}
                </span>
                <span className="font-mono text-[10px] text-text-secondary">
                  {paper.title.length > 60
                    ? paper.title.slice(0, 60) + '...'
                    : paper.title}
                </span>
                <span className="font-mono text-[9px] text-text-dim">
                  &#9650;{paper.upvotes}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import type { TrendingModel } from '../types'

const PIPELINE_COLORS: Record<string, string> = {
  'text-generation': '#00d4ff',
  'text-to-image': '#ff2d55',
  'text-to-speech': '#ffab00',
  'automatic-speech-recognition': '#00e676',
}

interface ModelTickerProps {
  models: TrendingModel[]
}

export function ModelTicker({ models }: ModelTickerProps) {
  const doubled = [...models, ...models]

  return (
    <div
      className="relative overflow-hidden shrink-0"
      style={{
        height: 44,
        background: 'rgba(0, 212, 255, 0.02)',
      }}
    >
      <div className="flex items-center" style={{ gap: 6, padding: '0 12px', height: '100%' }}>
        <span
          className="font-mono text-[8px] font-bold uppercase text-text-dim shrink-0"
          style={{ letterSpacing: '0.1em' }}
        >
          TRENDING
        </span>
        <div
          className="w-px shrink-0"
          style={{ height: 16, background: 'rgba(0, 212, 255, 0.1)' }}
        />
      </div>

      <div
        className="absolute flex items-center"
        style={{
          top: 0,
          left: 90,
          right: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center whitespace-nowrap"
          style={{
            gap: 24,
            animation: `ticker-scroll ${models.length * 4}s linear infinite`,
          }}
        >
          {doubled.map((model, index) => {
            const pipelineColor = PIPELINE_COLORS[model.pipeline] ?? '#5a7089'
            return (
              <div
                key={`${model.id}-${index}`}
                className="flex items-center shrink-0"
                style={{ gap: 8 }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 4, height: 4, background: pipelineColor }}
                />
                <span className="font-mono text-[10px] text-text-secondary">
                  {model.author}/
                </span>
                <span className="font-mono text-[10px] font-semibold text-text">
                  {model.name}
                </span>
                <span
                  className="font-mono text-[9px]"
                  style={{ color: '#ffab00' }}
                >
                  {model.likes >= 1000
                    ? `${(model.likes / 1000).toFixed(1)}K`
                    : model.likes}
                  &thinsp;&#9829;
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

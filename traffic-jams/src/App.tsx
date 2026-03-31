import { useTrafficCycle } from './useTrafficCycle'
import { TrafficMap } from './TrafficMap'
import { TitleBar, LowerThird, CityStats, TuningOverlay } from './Overlays'

export function App() {
  const cycle = useTrafficCycle()

  return (
    <div className="relative w-[1280px] h-[720px] bg-black overflow-hidden">
      <TrafficMap
        city={cycle.currentCity}
        nextCity={cycle.nextCity}
        data={cycle.currentData}
        phase={cycle.phase}
      />
      <TuningOverlay city={cycle.currentCity} phase={cycle.phase} />
      <TitleBar summary={cycle.nationalSummary} />
      <LowerThird
        city={cycle.currentCity}
        data={cycle.currentData}
        phase={cycle.phase}
      />
      <CityStats
        data={cycle.currentData}
        phase={cycle.phase}
      />
    </div>
  )
}

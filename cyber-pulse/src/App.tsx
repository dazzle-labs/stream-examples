import { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { SceneManager } from './components/SceneManager'
import { BottomTicker } from './components/BottomTicker'

export function App() {
  useEffect(() => {
    import('./data/polling').then(
      module => module.startPolling(),
      () => {},
    )
    import('./data/websockets').then(
      module => module.startWebSockets(),
      () => {},
    )
  }, [])

  return (
    <div className="relative w-[1280px] h-[720px] overflow-hidden" style={{ backgroundColor: '#010208' }}>
      <TopBar />
      <div className="absolute inset-0" style={{ top: '44px', bottom: '24px' }}>
        <SceneManager />
      </div>
      <BottomTicker />
    </div>
  )
}

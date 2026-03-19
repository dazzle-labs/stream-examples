import { Player } from '@remotion/player'
import { Composition } from './Composition'

// 30fps, 20 seconds per loop (600 frames).
// Dazzle captures at 30fps so this matches perfectly.
const FPS = 30
const DURATION_FRAMES = 600
const WIDTH = 1280
const HEIGHT = 720

export function App() {
  return (
    <Player
      component={Composition}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      loop
      autoPlay
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}

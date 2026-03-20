import { useEffect, useRef, useState } from 'react'
import { VERT, FRAG } from './shaders'
import { initAudio } from './audio'

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error('Shader error:', gl.getShaderInfoLog(s))
  return s
}

export function Hyperstructure() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    if (!gl) { console.error('WebGL2 not available'); return }

    // Procedural audio
    const audio = initAudio()

    // Shader program
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      console.error('Link error:', gl.getProgramInfoLog(program))

    // Full-screen quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'u_time')
    const uRes = gl.getUniformLocation(program, 'u_res')
    gl.useProgram(program)
    gl.uniform2f(uRes, canvas.width, canvas.height)

    const t0 = performance.now()
    const fpsBuf: number[] = []
    let prev = t0
    let raf: number

    const render = () => {
      const now = performance.now()
      const elapsed = (now - t0) / 1000
      gl.uniform1f(uTime, elapsed)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      audio.update(elapsed)

      const dt = now - prev
      prev = now
      if (dt > 0 && dt < 5000) {
        fpsBuf.push(1000 / dt)
        if (fpsBuf.length > 30) fpsBuf.shift()
        setFps(Math.round(fpsBuf.reduce((a, b) => a + b) / fpsBuf.length))
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      audio.ctx.close()
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: 1280, height: 720, background: '#000', overflow: 'hidden' }}>
      <canvas ref={canvasRef} width={1280} height={720}
        style={{ width: 1280, height: 720 }} />

      <div style={{
        position: 'absolute', top: 20, left: 20,
        fontFamily: 'monospace', fontSize: 12,
        backgroundColor: 'rgba(0,10,20,0.7)', padding: '6px 10px',
        borderRadius: 2, border: '1px solid rgba(0,229,255,0.2)',
      }}>
        <div style={{
          color: fps < 15 ? '#ff2060' : fps < 25 ? '#ffaa00' : '#00e5ff',
          fontWeight: 'bold',
          textShadow: `0 0 6px ${fps < 15 ? 'rgba(255,32,96,0.5)' : fps < 25 ? 'rgba(255,170,0,0.5)' : 'rgba(0,229,255,0.5)'}`,
        }}>
          {fps} FPS
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 40, left: 20,
        fontFamily: 'monospace', fontSize: 28, fontWeight: 'bold',
        color: '#00e5ff', letterSpacing: '4px',
        textShadow: '0 0 20px rgba(0,229,255,0.8), 0 0 60px rgba(0,229,255,0.3)',
        backgroundColor: 'rgba(0,10,20,0.75)', padding: '10px 20px',
        borderRadius: 2, border: '1px solid rgba(0,229,255,0.4)',
      }}>
        HYPERSTRUCTURE
      </div>
    </div>
  )
}

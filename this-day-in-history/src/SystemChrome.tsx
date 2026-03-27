export function SystemChrome() {
  return (
    <>
      <div className="scanline-overlay" />

      <div
        className="font-mono"
        style={{
          position: 'fixed',
          bottom: 68,
          right: 40,
          fontSize: 10,
          letterSpacing: '0.1em',
          opacity: 0.2,
          color: 'white',
          zIndex: 20,
        }}
      >
        THIS DAY IN HISTORY
      </div>
    </>
  )
}

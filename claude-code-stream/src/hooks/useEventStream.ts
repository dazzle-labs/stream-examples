import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventType, FeedEvent, FileEntry, AgentEntry, SessionStats, UsageData } from '../types'
import { NOISE_TOOLS } from '../types'

let eventCounter = 0
function nextId() {
  return `evt-${++eventCounter}`
}

function shortPath(p: string): string {
  const parts = p.split('/')
  const skip = new Set(['Users', 'home', 'var', 'tmp', 'private'])
  const meaningful = parts.filter(s => s && !skip.has(s))
  return meaningful.slice(-3).join('/')
}

function fileName(p: string): string {
  return p.split('/').pop() ?? p
}

function getAccent(type: string): FeedEvent['accent'] {
  if (type === 'user_message') return 'white'
  if (type === 'assistant_message') return 'claude'
  if (type === 'error') return 'error'
  return 'cyan'
}

function getLabel(type: string, tool?: string): string {
  if (type === 'user_message') return 'USER'
  if (type === 'assistant_message') return 'CLAUDE'
  if (type === 'agent_start') return 'AGENT'
  if (type === 'error') return 'ERROR'
  if (type === 'notification') return 'NOTICE'
  if (!tool) return 'EVENT'
  const labels: Record<string, string> = {
    Read: 'READING',
    Edit: 'EDITING',
    Write: 'CREATING',
    Bash: 'EXECUTING',
    Grep: 'SEARCHING',
    Glob: 'SCANNING',
    Agent: 'AGENT',
    WebFetch: 'FETCHING',
    WebSearch: 'SEARCHING',
  }
  return labels[tool] ?? tool.toUpperCase()
}

export function useEventStream() {
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [files, setFiles] = useState<Map<string, FileEntry>>(new Map())
  const [agents, setAgents] = useState<Map<string, AgentEntry>>(new Map())
  const [stats, setStats] = useState<SessionStats>({
    reads: 0, edits: 0, writes: 0, commands: 0, searches: 0, errors: 0, linesAdded: 0,
  })
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [model, setModel] = useState<string>('')
  const [totalEvents, setTotalEvents] = useState(0)

  const sparklineRef = useRef<number[]>(new Array(120).fill(0))
  const lastBucketRef = useRef(Math.floor(Date.now() / 1000))

  const recordSparkline = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const bucket = now % 120
    if (now !== lastBucketRef.current) {
      // Clear buckets that were skipped
      const diff = Math.min(now - lastBucketRef.current, 120)
      for (let i = 1; i <= diff; i++) {
        sparklineRef.current[(lastBucketRef.current + i) % 120] = 0
      }
      lastBucketRef.current = now
    }
    sparklineRef.current[bucket] = (sparklineRef.current[bucket] ?? 0) + 1
  }, [])

  const addFeedEvent = useCallback((event: FeedEvent) => {
    setFeedEvents(prev => {
      const next = [...prev, event]
      return next.slice(-30) // keep last 30
    })
    setTotalEvents(prev => prev + 1)
    recordSparkline()
  }, [recordSparkline])

  const recordFile = useCallback((path: string, tool: string) => {
    if (!path || path.startsWith('/tmp/')) return
    setFiles(prev => {
      const next = new Map(prev)
      const existing = next.get(path)
      next.set(path, {
        path,
        name: fileName(path),
        dir: shortPath(path.split('/').slice(0, -1).join('/')),
        ops: (existing?.ops ?? 0) + 1,
        lastTouched: Date.now(),
        tool,
      })
      return next
    })
  }, [])

  // Process a raw event (shared by Dazzle CustomEvent and WebSocket)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processEvent = useCallback((eventType: string, rawData: any) => {
    let data = rawData ?? {}
    if (typeof data === 'string') {
      try { data = JSON.parse(data) } catch { data = {} }
    }

      if (eventType === 'tool_start') {
        const tool = String(data.tool ?? 'Unknown')
        if (NOISE_TOOLS.has(tool)) return

        const file = typeof data.file === 'string' ? data.file : ''
        let heroText = ''
        let secondaryText: string | undefined

        if (file) {
          heroText = shortPath(file)
          recordFile(file, tool)
        } else if (typeof data.command === 'string') {
          heroText = data.command
          secondaryText = typeof data.description === 'string' ? data.description : undefined
        } else if (typeof data.pattern === 'string') {
          heroText = data.pattern
          secondaryText = typeof data.file === 'string' ? `in ${shortPath(data.file)}` : undefined
        } else if (typeof data.query === 'string') {
          heroText = data.query
        } else if (typeof data.url === 'string') {
          heroText = data.url
        } else if (typeof data.description === 'string') {
          heroText = data.description
        }

        const detailLines: FeedEvent['detailLines'] = []
        if (tool === 'Edit') {
          if (typeof data.old === 'string' && data.old) {
            detailLines.push({ text: `- ${data.old.substring(0, 80)}`, color: 'error' })
          }
          if (typeof data.new === 'string' && data.new) {
            detailLines.push({ text: `+ ${data.new.substring(0, 80)}`, color: 'success' })
          }
        }

        addFeedEvent({
          id: nextId(),
          type: 'tool_start',
          tool,
          label: getLabel('tool_start', tool),
          heroText,
          secondaryText,
          detailLines: detailLines.length > 0 ? detailLines : undefined,
          accent: getAccent('tool_start'),
          timestamp: Date.now(),
        })
      }

      if (eventType === 'tool_end') {
        const tool = String(data.tool ?? 'Unknown')
        if (NOISE_TOOLS.has(tool)) return
        // tool_end events update existing cards (could be implemented as state merge)
      }

      if (eventType === 'user_message') {
        const prompt = typeof data.prompt === 'string' ? data.prompt : ''
        if (!prompt) return
        addFeedEvent({
          id: nextId(),
          type: 'user_message',
          label: 'USER',
          heroText: prompt,
          accent: 'white',
          timestamp: Date.now(),
        })
      }

      if (eventType === 'assistant_message') {
        const message = typeof data.message === 'string' ? data.message : ''
        if (!message) return
        addFeedEvent({
          id: nextId(),
          type: 'assistant_message',
          label: 'CLAUDE',
          heroText: message,
          accent: 'claude',
          timestamp: Date.now(),
        })
      }

      if (eventType === 'agent_start') {
        const agentId = String(data.agent_id ?? '')
        const agentType = String(data.agent_type ?? 'Agent')
        const description = String(data.description ?? '')
        setAgents(prev => {
          const next = new Map(prev)
          next.set(agentId, { id: agentId, type: agentType, description, startTime: Date.now() })
          return next
        })
        addFeedEvent({
          id: nextId(),
          type: 'agent_start',
          label: `${agentType.toUpperCase()} AGENT`,
          heroText: description || 'Agent spawned',
          accent: 'cyan',
          timestamp: Date.now(),
        })
      }

      if (eventType === 'agent_stop') {
        const agentId = String(data.agent_id ?? '')
        setAgents(prev => {
          const next = new Map(prev)
          next.delete(agentId)
          return next
        })
      }

      if (eventType === 'session_start') {
        setModel(String(data.model ?? ''))
      }

      if (eventType === 'error') {
        const tool = String(data.tool ?? '')
        const error = String(data.error ?? 'Unknown error')
        addFeedEvent({
          id: nextId(),
          type: 'error',
          tool,
          label: 'ERROR',
          heroText: error,
          accent: 'error',
          timestamp: Date.now(),
        })
      }

      if (eventType === 'stats') {
        setStats({
          reads: Number(data.total_reads ?? 0),
          edits: Number(data.total_edits ?? 0),
          writes: Number(data.total_writes ?? 0),
          commands: Number(data.total_commands ?? 0),
          searches: Number(data.total_searches ?? 0),
          errors: Number(data.total_errors ?? 0),
          linesAdded: Number(data.lines_added ?? 0),
        })
      }

      if (eventType === 'usage') {
        setUsage({
          costUsd: Number(data.cost_usd ?? 0),
          inputTokens: Number(data.input_tokens ?? 0),
          outputTokens: Number(data.output_tokens ?? 0),
          contextUsedPct: Number(data.context_used_pct ?? 0),
          linesAdded: Number(data.lines_added ?? 0),
          linesRemoved: Number(data.lines_removed ?? 0),
        })
      }
  }, [addFeedEvent, recordFile, setAgents, setModel, setStats, setUsage])

  // Dazzle CustomEvent listeners (named events with parsed JSON detail)
  useEffect(() => {
    const eventTypes: EventType[] = [
      'tool_start', 'tool_end', 'agent_start', 'agent_stop',
      'user_message', 'assistant_message', 'session_start',
      'error', 'notification', 'stats', 'usage',
    ]

    function handler(e: Event) {
      const ce = e as CustomEvent
      if (!ce.detail) return
      processEvent(e.type, ce.detail)
    }

    for (const t of eventTypes) window.addEventListener(t, handler)
    return () => {
      for (const t of eventTypes) window.removeEventListener(t, handler)
    }
  }, [processEvent])

  // WebSocket bridge (local dev)
  useEffect(() => {
    const WS_URL = 'ws://localhost:7777'
    let ws: WebSocket | null = null
    let retryTimeout: ReturnType<typeof setTimeout>

    function connect() {
      try {
        ws = new WebSocket(WS_URL)
        ws.onmessage = (msg) => {
          try {
            const parsed = JSON.parse(String(msg.data)) as { event: string, data: unknown }
            processEvent(parsed.event, parsed.data)
          } catch { /* ignore malformed */ }
        }
        ws.onclose = () => {
          retryTimeout = setTimeout(connect, 3000)
        }
        ws.onerror = () => {
          ws?.close()
        }
      } catch { /* WebSocket not available */ }
    }

    connect()
    return () => {
      clearTimeout(retryTimeout)
      ws?.close()
    }
  }, [processEvent])

  return {
    feedEvents,
    files,
    agents,
    stats,
    usage,
    model,
    totalEvents,
    sparkline: sparklineRef,
    lastBucket: lastBucketRef,
  }
}

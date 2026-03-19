export type EventType =
  | 'tool_start'
  | 'tool_end'
  | 'agent_start'
  | 'agent_stop'
  | 'user_message'
  | 'assistant_message'
  | 'session_start'
  | 'error'
  | 'notification'
  | 'stats'
  | 'usage'

export interface FeedEvent {
  id: string
  type: EventType
  tool?: string
  label: string
  heroText: string
  secondaryText?: string
  detailLines?: Array<{ text: string, color?: string }>
  accent: 'cyan' | 'claude' | 'white' | 'error' | 'success'
  timestamp: number
}

export interface FileEntry {
  path: string
  name: string
  dir: string
  ops: number
  lastTouched: number
  tool: string
}

export interface AgentEntry {
  id: string
  type: string
  description: string
  startTime: number
}

export interface SessionStats {
  reads: number
  edits: number
  writes: number
  commands: number
  searches: number
  errors: number
  linesAdded: number
}

export interface UsageData {
  costUsd: number
  inputTokens: number
  outputTokens: number
  contextUsedPct: number
  linesAdded: number
  linesRemoved: number
}

export const NOISE_TOOLS = new Set([
  'SendMessage',
  'sendMessage',
  'send_message',
  'TaskCreate',
  'TaskGet',
  'TaskList',
  'TaskOutput',
  'TaskStop',
  'TaskUpdate',
  'TeamCreate',
  'TeamDelete',
  'EnterPlanMode',
  'ExitPlanMode',
  'EnterWorktree',
  'ExitWorktree',
  'ToolSearch',
  'Skill',
  'Config',
  'NotebookEdit',
  'TodoRead',
  'TodoWrite',
])

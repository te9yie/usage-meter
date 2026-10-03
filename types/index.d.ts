export type Window = { kind: string; percentUsed: number; resetsAt?: string }
export type Context = { percent: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { windows: Window[]; context: Context | null }
  }
}

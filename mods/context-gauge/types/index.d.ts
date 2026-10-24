export type Segment = { name: string; color: string; tokens: number }

declare module 'claude-code' {
  interface PluginState {
    'context-gauge': {
      tokens: number | null
      isExpanded: boolean
      segments: Segment[] | null
      isAlertArmed: boolean
    }
  }
}

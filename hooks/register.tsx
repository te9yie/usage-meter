import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Window } from '../types'

const windows = atom({ plugin: 'usage-meter', key: 'windows' } as const, [] as Window[])

const WIDTH = 12

const colorOf = (p: number) =>
  p >= 90 ? '#b5483a' : p >= 70 ? '#d08a3c' : p >= 40 ? '#c9a63c' : '#4a9a94'

const bar = (p: number) => {
  const n = Math.max(0, Math.min(WIDTH, Math.round((p / 100) * WIDTH)))
  return '▰'.repeat(n) + '▱'.repeat(WIDTH - n)
}

const remain = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

const label = (k: string) => (k === 'five_hour' ? '5H' : 'WK')
const pick = (all: Window[]) => all.filter(w => w.kind === 'five_hour' || w.kind === 'seven_day')

const line = (list: Window[], now: number) =>
  list
    .map(w => `${label(w.kind)} ${bar(w.percentUsed)} ${Math.round(w.percentUsed)}% · ${remain(w.resetsAt, now)}`)
    .join('  ◆  ')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-meter',
      description: '5時間・週間の使用量を表示する',
    })
    return next(e)
  })

  on('command.run', { command: 'usage-meter' }, async $ => {
    const u = await $.session.usage()
    const list = pick(u.rateLimits)
    await update($, windows, () => list)
    const now = await $.clock.now()
    return { text: list.length ? line(list, now) : '使用量がまだ取れていません。' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, windows, () => pick(e.rateLimits))
    return next(e)
  })

  // GUIがリモート接続だとsurfaceが無く、UI要素は描かれない。transcriptへの行だけは届く。
  on('turn.complete', async ($, e, next) => {
    const isHeadless = (await $.session.surfaces()).length === 0
    const list = isHeadless ? pick((await $.session.usage()).rateLimits) : []
    if (list.length) $.ui.log(line(list, await $.clock.now()))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, windows)
    if (e.props.hasSurvey || list.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    return (
      <Box>
        {list.map((w, i) => (
          <Text key={w.kind}>
            {i > 0 ? <Text dimColor>{'  ◆  '}</Text> : null}
            <Text bold>{label(w.kind)} </Text>
            <Text color={colorOf(w.percentUsed)}>{bar(w.percentUsed)}</Text>
            <Text> {Math.round(w.percentUsed)}%</Text>
            <Text dimColor> · {remain(w.resetsAt, now)}</Text>
          </Text>
        ))}
      </Box>
    )
  })
}

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Context, Window } from '../types'

const windows = atom({ plugin: 'usage-meter', key: 'windows' } as const, [] as Window[])
const context = atom({ plugin: 'usage-meter', key: 'context' } as const, null as Context | null)

const WIDTH = 16
const PERIOD_MS: Record<string, number> = {
  five_hour: 5 * 3600_000,
  seven_day: 7 * 24 * 3600_000,
}

const colorOf = (p: number) => (p >= 90 ? '#c0392b' : p >= 70 ? '#d68910' : '#4f9d4f')

const remain = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m % 60}m` : `${m}m`
}

const clock = (iso: string | undefined) => {
  if (!iso) return ''
  const t = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(t.getHours())}:${p(t.getMinutes())}`
}

const ctxOf = (c: { percent?: number; tokens?: number; window: number }): Context | null => {
  const p = c.percent ?? (c.tokens && c.window ? (c.tokens / c.window) * 100 : undefined)
  return p === undefined ? null : { percent: p }
}

const label = (k: string) => (k === 'five_hour' ? '5h' : '7d')
const pick = (all: Window[]) => all.filter(w => w.kind === 'five_hour' || w.kind === 'seven_day')

// 経過時間の位置（0〜1）。期間が不明、または resetsAt が無いときは undefined。
const elapsed = (w: Window, now: number) => {
  const period = PERIOD_MS[w.kind]
  if (!period || !w.resetsAt) return undefined
  const left = Date.parse(w.resetsAt) - now
  return Math.max(0, Math.min(1, 1 - left / period))
}

const detail = (w: Window, now: number) =>
  `${Math.round(w.percentUsed)}% ${remain(w.resetsAt, now)}` +
  (w.kind === 'five_hour' && w.resetsAt ? ` (${clock(w.resetsAt)})` : '')

const line = (ctx: Context | null, list: Window[], now: number) =>
  [
    ctx ? `ctx ${Math.round(ctx.percent)}%` : '',
    ...list.map(w => `${label(w.kind)} ${detail(w, now)}`),
  ]
    .filter(Boolean)
    .join('  ')

// 塗り・トラック・目印を別々の色で描く（terminal用）。
const blocks = (Text: any, p: number, mark?: number) => {
  const fill = Math.max(0, Math.min(WIDTH, Math.round((p / 100) * WIDTH)))
  const at = mark === undefined ? -1 : Math.min(WIDTH - 1, Math.floor(mark * WIDTH))
  const run = (from: number, to: number, key: string) => {
    const a = Math.max(from, 0)
    const f = Math.max(0, Math.min(to, fill) - a)
    const t = Math.max(0, to - a - f)
    return [
      f > 0 ? <Text key={key + 'f'} color={colorOf(p)}>{'█'.repeat(f)}</Text> : null,
      t > 0 ? <Text key={key + 't'} color="#6a6a6a">{'░'.repeat(t)}</Text> : null,
    ]
  }
  if (at < 0) return <Text>{run(0, WIDTH, 'a')}</Text>
  return (
    <Text>
      {run(0, at, 'a')}
      <Text color="#5b8def" bold>┃</Text>
      {fill > at + 1 ? <Text color={colorOf(p)}>{'█'.repeat(Math.min(fill, WIDTH) - at - 1)}</Text> : null}
      {WIDTH - Math.max(fill, at + 1) > 0 ? <Text color="#6a6a6a">{'░'.repeat(WIDTH - Math.max(fill, at + 1))}</Text> : null}
    </Text>
  )
}

// 丸角のパネルとバーをSVGで描く（terminal以外の描画先用）。
const H = 26
const BAR = 110
const CH = 7.2
const fillOf = (p: number) => (p >= 90 ? '#d9534f' : p >= 70 ? '#e0a030' : '#6aaa64')
const textOf = (p: number) => (p >= 90 ? '#b02a2a' : p >= 70 ? '#8a5a00' : '#2e6b1f')

type Item = { key: string; name: string; p: number; text: string; mark?: number }

const svg = (items: Item[]) => {
  let x = 12
  let body = ''
  items.forEach((it, i) => {
    if (i > 0) x += 18
    body += `<text x="${x}" y="18" font-size="13" fill="#222">${it.name}</text>`
    x += it.name.length * CH + 8
    const w = Math.max(0, Math.min(100, it.p)) / 100 * BAR
    body += `<rect x="${x}" y="8.5" width="${BAR}" height="9" rx="4.5" fill="#d2d2d2"/>`
    if (w > 0) body += `<rect x="${x}" y="8.5" width="${Math.max(w, 9)}" height="9" rx="4.5" fill="${fillOf(it.p)}"/>`
    if (it.mark !== undefined) {
      const mx = x + Math.min(BAR - 2, Math.max(0, it.mark * BAR - 1))
      body += `<rect x="${mx}" y="6" width="2.5" height="14" rx="1.2" fill="#4a7fe0"/>`
    }
    x += BAR + 8
    body += `<text x="${x}" y="18" font-size="13" fill="${textOf(it.p)}">${it.text}</text>`
    x += it.text.length * CH
  })
  const width = Math.ceil(x + 12)
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" font-family="system-ui, 'Segoe UI', sans-serif">` +
    `<rect width="${width}" height="${H}" rx="9" fill="#f0f0f0"/>${body}</svg>`
  return { markup, width }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-meter',
      description: 'コンテキスト・5時間・週間の使用量を表示する',
    })
    return next(e)
  })

  on('command.run', { command: 'usage-meter' }, async $ => {
    const u = await $.session.usage()
    const list = pick(u.rateLimits)
    const ctx = ctxOf(u.context)
    await update($, windows, () => list)
    await update($, context, () => ctx)
    const now = await $.clock.now()
    return { text: ctx || list.length ? line(ctx, list, now) : '使用量がまだ取れていません。' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, windows, () => pick(e.rateLimits))
    await update($, context, () => ctxOf(e.context))
    return next(e)
  })

  // GUIがリモート接続だとsurfaceが無く、UI要素は描かれない。transcriptへの行だけは届く。
  on('turn.complete', async ($, e, next) => {
    const isHeadless = (await $.session.surfaces()).length === 0
    if (isHeadless) {
      const u = await $.session.usage()
      const ctx = ctxOf(u.context)
      const text = line(ctx, pick(u.rateLimits), await $.clock.now())
      if (text) $.ui.log(text)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // measure がまだ届いていない間は、その場で読み直す。
    const u = await $.session.usage()
    const list = (await read($, windows)).length ? await read($, windows) : pick(u.rateLimits)
    const ctx = (await read($, context)) ?? ctxOf(u.context)
    if (e.props.hasSurvey || (list.length === 0 && !ctx)) return next(e)

    const now = await $.clock.now()
    const items = [
      ...(ctx ? [{ key: 'ctx', name: 'ctx', p: ctx.percent, text: `${Math.round(ctx.percent)}%`, mark: undefined as number | undefined }] : []),
      ...list.map(w => ({ key: w.kind, name: label(w.kind), p: w.percentUsed, text: detail(w, now), mark: elapsed(w, now) })),
    ]

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box borderStyle="round" borderDimColor paddingX={1} gap={3}>
          {items.map(it => (
            <Box key={it.key} gap={1}>
              <Text bold>{it.name}</Text>
              {blocks(Text, it.p, it.mark)}
              <Text color={colorOf(it.p)}>{it.text}</Text>
            </Box>
          ))}
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    const source = svg(items)
    return <Svg source={source.markup} width={source.width} height={H} alt={line(ctx, list, now)} />
  })
}

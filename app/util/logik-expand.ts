import { footerStart, includeRegistry } from '~/util/logik-includes.js'

export interface LineOrigin {
  editorLine: number
  include?: string
}

export interface UnresolvedInclude {
  view: string
  editorLine: number
}

export interface ExpandResult {
  html: string
  lineMap: LineOrigin[]
  unresolved: UnresolvedInclude[]
}

const includeDirective = /<%@\s*include\s+view='([\w-]+)'\s*%>/g
const anyAccDirective = /<%@.*?%>/

function resolveInclude(view: string): string | null {
  if (view === 'MirrorPageUrl') return 'https://www.sky.com/'
  if (/^Footer_\w*START$/.test(view)) return footerStart
  return (includeRegistry as Record<string, string>)[view] ?? null
}

// Expands ACC include directives line by line so every line of the
// expanded template can be traced back to the editor line it came from.
export function expandTemplate(input: string): ExpandResult {
  const outLines: string[] = []
  const lineMap: LineOrigin[] = []
  const unresolved: UnresolvedInclude[] = []

  input.split('\n').forEach((line, i) => {
    const editorLine = i + 1
    let expandedInclude: string | undefined

    const replaced = line.replace(includeDirective, (match, view: string) => {
      const content = resolveInclude(view)
      if (content === null) {
        unresolved.push({ view, editorLine })
        return match
      }
      expandedInclude = view
      return content
    })

    const leftover = replaced.match(anyAccDirective)
    if (leftover && !unresolved.some(u => u.editorLine === editorLine)) {
      unresolved.push({ view: leftover[0], editorLine })
    }

    for (const outLine of replaced.split('\n')) {
      outLines.push(outLine.replace(/<%=/g, '<%-'))
      lineMap.push(expandedInclude ? { editorLine, include: expandedInclude } : { editorLine })
    }
  })

  return { html: outLines.join('\n'), lineMap, unresolved }
}

// Rebuilds an EJS-style ">> N|" context snippet from source lines
export function buildContext(source: string, line: number): string {
  const lines = source.split('\n')
  const start = Math.max(line - 3, 0)
  const end = Math.min(lines.length, line + 2)
  return lines.slice(start, end).map((l, i) => {
    const curr = start + i + 1
    return (curr === line ? ' >> ' : '    ') + curr + '| ' + l
  }).join('\n')
}

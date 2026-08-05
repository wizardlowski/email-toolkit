import { buildContext, type LineOrigin } from '~/util/logik-expand'
import { ejsLint } from '~/util/ejs-lint'

export interface RenderError {
  type: 'include' | 'data' | 'runtime' | 'syntax' | 'unknown'
  title: string
  message: string
  editorLine?: number
  include?: string
  context?: string
}

export interface ErrorSource {
  // The template as authored, before includes were expanded
  source: string
  expandedHtml: string
  lineMap: LineOrigin[]
}

export function classifyEjsError(e: Error, { source, expandedHtml, lineMap }: ErrorSource): RenderError {
  // Runtime errors: ejs rethrow prefixes "ejs:<line>\n<context>\n\n<message>"
  // where <line> refers to the include-expanded template
  const runtimeMatch = e.message.match(/^ejs:(\d+)\n/)
  if (runtimeMatch) {
    const expandedLine = Number(runtimeMatch[1])
    const origin = lineMap[expandedLine - 1]
    const parts = e.message.split('\n\n')
    const message = parts.slice(1).join('\n\n').trim() || e.message
    const ejsContext = parts[0]?.split('\n').slice(1).join('\n')

    return {
      type: 'runtime',
      title: 'Runtime error',
      message,
      editorLine: origin?.editorLine,
      include: origin?.include,
      context: origin && !origin.include
        ? buildContext(source, origin.editorLine)
        : ejsContext
    }
  }

  // Compile errors: ejs gives no line, so lint the expanded template to find it
  if (e instanceof SyntaxError) {
    const lint = ejsLint(expandedHtml)
    if (lint) {
      const origin = lineMap[lint.line - 1]
      return {
        type: 'syntax',
        title: 'Syntax error',
        message: lint.message,
        editorLine: origin?.editorLine,
        include: origin?.include,
        context: origin && !origin.include
          ? buildContext(source, origin.editorLine)
          : buildContext(expandedHtml, lint.line)
      }
    }
    return {
      type: 'syntax',
      title: 'Syntax error',
      message: (e.message.split('\n')[0] ?? e.message).replace(/ while compiling ejs$/, '')
        + ' — check your <% %> blocks'
    }
  }

  return { type: 'unknown', title: 'Render error', message: e.message }
}

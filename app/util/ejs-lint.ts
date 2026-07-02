import { parse } from 'acorn'

export interface LintError {
  line: number
  column: number
  message: string
}

// Blank out every non-newline char so line/column positions are preserved
function blank(src: string): string {
  return src.replace(/[^\n]/g, ' ')
}

// Locates JS syntax errors inside <% %> scriptlets, which EJS reports
// without any line info. Same approach as ejs-lint: replace everything
// that is not scriptlet code with whitespace of identical length (and a
// `;` in place of each closing delimiter, mirroring how EJS separates
// statements), then parse the result so acorn's line/column map 1:1
// onto the template text. Output tags (<%= / <%-) are expressions, not
// statements, so they are blanked and not checked.
export function ejsLint(text: string): LintError | null {
  const tagRe = /<%[\s\S]*?%>/g
  let js = ''
  let last = 0
  let m: RegExpExecArray | null

  while ((m = tagRe.exec(text))) {
    js += blank(text.slice(last, m.index))
    const tag = m[0]

    if (/^<%[=\-#@%]/.test(tag)) {
      js += blank(tag)
    } else {
      const openLen = tag[2] === '_' ? 3 : 2
      const closeLen = /[_-]%>$/.test(tag) ? 3 : 2
      js += ' '.repeat(openLen)
        + tag.slice(openLen, tag.length - closeLen)
        + ';' + ' '.repeat(closeLen - 1)
    }
    last = m.index + tag.length
  }
  js += blank(text.slice(last))

  try {
    parse(js, { ecmaVersion: 'latest', allowReturnOutsideFunction: true })
    return null
  } catch (e) {
    const err = e as { loc?: { line: number, column: number }, message: string }
    if (!err.loc) return null
    return {
      line: err.loc.line,
      column: err.loc.column + 1,
      message: err.message.replace(/\s*\(\d+:\d+\)$/, '')
    }
  }
}

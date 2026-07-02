import type * as Monaco from 'monaco-editor'

export function registerEjsLanguage(monaco: typeof Monaco) {
  if (monaco.languages.getLanguages().some(({ id }) => id === 'ejs')) return

  monaco.languages.register({ id: 'ejs' })

  monaco.languages.setMonarchTokensProvider('ejs', {
    defaultToken: '',
    tokenPostfix: '.ejs',

    tokenizer: {
      root: [
        [/<%[=\-_#@]?/, { token: 'delimiter.ejs', next: '@ejsBlock', nextEmbedded: 'javascript' }],
        [/./, { token: '@rematch', next: '@htmlBlock', nextEmbedded: 'text/html' }]
      ],

      htmlBlock: [
        [/<%/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
        [/[^<]+/, ''],
        [/</, '']
      ],

      ejsBlock: [
        [/[_-]?%>/, { token: 'delimiter.ejs', next: '@pop', nextEmbedded: '@pop' }],
        [/[^%_-]+/, ''],
        [/./, '']
      ]
    }
  })

  monaco.languages.setLanguageConfiguration('ejs', {
    brackets: [
      ['<%', '%>'],
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: "'", close: "'" },
      { open: '"', close: '"' }
    ]
  })
}

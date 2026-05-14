import { EditorState } from 'https://esm.sh/@codemirror/state@6.5.2?target=es2022'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from 'https://esm.sh/@codemirror/view@6.38.6?target=es2022&deps=@codemirror/state@6.5.2'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from 'https://esm.sh/@codemirror/commands@6.8.1?target=es2022&deps=@codemirror/state@6.5.2,@codemirror/view@6.38.6'

export const DEFAULT_EDITOR_TEXT = [
  'When the room gets quiet enough,',
  'the page starts breathing back.',
  '',
  '',
].join('\n')

const EDITOR_PLACEHOLDER = 'Write a line…\nThen another one.\nLeave blank lines for stanzas.'

function shouldAutofocusEditor() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function normalizeEditorText(value = '') {
  return String(value).replace(/\r\n?/g, '\n')
}

function createLineEntry(lineNumber, text) {
  return {
    id: `line-${lineNumber}`,
    number: lineNumber,
    text,
  }
}

function parseDisplayedLineNumber(value = '') {
  const parsedLineNumber = Number.parseInt(String(value).replace(/[^\d]+/g, ''), 10)
  return Number.isFinite(parsedLineNumber) ? parsedLineNumber : null
}

function getLineFromPointerEvent(view, event, fallbackPos = null) {
  const targetNode = event.target instanceof Node ? event.target : null
  const targetElement = targetNode instanceof Element ? targetNode : targetNode?.parentElement ?? null
  const lineElement = targetElement?.closest('.cm-line')

  if (lineElement && view.contentDOM.contains(lineElement)) {
    return view.state.doc.lineAt(view.posAtDOM(lineElement, 0))
  }

  const position = view.posAtCoords({
    x: event.clientX,
    y: event.clientY,
  }) ?? fallbackPos

  return typeof position === 'number' ? view.state.doc.lineAt(position) : null
}

function focusEditorViewLine(targetView, lineNumber, selectWholeLine = true, updateHash = true) {
  let line

  try {
    line = targetView.state.doc.line(lineNumber)
  } catch {
    return false
  }

  targetView.focus()
  targetView.dispatch({
    selection: {
      anchor: selectWholeLine ? line.from : line.to,
      head: line.to,
    },
    scrollIntoView: true,
  })

  if (updateHash) {
    window.history.replaceState(null, '', `#line-${lineNumber}`)
  }

  return true
}

export function createEditor({ container, onChange, onSelectionChange }) {
  container.innerHTML = '<div class="editor-grid"><div class="editor-host"></div></div>'

  const editorHost = container.querySelector('.editor-host')
  let view

  function getEditorText() {
    return view.state.doc.toString()
  }

  function getLines() {
    return getEditorText().split('\n').map((text, index) => createLineEntry(index + 1, text))
  }

  function getActiveLineNumber() {
    return view.state.doc.lineAt(view.state.selection.main.head).number
  }

  function getActiveLine() {
    const activeLine = view.state.doc.lineAt(view.state.selection.main.head)
    return createLineEntry(activeLine.number, activeLine.text)
  }

  function getSelectedText() {
    const { from, to } = view.state.selection.main
    return view.state.sliceDoc(from, to).trim()
  }

  function buildSnapshot() {
    return {
      lines: getLines(),
      activeLine: getActiveLine(),
      selectedText: getSelectedText(),
    }
  }

  function emitChange() {
    onChange?.(buildSnapshot())
  }

  function emitSelectionChange() {
    onSelectionChange?.(buildSnapshot())
  }

  function focusLine(lineNumber, selectWholeLine = true, updateHash = true) {
    focusEditorViewLine(view, lineNumber, selectWholeLine, updateHash)
  }

  function syncLineHash() {
    const hashMatch = window.location.hash.match(/^#line-(\d+)$/)

    if (!hashMatch) {
      return false
    }

    focusLine(Number(hashMatch[1]), true, false)
    return true
  }

  view = new EditorView({
    state: EditorState.create({
      doc: DEFAULT_EDITOR_TEXT,
      extensions: [
        history(),
        lineNumbers(),
        EditorView.domEventHandlers({
          mousedown(event, currentView) {
            if (event.button !== 0 || event.detail < 3) {
              return false
            }

            const targetNode = event.target instanceof Node ? event.target : null

            if (!targetNode || !currentView.contentDOM.contains(targetNode)) {
              return false
            }

            const line = getLineFromPointerEvent(currentView, event)

            if (!line) {
              return false
            }

            event.preventDefault()
            return focusEditorViewLine(currentView, line.number)
          },
        }),
        EditorView.lineWrapping,
        highlightActiveLine(),
        highlightActiveLineGutter(),
        EditorState.tabSize.of(2),
        placeholder(EDITOR_PLACEHOLDER),
        EditorView.contentAttributes.of({
          spellcheck: 'true',
          'aria-label': 'Lyric draft editor',
        }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emitChange()
          }

          if (update.docChanged || update.selectionSet || update.focusChanged) {
            emitSelectionChange()
          }
        }),
      ],
    }),
    parent: editorHost,
  })

  const handleGutterPointerDown = (event) => {
    const target = event.target instanceof Element ? event.target : null
    const gutterElement = target?.closest('.cm-lineNumbers .cm-gutterElement')

    if (!gutterElement) {
      return
    }

    const lineNumber = parseDisplayedLineNumber(gutterElement.textContent)

    if (!lineNumber) {
      return
    }

    event.preventDefault()
    focusLine(lineNumber)
  }

  const handleHashChange = () => {
    syncLineHash()
  }

  view.dom.addEventListener('mousedown', handleGutterPointerDown)
  window.addEventListener('hashchange', handleHashChange)

  queueMicrotask(() => {
    const focusedHashLine = syncLineHash()

    if (!focusedHashLine && shouldAutofocusEditor()) {
      view.focus()
    }

    emitChange()
    emitSelectionChange()
  })

  return {
    getLines,
    getSelectedText,
    getActiveLine,
    getActiveLineNumber,
    getTextarea() {
      return null
    },
    getEditorText,
    setEditorText(nextText = '') {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: normalizeEditorText(nextText),
        },
        selection: {
          anchor: 0,
          head: 0,
        },
        scrollIntoView: true,
      })
      view.focus()
    },
    setFlaggedLines(_lineEntries) {
      // Styling hooks for flagged lines can be added in a later CodeMirror pass.
    },
    focusLine,
    insertBelowActive(text) {
      const activeLine = view.state.doc.lineAt(view.state.selection.main.head)
      const normalizedText = normalizeEditorText(text)
      const isLastLine = activeLine.number === view.state.doc.lines
      const insertionPoint = isLastLine ? activeLine.to : activeLine.to + 1
      const insertionText = isLastLine ? `\n${normalizedText}` : `${normalizedText}\n`

      view.dispatch({
        changes: {
          from: insertionPoint,
          insert: insertionText,
        },
      })

      focusLine(activeLine.number + 1, false)
    },
    destroy() {
      view.dom.removeEventListener('mousedown', handleGutterPointerDown)
      window.removeEventListener('hashchange', handleHashChange)
      view.destroy()
    },
  }
}

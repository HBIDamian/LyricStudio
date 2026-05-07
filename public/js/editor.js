export const DEFAULT_EDITOR_TEXT = [
  'When the room gets quiet enough,',
  'the page starts breathing back.',
  '',
  '',
].join('\n');

function getLineStartIndex(text, lineNumber) {
  const lines = text.split('\n');
  let start = 0;

  for (let index = 1; index < lineNumber; index += 1) {
    start += (lines[index - 1] || '').length + 1;
  }

  return start;
}

function shouldAutofocusEditor() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function createEditor({ container, onChange, onSelectionChange }) {
  container.innerHTML = `
    <div class="editor-grid">
      <div class="line-gutter"></div>
      <textarea class="editor-input" spellcheck="true" placeholder="Write a line…\nThen another one.\nLeave blank lines for stanzas."></textarea>
      <div class="editor-line-measure" aria-hidden="true"></div>
    </div>
  `;

  const gutter = container.querySelector('.line-gutter');
  const textarea = container.querySelector('.editor-input');
  const lineMeasure = container.querySelector('.editor-line-measure');
  const flaggedLines = new Map();
  let measuredLineHeights = [];

  textarea.value = DEFAULT_EDITOR_TEXT;

  function getLines() {
    return textarea.value.split('\n').map((text, index) => ({
      id: `line-${index + 1}`,
      number: index + 1,
      text,
    }));
  }

  function getEditorLineHeight() {
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);
    return Number.isFinite(lineHeight) ? lineHeight : 32;
  }

  function measureVisualLineHeights(lines) {
    if (!lines.length) {
      return [];
    }

    const textareaStyles = window.getComputedStyle(textarea);
    const lineHeight = getEditorLineHeight();
    const paddingLeft = Number.parseFloat(textareaStyles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(textareaStyles.paddingRight) || 0;
    const contentWidth = Math.max(0, textarea.clientWidth - paddingLeft - paddingRight);

    if (!contentWidth) {
      return lines.map(() => lineHeight);
    }

    lineMeasure.style.width = `${contentWidth}px`;
    lineMeasure.style.font = textareaStyles.font;
    lineMeasure.style.fontKerning = textareaStyles.fontKerning;
    lineMeasure.style.fontFeatureSettings = textareaStyles.fontFeatureSettings;
    lineMeasure.style.fontVariationSettings = textareaStyles.fontVariationSettings;
    lineMeasure.style.fontStretch = textareaStyles.fontStretch;
    lineMeasure.style.letterSpacing = textareaStyles.letterSpacing;
    lineMeasure.style.wordSpacing = textareaStyles.wordSpacing;
    lineMeasure.style.lineHeight = textareaStyles.lineHeight;
    lineMeasure.style.textTransform = textareaStyles.textTransform;
    lineMeasure.style.textIndent = textareaStyles.textIndent;
    lineMeasure.style.tabSize = textareaStyles.tabSize;
    lineMeasure.style.whiteSpace = 'pre-wrap';
    lineMeasure.style.wordBreak = textareaStyles.wordBreak;
    lineMeasure.style.overflowWrap = textareaStyles.overflowWrap;

    const fragment = document.createDocumentFragment();

    lines.forEach((line) => {
      const row = document.createElement('div');
      row.className = 'editor-line-measure-row';
      row.textContent = line.text || ' ';
      fragment.append(row);
    });

    lineMeasure.replaceChildren(fragment);

    return [...lineMeasure.children].map((row) => {
      const height = Math.ceil(row.getBoundingClientRect().height);
      return Math.max(height, lineHeight);
    });
  }

  function getActiveLineNumber() {
    const selectionStart = textarea.selectionStart || 0;
    return textarea.value.slice(0, selectionStart).split('\n').length;
  }

  function getActiveLine() {
    return getLines().find((line) => line.number === getActiveLineNumber()) || null;
  }

  function getSelectedText() {
    const selection = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim();
    return selection;
  }

  function getLineRange(lineNumber) {
    const lines = getLines();
    const line = lines.find((entry) => entry.number === lineNumber);

    if (!line) {
      return { start: 0, end: 0 };
    }

    const start = getLineStartIndex(textarea.value, lineNumber);
    const end = start + line.text.length;
    return { start, end };
  }

  function focusLine(lineNumber, selectWholeLine = true) {
    const { start, end } = getLineRange(lineNumber);
    textarea.focus();
    textarea.setSelectionRange(selectWholeLine ? start : end, end);
    window.location.hash = `line-${lineNumber}`;
    renderGutter({ recalculateHeights: false });
    emitSelectionChange();
  }

  function renderGutter({ lines = getLines(), recalculateHeights = false } = {}) {
    const activeLine = getActiveLineNumber();

    if (recalculateHeights || measuredLineHeights.length !== lines.length) {
      measuredLineHeights = measureVisualLineHeights(lines);
    }

    gutter.innerHTML = lines.map((line) => {
      const lineHeight = measuredLineHeights[line.number - 1] || getEditorLineHeight();
      const isFlagged = flaggedLines.has(line.number);
      const title = isFlagged ? ` title="Cliché note: ${flaggedLines.get(line.number)}"` : '';
      return `
        <button
          type="button"
          class="gutter-line${line.number === activeLine ? ' is-active' : ''}${isFlagged ? ' has-cliche' : ''}"
          data-line-number="${line.number}"
          style="--gutter-line-height: ${lineHeight}px"
          aria-label="Focus line ${line.number}"
          ${title}
        >#${line.number}</button>
      `;
    }).join('');
  }

  function emitChange() {
    const lines = getLines();
    renderGutter({ lines, recalculateHeights: true });
    onChange?.({
      lines,
      activeLine: getActiveLine(),
      selectedText: getSelectedText(),
    });
  }

  function emitSelectionChange() {
    renderGutter({ recalculateHeights: false });
    onSelectionChange?.({
      lines: getLines(),
      activeLine: getActiveLine(),
      selectedText: getSelectedText(),
    });
  }

  gutter.addEventListener('click', (event) => {
    const button = event.target.closest('.gutter-line');

    if (!button) {
      return;
    }

    focusLine(Number(button.dataset.lineNumber));
  });

  textarea.addEventListener('scroll', () => {
    gutter.scrollTop = textarea.scrollTop;
  });

  textarea.addEventListener('input', () => {
    emitChange();
  });

  textarea.addEventListener('click', () => {
    emitSelectionChange();
  });

  textarea.addEventListener('keyup', () => {
    emitSelectionChange();
  });

  textarea.addEventListener('select', () => {
    emitSelectionChange();
  });

  textarea.addEventListener('focus', () => {
    emitSelectionChange();
  });

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => {
      renderGutter({ recalculateHeights: true });
    });

    resizeObserver.observe(textarea);
  } else {
    window.addEventListener('resize', () => {
      renderGutter({ recalculateHeights: true });
    });
  }

  window.addEventListener('hashchange', () => {
    const hashMatch = window.location.hash.match(/^#line-(\d+)$/);

    if (hashMatch) {
      focusLine(Number(hashMatch[1]));
    }
  });

  renderGutter({ recalculateHeights: true });
  queueMicrotask(() => {
    if (shouldAutofocusEditor()) {
      textarea.focus();
    }

    emitChange();
    emitSelectionChange();
  });

  return {
    getLines,
    getSelectedText,
    getActiveLine,
    getActiveLineNumber,
    getTextarea() {
      return textarea;
    },
    getEditorText() {
      return textarea.value;
    },
    setEditorText(nextText = '') {
      textarea.value = String(nextText).replace(/\r\n?/g, '\n');
      textarea.focus();
      textarea.setSelectionRange(0, 0);
      emitChange();
      emitSelectionChange();
    },
    setFlaggedLines(lineEntries) {
      flaggedLines.clear();

      lineEntries.forEach((entry) => {
        flaggedLines.set(entry.lineNumber, entry.matches.map((match) => match.phrase).join(', '));
      });

      renderGutter({ recalculateHeights: false });
    },
    focusLine,
    insertBelowActive(text) {
      const activeLine = getActiveLineNumber();
      const { end } = getLineRange(activeLine);
      const before = textarea.value.slice(0, end);
      const after = textarea.value.slice(end);
      const spacer = after.startsWith('\n') || !after.length ? '\n' : '\n';
      textarea.value = `${before}${spacer}${text}${after}`;
      emitChange();
      focusLine(activeLine + 1, false);
    },
  };
}

import { getAiHealth } from './api.js';
import { buildDraftAnalysis } from './analysis.js';
import { createEditor, DEFAULT_EDITOR_TEXT } from './editor.js';
import { findRhymes } from './tools/rhymeFinder.js';
import { analyzeLines } from './tools/syllableCounter.js';
import { detectClichesByLine } from './tools/clicheDetector.js';
import { rewriteSelection } from './tools/rewriter.js';
import { expandImagery } from './tools/imageryExpander.js';
import { generateMetaphors } from './tools/metaphorGenerator.js';
import { generateLineIdeas } from './tools/ideaGenerator.js';
import {
  escapeHtml,
  renderMetricList,
  renderResultList,
  renderTokenList,
  setBusy,
  setupChrome,
} from './ui.js';

const editorHost = document.querySelector('#editor-lines');
const aiStatus = document.querySelector('#ai-status');
const selectionChip = document.querySelector('#selection-chip');
const lineChip = document.querySelector('#line-chip');
const studioRail = document.querySelector('#studio-rail');
const toolPanel = document.querySelector('#tool-panel');
const statusPanel = document.querySelector('#status-panel');
const studioRailToggle = document.querySelector('#studio-rail-toggle');
const toolToggle = document.querySelector('#tool-panel-toggle');
const statusToggle = document.querySelector('#status-panel-toggle');
const workspace = document.querySelector('.workspace');
const toolGroups = [...document.querySelectorAll('[data-tool-group]')];
const toolCards = [...document.querySelectorAll('[data-tool-card]')];
const themeToggleButton = document.querySelector('#theme-toggle');
const ideaModal = document.querySelector('#idea-modal');
const ideaModalBackdrop = document.querySelector('#idea-modal-backdrop');
const openIdeaStarterButton = document.querySelector('#open-idea-starter');
const closeIdeaModalButton = document.querySelector('#close-idea-modal');
const ideaPart = document.querySelector('#idea-part');
const ideaFormat = document.querySelector('#idea-format');
const ideaTopic = document.querySelector('#idea-topic');
const ideaMood = document.querySelector('#idea-mood');
const ideaPerspective = document.querySelector('#idea-perspective');
const ideaLineCount = document.querySelector('#idea-line-count');
const ideaRhymePatternWrap = document.querySelector('#idea-rhyme-pattern-wrap');
const ideaRhymePattern = document.querySelector('#idea-rhyme-pattern');
const ideaAnchor = document.querySelector('#idea-anchor');
const metaphorEmotion = document.querySelector('#metaphor-emotion');
const metaphorEmotionOtherWrap = document.querySelector('#metaphor-emotion-other-wrap');
const metaphorEmotionOther = document.querySelector('#metaphor-emotion-other');
const rewriteToneOtherWrap = document.querySelector('#rewrite-tone-other-wrap');
const rewriteToneOther = document.querySelector('#rewrite-tone-other');
const saveDraftButton = document.querySelector('#save-draft-button');
const loadDraftButton = document.querySelector('#load-draft-button');
const copyDraftButton = document.querySelector('#copy-draft-button');
const resetDraftButton = document.querySelector('#reset-draft-button');
const draftFileInput = document.querySelector('#draft-file-input');
const autosaveIndicator = document.querySelector('#autosave-indicator');
const editorShortcuts = document.querySelector('#editor-shortcuts');
const editorActionStatus = document.querySelector('#editor-action-status');

const LOCAL_DRAFT_STORAGE_KEY = 'lyric-studio-local-draft-backup';
const LOCAL_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const IS_MAC = /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform || '');
const SHORTCUT_LABELS = {
  save: IS_MAC ? '⌘S' : 'Ctrl+S',
  load: IS_MAC ? '⌘O' : 'Ctrl+O',
  copyAll: IS_MAC ? '⌘⇧C' : 'Ctrl+Shift+C',
};
const IDEA_RHYME_PATTERNS = {
  2: [
    { value: 'AA', label: 'AA · both lines rhyme' },
    { value: 'AB', label: 'AB · no end-rhyme match' },
  ],
  3: [
    { value: 'AAA', label: 'AAA · all three lines rhyme' },
    { value: 'AAB', label: 'AAB · first two rhyme, third breaks away' },
    { value: 'ABA', label: 'ABA · first and third rhyme' },
    { value: 'ABB', label: 'ABB · last two lines rhyme' },
  ],
  4: [
    { value: 'AAAA', label: 'AAAA · every line rhymes' },
    { value: 'AABB', label: 'AABB · couplet pairs' },
    { value: 'ABAB', label: 'ABAB · alternating rhyme' },
    { value: 'ABBA', label: 'ABBA · envelope rhyme' },
  ],
};
const IDEA_DEFAULT_RHYME_PATTERNS = {
  2: 'AA',
  3: 'AAB',
  4: 'AABB',
};

const chrome = setupChrome({
  workspace,
  studioRail,
  toolPanel,
  statusPanel,
  studioRailToggle,
  toolToggle,
  statusToggle,
  themeToggleButton,
  aiStatus,
  selectionChip,
  lineChip,
});

const resultNodes = {
  ideas: document.querySelector('#idea-results'),
  rhyme: document.querySelector('#rhyme-results'),
  syllables: document.querySelector('#syllable-results'),
  cliches: document.querySelector('#cliche-results'),
  rewrite: document.querySelector('#rewrite-results'),
  imagery: document.querySelector('#imagery-results'),
  metaphor: document.querySelector('#metaphor-results'),
};

const statusNodes = {
  rhythmSummary: document.querySelector('#rhythm-summary'),
  rhythmLines: document.querySelector('#rhythm-lines'),
  repetitionSummary: document.querySelector('#repetition-summary'),
  repetitionDetail: document.querySelector('#repetition-detail'),
  structureSummary: document.querySelector('#structure-summary'),
  structureDetail: document.querySelector('#structure-detail'),
};

const state = {
  aiAvailable: false,
  aiModel: null,
  selectedTone: 'poetic',
  ideaRhymeSelections: { ...IDEA_DEFAULT_RHYME_PATTERNS },
};

let editor;
let editorActionStatusTimeout;
let localDraftExpiresAt = 0;
let isRestoringLocalDraft = false;
let suppressNextAutosave = false;
let lastFocusedElement = null;

function truncate(value, length = 56) {
  if (!value) {
    return '';
  }

  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function getSelectionPayload() {
  const selectedText = editor.getSelectedText();

  if (selectedText) {
    return {
      text: selectedText,
      label: `Selection · “${truncate(selectedText)}”`,
    };
  }

  const activeLine = editor.getActiveLine();
  const activeText = activeLine?.text?.trim();

  if (activeText) {
    return {
      text: activeText,
      label: `Line ${activeLine.number} · “${truncate(activeText)}”`,
    };
  }

  return {
    text: '',
    label: 'Nothing selected',
  };
}

function getContextLines() {
  return editor.getLines().map((line) => line.text).filter(Boolean);
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function buildDraftFilename() {
  const firstLine = editor.getLines().find((line) => line.text.trim())?.text ?? '';
  const slug = slugify(firstLine) || 'lyric-studio-draft';
  const now = new Date();
  const dateStamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `${slug}-${dateStamp}.txt`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function setAutosaveIndicator(message, state = 'idle') {
  if (!autosaveIndicator) {
    return;
  }

  autosaveIndicator.textContent = message;
  autosaveIndicator.dataset.state = state;
}

function updateAutosaveIndicator() {
  if (localDraftExpiresAt > Date.now()) {
    setAutosaveIndicator(`Autosave · local backup active until ${formatTime(localDraftExpiresAt)}.`, 'active');
    return;
  }

  if (editor?.getEditorText && shouldSkipLocalDraftBackup(editor.getEditorText())) {
    setAutosaveIndicator('Autosave · waiting for your first change.', 'idle');
    return;
  }

  setAutosaveIndicator('Autosave · ready to save on your next change.', 'idle');
}

function applyShortcutHints() {
  const shortcutPairs = [
    [saveDraftButton, SHORTCUT_LABELS.save, 'Save as .txt'],
    [loadDraftButton, SHORTCUT_LABELS.load, 'Load .txt'],
    [copyDraftButton, SHORTCUT_LABELS.copyAll, 'Copy all to clipboard'],
  ];

  shortcutPairs.forEach(([button, shortcut, label]) => {
    button.title = `${label} (${shortcut})`;
  });

  saveDraftButton.setAttribute('aria-keyshortcuts', 'Meta+S Control+S');
  loadDraftButton.setAttribute('aria-keyshortcuts', 'Meta+O Control+O');
  copyDraftButton.setAttribute('aria-keyshortcuts', 'Meta+Shift+C Control+Shift+C');

  editorShortcuts.textContent = `Shortcuts · ${SHORTCUT_LABELS.save} save · ${SHORTCUT_LABELS.load} load · ${SHORTCUT_LABELS.copyAll} copy all`;
}

function clearLocalDraftBackup() {
  localDraftExpiresAt = 0;

  try {
    localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function readLocalDraftBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const backup = JSON.parse(raw);

    if (!backup || typeof backup.text !== 'string' || !Number.isFinite(backup.expiresAt)) {
      clearLocalDraftBackup();
      return null;
    }

    if (backup.expiresAt <= Date.now()) {
      clearLocalDraftBackup();
      return null;
    }

    return backup;
  } catch {
    clearLocalDraftBackup();
    return null;
  }
}

function shouldSkipLocalDraftBackup(text = editor?.getEditorText?.() ?? '') {
  return text === DEFAULT_EDITOR_TEXT;
}

function persistLocalDraftBackup({
  text = editor.getEditorText(),
  expiresAt = localDraftExpiresAt,
  notifyOnError = false,
} = {}) {
  if (!expiresAt || expiresAt <= Date.now()) {
    clearLocalDraftBackup();
    return false;
  }

  try {
    localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify({
      text,
      savedAt: Date.now(),
      expiresAt,
    }));
    localDraftExpiresAt = expiresAt;
    return true;
  } catch {
    setAutosaveIndicator('Autosave · unavailable in this browser.', 'error');

    if (notifyOnError) {
      setEditorStatus('Could not save a local backup in this browser.', 'error');
    }

    return false;
  }
}

function syncLocalDraftBackup() {
  if (isRestoringLocalDraft) {
    return;
  }

  if (suppressNextAutosave) {
    suppressNextAutosave = false;
    return;
  }

  const draftText = editor.getEditorText();

  if (shouldSkipLocalDraftBackup(draftText)) {
    clearLocalDraftBackup();
    return;
  }

  persistLocalDraftBackup({
    text: draftText,
    expiresAt: Date.now() + LOCAL_DRAFT_TTL_MS,
  });
}

function restoreLocalDraftBackup() {
  const backup = readLocalDraftBackup();

  if (!backup) {
    return false;
  }

  localDraftExpiresAt = backup.expiresAt;
  suppressNextAutosave = true;
  isRestoringLocalDraft = true;
  editor.setEditorText(backup.text);
  isRestoringLocalDraft = false;
  setEditorStatus(`Restored local backup. It expires at ${formatTime(backup.expiresAt)}.`, 'success');
  return true;
}

function resetDraftToDefault() {
  clearLocalDraftBackup();
  window.location.reload();
}

function handleKeyboardShortcuts(event) {
  if (event.key === 'Escape' && ideaModal && !ideaModal.hidden) {
    event.preventDefault();
    closeIdeaModal();
    return;
  }

  if (event.defaultPrevented || event.repeat) {
    return;
  }

  const hasModifier = event.metaKey || event.ctrlKey;

  if (!hasModifier || event.altKey) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === 's' && !event.shiftKey) {
    event.preventDefault();
    saveDraftAsText();
    return;
  }

  if (key === 'o' && !event.shiftKey) {
    event.preventDefault();
    openDraftFilePicker();
    return;
  }

  if (key === 'c' && event.shiftKey) {
    event.preventDefault();
    void copyAllToClipboard();
  }
}

function setEditorStatus(message, state = 'info') {
  if (!editorActionStatus) {
    return;
  }

  window.clearTimeout(editorActionStatusTimeout);
  editorActionStatus.textContent = message;

  if (message) {
    editorActionStatus.dataset.state = state;
    editorActionStatusTimeout = window.setTimeout(() => {
      editorActionStatus.textContent = '';
      delete editorActionStatus.dataset.state;
    }, 3200);
    return;
  }

  delete editorActionStatus.dataset.state;
}

function saveDraftAsText() {
  const draftText = editor.getEditorText();
  const blob = new Blob([draftText], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = buildDraftFilename();
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  setEditorStatus(`Saved ${link.download}`, 'success');
}

async function copyAllToClipboard() {
  const draftText = editor.getEditorText();

  if (!draftText.trim()) {
    setEditorStatus('The draft is empty — nothing to copy yet.', 'error');
    return;
  }

  setBusy(copyDraftButton, true, 'Copy all to clipboard');

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(draftText);
    } else {
      const textarea = editor.getTextarea();
      const previousStart = textarea.selectionStart;
      const previousEnd = textarea.selectionEnd;

      textarea.focus();
      textarea.select();

      const copied = document.execCommand('copy');
      textarea.setSelectionRange(previousStart, previousEnd);

      if (!copied) {
        throw new Error('Clipboard copy failed');
      }
    }

    setEditorStatus('Full draft copied to the clipboard.', 'success');
  } catch {
    setEditorStatus('Could not copy automatically — please try again.', 'error');
  } finally {
    setBusy(copyDraftButton, false, 'Copy all to clipboard');
  }
}

function openDraftFilePicker() {
  draftFileInput.click();
}

async function importDraftFile(file) {
  if (!file) {
    return;
  }

  const isTextFile = file.type.startsWith('text/') || /\.txt$/i.test(file.name) || !file.type;

  if (!isTextFile) {
    setEditorStatus('Please choose a .txt file to load into the editor.', 'error');
    return;
  }

  setBusy(loadDraftButton, true, 'Load .txt');

  try {
    const text = await file.text();
    editor.setEditorText(text);
    setEditorStatus(`Loaded ${file.name}`, 'success');
  } catch {
    setEditorStatus('That file could not be loaded. Please try another .txt file.', 'error');
  } finally {
    draftFileInput.value = '';
    setBusy(loadDraftButton, false, 'Load .txt');
  }
}

function updateEditorChips(snapshot = null) {
  const lines = snapshot?.lines ?? editor?.getLines() ?? [];
  const activeLine = snapshot?.activeLine ?? editor?.getActiveLine() ?? null;
  const selectedText = snapshot?.selectedText ?? editor?.getSelectedText() ?? '';
  const activeText = activeLine?.text?.trim();

  if (selectedText) {
    chrome.setSelectionChip(`Selection · “${truncate(selectedText)}”`);
  } else if (activeText) {
    chrome.setSelectionChip(`Line ${activeLine.number} · “${truncate(activeText)}”`);
  } else {
    chrome.setSelectionChip('Nothing selected');
  }

  chrome.setLineChip(`${lines.length} lines · active #${activeLine?.number ?? 1}`);
}

function toggleCustomField(wrapper, visible) {
  wrapper.hidden = !visible;
  wrapper.classList.toggle('is-hidden', !visible);
}

function syncCustomFieldVisibility() {
  const useCustomTone = state.selectedTone === 'other';
  const useCustomEmotion = metaphorEmotion.value === 'other';

  toggleCustomField(rewriteToneOtherWrap, useCustomTone);
  toggleCustomField(metaphorEmotionOtherWrap, useCustomEmotion);
}

function syncIdeaRhymePatternField() {
  const parsedLineCount = Number.parseInt(ideaLineCount.value, 10);
  const normalizedLineCount = Number.isFinite(parsedLineCount)
    ? Math.min(4, Math.max(1, parsedLineCount))
    : 1;
  const patternOptions = IDEA_RHYME_PATTERNS[normalizedLineCount] ?? [];
  const shouldShow = normalizedLineCount > 1;
  const rememberedValue = state.ideaRhymeSelections[normalizedLineCount] ?? IDEA_DEFAULT_RHYME_PATTERNS[normalizedLineCount] ?? '';

  toggleCustomField(ideaRhymePatternWrap, shouldShow);

  if (!shouldShow) {
    ideaRhymePattern.replaceChildren();
    return;
  }

  const optionDefinitions = [...patternOptions, { value: '', label: 'No rhyme preference' }];

  ideaRhymePattern.replaceChildren(
    ...optionDefinitions.map(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );

  ideaRhymePattern.value = optionDefinitions.some(({ value }) => value === rememberedValue)
    ? rememberedValue
    : (IDEA_DEFAULT_RHYME_PATTERNS[normalizedLineCount] ?? '');

  state.ideaRhymeSelections[normalizedLineCount] = ideaRhymePattern.value;
}

function getSelectedRewriteTone() {
  return state.selectedTone === 'other'
    ? rewriteToneOther.value.trim()
    : state.selectedTone;
}

function getSelectedMetaphorEmotion() {
  return metaphorEmotion.value === 'other'
    ? metaphorEmotionOther.value.trim()
    : metaphorEmotion.value;
}

function getRhymeZoneUrl(target, type = 'perfect') {
  const params = new URLSearchParams({
    Word: target,
    org1: 'syl',
    org2: 'l',
    org3: 'y',
    typeofrhyme: type,
  });

  if (type === 'nry') {
    params.set('loc', 'nonry');
  }

  return `https://www.rhymezone.com/r/rhyme.cgi?${params.toString()}`;
}

function renderRhymeResults() {
  const payload = getSelectionPayload();
  const rhymeResults = findRhymes(payload.text, editor.getEditorText());

  if (!rhymeResults.target) {
    resultNodes.rhyme.innerHTML = '<p class="muted">Select a word or phrase to pull rhyme suggestions.</p>';
    return;
  }

  const perfectUrl = getRhymeZoneUrl(rhymeResults.target, 'perfect');
  const nearUrl = getRhymeZoneUrl(rhymeResults.target, 'nry');

  resultNodes.rhyme.innerHTML = `
    <div>
      <p class="inline-note">Target word</p>
      <p><strong>${escapeHtml(rhymeResults.target)}</strong></p>
    </div>
    <div class="external-link-row">
      <a class="external-link" href="${escapeHtml(perfectUrl)}" target="_blank" rel="noreferrer noopener">Open perfect rhymes on RhymeZone</a>
      <a class="external-link" href="${escapeHtml(nearUrl)}" target="_blank" rel="noreferrer noopener">Open near rhymes on RhymeZone</a>
    </div>
    <p class="inline-note">Safe link-out only — no RhymeZone scraping inside the app.</p>
  `;
}

function renderSyllableResults(lines = editor.getLines()) {
  const analyzedLines = analyzeLines(lines).filter((line) => line.text.trim());

  if (!analyzedLines.length) {
    resultNodes.syllables.innerHTML = '<p class="muted">Line counts will appear here as you write.</p>';
    return;
  }

  resultNodes.syllables.innerHTML = renderMetricList(
    analyzedLines.map((line) => ({
      label: `Line ${line.number}`,
      value: `${line.syllables} syllables`,
    })),
    { emptyText: 'Line counts will appear here as you write.' },
  );
}

function renderClicheResults(lines = editor.getLines()) {
  const matches = detectClichesByLine(lines);
  editor?.setFlaggedLines(matches);

  if (!matches.length) {
    resultNodes.cliches.innerHTML = '<p class="muted">No obvious clichés detected right now. Fresh air, nice.</p>';
    return;
  }

  resultNodes.cliches.innerHTML = `
    <ul class="cliche-list">
      ${matches.map((line) => `
        <li class="result-item">
          <strong>Line ${line.lineNumber}</strong>
          <div class="inline-note">${escapeHtml(line.text || '(blank line)')}</div>
          <div>${line.matches.map((match) => `<p><strong>${escapeHtml(match.phrase)}</strong> → ${escapeHtml(match.suggestions.join(' · '))}</p>`).join('')}</div>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderStatusPanel(lines = editor.getLines()) {
  const analysis = buildDraftAnalysis(lines);

  statusNodes.rhythmSummary.textContent = analysis.rhythmSummary;
  statusNodes.rhythmLines.innerHTML = renderMetricList(analysis.rhythmLines, {
    emptyText: 'Add a few lines to see cadence and range.',
  });
  statusNodes.repetitionSummary.textContent = analysis.repetitionSummary;
  statusNodes.repetitionDetail.innerHTML = `
    <div>
      <p class="inline-note">Repeated words</p>
      ${renderTokenList(analysis.repeatedWords, { emptyText: 'No standout repeated words yet.' })}
    </div>
    <div>
      <p class="inline-note">Repeated line endings</p>
      ${renderTokenList(analysis.repeatedEndings, { emptyText: 'Line endings are still fairly varied.', soft: true })}
    </div>
  `;
  statusNodes.structureSummary.textContent = analysis.structureSummary;
  statusNodes.structureDetail.innerHTML = renderMetricList(analysis.structureItems, {
    emptyText: 'Line count, stanza breaks, and shape cues live here.',
  });
}

function renderAiResult(node, items, note) {
  node.innerHTML = `
    ${renderResultList(items, { emptyText: 'No suggestions returned.' })}
    ${note ? `<p class="inline-note">${escapeHtml(note)}</p>` : ''}
  `;
}

function setExpandedToolGroup(groupName = null) {
  toolGroups.forEach((group) => {
    const shouldExpand = group.dataset.toolGroup === groupName;
    group.classList.toggle('is-expanded', shouldExpand);

    const toggle = group.querySelector('.tool-group-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    }
  });
}

function setActiveToolCard(cardName = null) {
  toolCards.forEach((card) => {
    card.classList.toggle('is-active', card.dataset.toolCard === cardName);
  });
}

function openIdeaModal() {
  if (!ideaModal) {
    return;
  }

  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  ideaModal.hidden = false;
  document.body.classList.add('has-open-modal');

  window.setTimeout(() => {
    ideaTopic?.focus();
  }, 0);
}

function closeIdeaModal() {
  if (!ideaModal || ideaModal.hidden) {
    return;
  }

  ideaModal.hidden = true;
  document.body.classList.remove('has-open-modal');
  lastFocusedElement?.focus?.();
}

function getIdeaPromptValues() {
  const parsedLineCount = Number.parseInt(ideaLineCount.value, 10);
  const normalizedLineCount = Number.isFinite(parsedLineCount)
    ? Math.min(4, Math.max(1, parsedLineCount))
    : 1;

  return {
    part: ideaPart.value,
    format: ideaFormat.value,
    text: ideaTopic.value.trim(),
    mood: ideaMood.value.trim(),
    perspective: ideaPerspective.value,
    lineCount: normalizedLineCount,
    rhymePattern: normalizedLineCount > 1 ? ideaRhymePattern.value : '',
    anchor: ideaAnchor.value.trim(),
  };
}

function requireSelection(node) {
  const payload = getSelectionPayload();

  if (!payload.text) {
    node.innerHTML = '<p class="muted">Select some text or place the caret on a non-empty line first.</p>';
    return null;
  }

  return payload;
}

async function runRewrite(button) {
  setExpandedToolGroup('revision');
  const payload = requireSelection(resultNodes.rewrite);

  if (!payload) {
    return;
  }

  const tone = getSelectedRewriteTone();

  if (!tone) {
    resultNodes.rewrite.innerHTML = '<p class="muted">Choose “Other” and type the rewrite tone you want first.</p>';
    rewriteToneOther.focus();
    return;
  }

  setBusy(button, true);

  const result = await rewriteSelection({
    text: payload.text,
    tone,
    contextLines: getContextLines(),
    aiAvailable: state.aiAvailable,
  });

  renderAiResult(resultNodes.rewrite, result.variants, result.note);
  setBusy(button, false);
}

async function runIdeaGenerator(button) {
  setExpandedToolGroup('starter');
  const request = getIdeaPromptValues();

  if (!request.text && !request.mood && !request.anchor) {
    resultNodes.ideas.innerHTML = '<p class="muted">Give the assistant at least a topic, a feeling, or one anchor detail first.</p>';
    ideaTopic.focus();
    return;
  }

  setBusy(button, true);

  const result = await generateLineIdeas({
    ...request,
    contextLines: getContextLines(),
    aiAvailable: state.aiAvailable,
  });

  renderAiResult(resultNodes.ideas, result.ideas, result.note);
  setBusy(button, false);
}

async function runImagery(button) {
  setExpandedToolGroup('imagery');
  const payload = requireSelection(resultNodes.imagery);

  if (!payload) {
    return;
  }

  setBusy(button, true);

  const result = await expandImagery({
    text: payload.text,
    contextLines: getContextLines(),
    aiAvailable: state.aiAvailable,
  });

  renderAiResult(resultNodes.imagery, result.variants, result.note);
  setBusy(button, false);
}

async function runMetaphor(button) {
  setExpandedToolGroup('imagery');
  const payload = requireSelection(resultNodes.metaphor);

  if (!payload) {
    return;
  }

  const emotion = getSelectedMetaphorEmotion();

  if (!emotion) {
    resultNodes.metaphor.innerHTML = '<p class="muted">Choose “Other” and type the emotion you want first.</p>';
    metaphorEmotionOther.focus();
    return;
  }

  setBusy(button, true);

  const result = await generateMetaphors({
    text: payload.text,
    emotion,
    contextLines: getContextLines(),
    aiAvailable: state.aiAvailable,
  });

  renderAiResult(resultNodes.metaphor, result.metaphors, result.note);
  setBusy(button, false);
}

async function syncAiHealth() {
  try {
    const health = await getAiHealth();
    state.aiAvailable = Boolean(health.aiAvailable);
    state.aiModel = health.model;
    chrome.setAiStatus({
      aiAvailable: state.aiAvailable,
      model: state.aiModel || 'local fallback mode',
    });
  } catch (_error) {
    state.aiAvailable = false;
    state.aiModel = null;
    chrome.setAiStatus({
      aiAvailable: false,
      model: 'local fallback mode',
    });
  }
}

function handleEditorChange({ lines, activeLine, selectedText }) {
  updateEditorChips({ lines, activeLine, selectedText });
  renderSyllableResults(lines);
  renderClicheResults(lines);
  renderStatusPanel(lines);
  syncLocalDraftBackup();
  updateAutosaveIndicator();
}

function handleSelectionChange({ lines, activeLine, selectedText }) {
  updateEditorChips({ lines, activeLine, selectedText });
}

editor = createEditor({
  container: editorHost,
  onChange: handleEditorChange,
  onSelectionChange: handleSelectionChange,
});

openIdeaStarterButton.addEventListener('click', () => {
  setExpandedToolGroup('starter');
  setActiveToolCard('starter');
  openIdeaModal();
});

closeIdeaModalButton.addEventListener('click', () => {
  closeIdeaModal();
});

ideaModalBackdrop.addEventListener('click', () => {
  closeIdeaModal();
});

saveDraftButton.addEventListener('click', () => {
  saveDraftAsText();
});

loadDraftButton.addEventListener('click', () => {
  openDraftFilePicker();
});

copyDraftButton.addEventListener('click', async () => {
  await copyAllToClipboard();
});

resetDraftButton.addEventListener('click', () => {
  resetDraftToDefault();
});

draftFileInput.addEventListener('change', async () => {
  const [file] = draftFileInput.files || [];
  await importDraftFile(file);
});

document.addEventListener('keydown', handleKeyboardShortcuts);

for (const group of toolGroups) {
  group.querySelector('.tool-group-toggle')?.addEventListener('click', () => {
    const isExpanded = group.classList.contains('is-expanded');
    setExpandedToolGroup(isExpanded ? null : group.dataset.toolGroup);
  });
}

applyShortcutHints();
restoreLocalDraftBackup();
updateAutosaveIndicator();

for (const button of document.querySelectorAll('[data-run-tool]')) {
  button.addEventListener('click', async () => {
    const tool = button.dataset.runTool;

    if (tool === 'rhyme') {
      setExpandedToolGroup('sound');
      setActiveToolCard('rhyme');
      renderRhymeResults();
      return;
    }

    if (tool === 'ideas') {
      setActiveToolCard('starter');
      await runIdeaGenerator(button);
      return;
    }

    if (tool === 'syllables') {
      setExpandedToolGroup('sound');
      setActiveToolCard('syllables');
      renderSyllableResults();
      return;
    }

    if (tool === 'cliches') {
      setExpandedToolGroup('revision');
      setActiveToolCard('cliches');
      renderClicheResults();
      return;
    }

    if (tool === 'rewrite') {
      setActiveToolCard('rewrite');
      await runRewrite(button);
      return;
    }

    if (tool === 'imagery') {
      setActiveToolCard('imagery');
      await runImagery(button);
      return;
    }

    if (tool === 'metaphor') {
      setActiveToolCard('metaphor');
      await runMetaphor(button);
    }
  });
}

for (const button of document.querySelectorAll('[data-tone]')) {
  button.addEventListener('click', () => {
    state.selectedTone = button.dataset.tone;
    syncCustomFieldVisibility();

    for (const toneButton of document.querySelectorAll('[data-tone]')) {
      toneButton.classList.toggle('is-active', toneButton === button);
    }

    if (state.selectedTone === 'other') {
      rewriteToneOther.focus();
    }
  });
}

metaphorEmotion.addEventListener('change', () => {
  syncCustomFieldVisibility();

  if (metaphorEmotion.value === 'other') {
    metaphorEmotionOther.focus();
  }
});

ideaLineCount.addEventListener('change', () => {
  syncIdeaRhymePatternField();
});

ideaRhymePattern.addEventListener('change', () => {
  const parsedLineCount = Number.parseInt(ideaLineCount.value, 10);
  const normalizedLineCount = Number.isFinite(parsedLineCount)
    ? Math.min(4, Math.max(1, parsedLineCount))
    : 1;

  if (normalizedLineCount > 1) {
    state.ideaRhymeSelections[normalizedLineCount] = ideaRhymePattern.value;
  }
});

updateEditorChips();
renderSyllableResults();
renderClicheResults();
renderStatusPanel();
syncCustomFieldVisibility();
syncIdeaRhymePatternField();
await syncAiHealth();

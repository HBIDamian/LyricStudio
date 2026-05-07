const THEME_STORAGE_KEY = 'lyric-studio-theme-preference';
const THEME_ICON_BY_THEME = {
  light: '☀︎',
  dark: '☾',
};

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function normalizeThemePreference(preference) {
  return preference === 'light' || preference === 'dark'
    ? preference
    : getSystemTheme();
}

function getSavedThemePreference() {
  try {
    return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return getSystemTheme();
  }
}

function persistThemePreference(preference) {
  const normalizedPreference = normalizeThemePreference(preference);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalizedPreference);
  } catch {
    // Ignore storage failures and continue with in-memory behavior.
  }
}

function applyThemePreference(preference, themeToggleButton = null) {
  const resolvedTheme = normalizeThemePreference(preference);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;

  if (!themeToggleButton) {
    return;
  }

  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
  const themeIcon = themeToggleButton.querySelector('[data-theme-icon]');

  themeToggleButton.dataset.theme = resolvedTheme;
  themeToggleButton.setAttribute('aria-pressed', String(resolvedTheme === 'dark'));
  themeToggleButton.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
  themeToggleButton.setAttribute('title', `Switch to ${nextTheme} theme`);

  if (themeIcon) {
    themeIcon.textContent = THEME_ICON_BY_THEME[resolvedTheme];
  }
}

export function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTokenList(items = [], { emptyText = 'Nothing here yet.', soft = false } = {}) {
  if (!items.length) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="token-list">
      ${items.map((item) => `<span class="token${soft ? ' soft' : ''}">${escapeHtml(item)}</span>`).join('')}
    </div>
  `;
}

export function renderResultList(items = [], { emptyText = 'Nothing here yet.' } = {}) {
  if (!items.length) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ol class="result-list">
      ${items.map((item) => `<li class="result-item">${escapeHtml(item)}</li>`).join('')}
    </ol>
  `;
}

export function renderMetricList(items = [], { emptyText = 'Nothing here yet.' } = {}) {
  if (!items.length) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ul class="metric-list">
      ${items.map((item) => `
        <li class="metric-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </li>
      `).join('')}
    </ul>
  `;
}

export function setBusy(button, busy, idleLabel = button.dataset.idleLabel || button.textContent) {
  if (!button.dataset.idleLabel) {
    button.dataset.idleLabel = idleLabel;
  }

  button.classList.toggle('is-busy', busy);
  button.textContent = busy ? 'Working…' : button.dataset.idleLabel;
}

export function setupChrome({
  workspace,
  toolPanel,
  statusPanel,
  toolToggle,
  statusToggle,
  themeToggleButton = null,
  aiStatus,
  selectionChip,
  lineChip,
}) {
  const mobileLayoutQuery = window.matchMedia('(max-width: 720px)');
  let themePreference = getSavedThemePreference();

  const updateTheme = (nextPreference, { persist = true } = {}) => {
    themePreference = nextPreference;

    if (persist) {
      persistThemePreference(nextPreference);
    }

    applyThemePreference(nextPreference, themeToggleButton);
  };

  const setToolPanelCollapsed = (collapsed) => {
    toolPanel.classList.toggle('is-collapsed', collapsed);
    workspace.classList.toggle('is-panel-collapsed', collapsed);
    toolToggle.textContent = collapsed ? 'Show tools' : 'Hide tools';
    toolToggle.setAttribute('aria-pressed', String(!collapsed));
  };

  const setStatusPanelCollapsed = (collapsed) => {
    statusPanel.classList.toggle('is-collapsed', collapsed);
    statusToggle.textContent = collapsed ? 'Show analysis' : 'Hide analysis';
    statusToggle.setAttribute('aria-pressed', String(!collapsed));
  };

  toolToggle.addEventListener('click', () => {
    setToolPanelCollapsed(!toolPanel.classList.contains('is-collapsed'));
  });

  statusToggle.addEventListener('click', () => {
    setStatusPanelCollapsed(!statusPanel.classList.contains('is-collapsed'));
  });

  if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
      updateTheme(themePreference === 'dark' ? 'light' : 'dark');
    });
  }

  updateTheme(themePreference, { persist: false });

  const collapsePanelsByDefault = mobileLayoutQuery.matches;
  setToolPanelCollapsed(collapsePanelsByDefault || toolPanel.classList.contains('is-collapsed'));
  setStatusPanelCollapsed(collapsePanelsByDefault || statusPanel.classList.contains('is-collapsed'));

  return {
    setAiStatus({ aiAvailable, model }) {
      aiStatus.classList.toggle('is-ready', aiAvailable);
      aiStatus.classList.toggle('is-unavailable', !aiAvailable);
      aiStatus.textContent = aiAvailable
        ? `AI tools ready · ${model}`
        : 'AI tools unavailable · add OPENAI_API_KEY';
    },
    setSelectionChip(label) {
      selectionChip.textContent = label;
    },
    setLineChip(label) {
      lineChip.textContent = label;
    },
  };
}

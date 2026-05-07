const THEME_STORAGE_KEY = 'lyric-studio-theme-preference';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedThemePreference() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function persistThemePreference(preference) {
  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures and continue with in-memory behavior.
  }
}

function applyThemePreference(preference, themeButtons = []) {
  const resolvedTheme = preference === 'system' ? getSystemTheme() : preference;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolvedTheme;

  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeChoice === preference;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
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
  themeButtons = [],
  aiStatus,
  selectionChip,
  lineChip,
}) {
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const mobileLayoutQuery = window.matchMedia('(max-width: 720px)');
  let themePreference = getSavedThemePreference();

  const updateTheme = (nextPreference, { persist = true } = {}) => {
    themePreference = nextPreference;

    if (persist) {
      persistThemePreference(nextPreference);
    }

    applyThemePreference(nextPreference, themeButtons);
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

  themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      updateTheme(button.dataset.themeChoice);
    });
  });

  const syncSystemTheme = () => {
    if (themePreference === 'system') {
      applyThemePreference('system', themeButtons);
    }
  };

  if (typeof systemThemeQuery.addEventListener === 'function') {
    systemThemeQuery.addEventListener('change', syncSystemTheme);
  } else if (typeof systemThemeQuery.addListener === 'function') {
    systemThemeQuery.addListener(syncSystemTheme);
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

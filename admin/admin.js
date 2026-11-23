const loginPanel = document.getElementById('login-panel');
const dashboard = document.getElementById('dashboard');
const editorRoot = document.getElementById('editor-root');
const loginStatus = document.getElementById('login-status');
const saveStatus = document.getElementById('save-status');
let csrfToken = '';
let siteData = null;
const staticMode = document.body.dataset.staticMode === 'true';
const TEMP_PASSWORD = 'Golf2026';
const CMS_STORAGE_KEY = 'oe-site-content-v1';
const CMS_HISTORY_KEY = 'oe-site-history-v1';
let staticBaseData = null;

async function api(action, extra = {}) {
  const response = await fetch('api.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Die Anfrage konnte nicht verarbeitet werden.');
  return result;
}

function showLogin(message = '') {
  loginPanel.hidden = false;
  dashboard.hidden = true;
  loginStatus.textContent = message;
}

function field(labelText, value, options = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const label = document.createElement('span');
  label.textContent = labelText;
  const control = options.multiline ? document.createElement('textarea') : document.createElement('input');
  if (options.multiline) control.rows = options.rows || 4;
  else control.type = 'text';
  control.value = value ?? '';
  control.dataset.path = options.path;
  if (options.multiline) control.dataset.multiline = 'true';
  wrapper.append(label, control);
  return wrapper;
}

function section(title, description = '') {
  const panel = document.createElement('section');
  panel.className = 'editor-section';
  const heading = document.createElement('div');
  heading.className = 'section-heading';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  heading.append(h2);
  if (description) {
    const p = document.createElement('p');
    p.textContent = description;
    heading.append(p);
  }
  panel.append(heading);
  return panel;
}

function addTextField(parent, label, data, path, multiline = false, rows = 4) {
  const value = path.split('.').reduce((obj, key) => obj?.[key], data);
  parent.append(field(label, value, { path, multiline, rows }));
}

function benefitsEditor(parent, label, list, path) {
  const group = document.createElement('div');
  group.className = 'repeat-group';
  const title = document.createElement('h3');
  title.textContent = label;
  const rows = document.createElement('div');
  rows.className = 'repeat-rows';
  (Array.isArray(list) ? list : []).forEach(value => rows.append(repeatRow(value)));
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-row';
  add.textContent = '+ Stichpunkt hinzufügen';
  add.addEventListener('click', () => rows.append(repeatRow('')));
  group.append(title, rows, add);
  group.dataset.listPath = path;
  parent.append(group);
}

function repeatRow(value) {
  const row = document.createElement('div');
  row.className = 'repeat-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.setAttribute('aria-label', 'Stichpunkt');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-row';
  remove.setAttribute('aria-label', 'Stichpunkt entfernen');
  remove.textContent = 'Entfernen';
  remove.addEventListener('click', () => row.remove());
  row.append(input, remove);
  return row;
}

function timelineEditor(parent, career) {
  const group = document.createElement('div');
  group.className = 'repeat-group timeline-editor';
  const title = document.createElement('h3');
  title.textContent = 'Erfolge als Playing Pro';
  const rows = document.createElement('div');
  rows.className = 'timeline-rows';
  (Array.isArray(career) ? career : []).forEach(entry => rows.append(timelineRow(entry)));
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-row';
  add.textContent = '+ Jahr hinzufügen';
  add.addEventListener('click', () => rows.append(timelineRow({ year: '', achievements: [''] })));
  group.append(title, rows, add);
  group.dataset.timeline = 'career';
  parent.append(group);
}

function timelineRow(entry) {
  const card = document.createElement('div');
  card.className = 'timeline-edit-card';
  const year = document.createElement('input');
  year.type = 'text';
  year.inputMode = 'numeric';
  year.placeholder = 'Jahr';
  year.setAttribute('aria-label', 'Jahr');
  year.value = entry.year || '';
  const heading = document.createElement('div');
  heading.className = 'timeline-edit-heading';
  heading.append(year);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-row';
  remove.textContent = 'Jahr entfernen';
  remove.addEventListener('click', () => card.remove());
  heading.append(remove);
  const achievements = document.createElement('div');
  achievements.className = 'repeat-rows';
  (entry.achievements || []).forEach(value => achievements.append(repeatRow(value)));
  const addAchievement = document.createElement('button');
  addAchievement.type = 'button';
  addAchievement.className = 'add-row small-add';
  addAchievement.textContent = '+ Erfolg hinzufügen';
  addAchievement.addEventListener('click', () => achievements.append(repeatRow('')));
  card.append(heading, achievements, addAchievement);
  return card;
}

function renderEditor() {
  editorRoot.replaceChildren();
  const home = section('Startseite', 'Die Texte auf der Startseite anpassen.');
  addTextField(home, 'Hauptüberschrift – erste Zeile', siteData.home, 'heroTitleFirst');
  addTextField(home, 'Hauptüberschrift – hervorgehobene Zeile', siteData.home, 'heroTitleEmphasis');
  addTextField(home, 'Einleitung', siteData.home, 'heroDescription', true, 3);
  addTextField(home, 'Zitat', siteData.home, 'trainerQuote', true, 2);
  addTextField(home, 'Zitat von', siteData.home, 'trainerQuoteAuthor');
  editorRoot.append(home);

  const training = section('Trainingsangebote', 'Angebote, Preise und Stichpunkte ändern oder ergänzen.');
  for (const offer of ['offer', 'individual']) {
    const label = offer === 'offer' ? 'Gruppentraining' : 'Individualtraining';
    const sub = document.createElement('div');
    sub.className = 'offer-editor';
    const title = document.createElement('h3');
    title.textContent = label;
    sub.append(title);
    addTextField(sub, 'Angebotstitel', siteData.training, `${offer}.title`);
    addTextField(sub, 'Beschreibung', siteData.training, `${offer}.description`, true, 5);
    addTextField(sub, 'Preis', siteData.training, `${offer}.price`);
    addTextField(sub, 'Dauer', siteData.training, `${offer}.duration`);
    benefitsEditor(sub, 'Stichpunkte', siteData.training[offer].benefits, `${offer}.benefits`);
    training.append(sub);
  }
  editorRoot.append(training);

  const trainer = section('Über Oliver', 'Vorstellung und Erfolge im Zeitstrahl pflegen.');
  addTextField(trainer, 'Name', siteData.trainer, 'name');
  addTextField(trainer, 'Vorstellungstext', siteData.trainer, 'intro', true, 4);
  timelineEditor(trainer, siteData.trainer.career);
  editorRoot.append(trainer);
}

function readEditor() {
  document.querySelectorAll('#editor-root [data-path]').forEach(control => {
    const keys = control.dataset.path.split('.');
    let target = siteData;
    if (keys[0] === 'heroTitleFirst' || keys[0] === 'heroTitleEmphasis' || keys[0] === 'heroDescription' || keys[0] === 'trainerQuote' || keys[0] === 'trainerQuoteAuthor') target = siteData.home;
    else if (keys[0] === 'offer' || keys[0] === 'individual') target = siteData.training;
    else target = siteData.trainer;
    for (const key of keys.slice(0, -1)) target = target[key];
    target[keys[keys.length - 1]] = control.value.trim();
  });
  document.querySelectorAll('#editor-root [data-list-path]').forEach(group => {
    const [kind, key] = group.dataset.listPath.split('.');
    siteData.training[kind][key] = [...group.querySelectorAll('.repeat-row input')].map(input => input.value.trim()).filter(Boolean);
  });
  siteData.trainer.career = [...document.querySelectorAll('.timeline-edit-card')].map(card => ({
    year: card.querySelector('.timeline-edit-heading input').value.trim(),
    achievements: [...card.querySelectorAll('.repeat-rows input')].map(input => input.value.trim()).filter(Boolean)
  })).filter(entry => entry.year && entry.achievements.length);
}

async function loadEditor() {
  if (staticMode) {
    const entries = await Promise.all(['home', 'training', 'trainer'].map(async name => {
      const response = await fetch(`../data/${name}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Inhalte für ${name} konnten nicht geladen werden.`);
      return [name, await response.json()];
    }));
    staticBaseData = Object.fromEntries(entries);
    const saved = readStoredContent();
    siteData = saved || structuredClone(staticBaseData);
    document.querySelector('.help').textContent = 'HTML-Übergangsmodus: „Änderungen speichern“ merkt sich deine Änderungen in diesem Browser. Sie erscheinen auf der Website nur in diesem Browser, nicht bei anderen Besuchern.';
    document.getElementById('save-all').hidden = false;
    document.getElementById('save-all').textContent = 'Änderungen speichern';
    document.getElementById('undo-save').hidden = false;
    document.getElementById('download-actions')?.remove();
    updateUndoButton();
  } else {
    const result = await api('load', { csrf: csrfToken });
    siteData = result.data;
  }
  renderEditor();
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

document.getElementById('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  loginStatus.textContent = 'Anmeldung wird geprüft …';
  try {
    if (staticMode) {
      if (document.getElementById('password').value !== TEMP_PASSWORD) throw new Error('Das Passwort stimmt nicht.');
    } else {
      const result = await api('login', { password: document.getElementById('password').value });
      csrfToken = result.csrf;
    }
    await loadEditor();
  } catch (error) {
    showLogin(error.message);
  } finally {
    button.disabled = false;
  }
});

function readStoredContent() {
  try { return JSON.parse(localStorage.getItem(CMS_STORAGE_KEY) || 'null'); } catch { return null; }
}

function readHistory() {
  try { const value = JSON.parse(localStorage.getItem(CMS_HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}

function updateUndoButton() {
  const button = document.getElementById('undo-save');
  if (button) button.disabled = readHistory().length === 0;
}

document.getElementById('undo-save').addEventListener('click', () => {
  const history = readHistory();
  const previous = history.pop();
  if (!previous) return;
  try {
    localStorage.setItem(CMS_HISTORY_KEY, JSON.stringify(history));
    localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(previous));
    siteData = structuredClone(previous);
    renderEditor();
    updateUndoButton();
    saveStatus.textContent = 'Letzte gespeicherte Änderung wurde rückgängig gemacht. Sie gilt in diesem Browser.';
  } catch {
    saveStatus.textContent = 'Rückgängig war nicht möglich. Der Browserspeicher ist eventuell voll.';
  }
});

document.getElementById('save-all').addEventListener('click', async event => {
  readEditor();
  const button = event.currentTarget;
  button.disabled = true;
  saveStatus.textContent = 'Änderungen werden gespeichert …';
  try {
    if (staticMode) {
      const history = readHistory();
      const previous = readStoredContent() || staticBaseData;
      history.push(structuredClone(previous));
      while (history.length > 20) history.shift();
      localStorage.setItem(CMS_HISTORY_KEY, JSON.stringify(history));
      localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(siteData));
      updateUndoButton();
      saveStatus.textContent = 'Änderungen gespeichert. Sie gelten in diesem Browser.';
    } else {
      const result = await api('save', { csrf: csrfToken, data: siteData });
      saveStatus.textContent = result.message;
    }
  } catch (error) {
    saveStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.getElementById('logout').addEventListener('click', async () => {
  if (!staticMode) { try { await api('logout', { csrf: csrfToken }); } catch {} }
  csrfToken = '';
  siteData = null;
  document.getElementById('password').value = '';
  showLogin('Du wurdest abgemeldet.');
});

if (!staticMode) (async () => {
  try {
    const result = await api('check');
    csrfToken = result.csrf;
    await loadEditor();
  } catch {
    showLogin('Bitte mit deinem Admin-Passwort anmelden.');
  }
})();

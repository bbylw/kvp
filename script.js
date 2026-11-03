'use strict';

const ICON_PATTERN = /^(?:fas|far|fab|fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/;
const FALLBACK_ICON = 'fa-solid fa-globe';
const API_ENDPOINT = '/api/links';

const state = {
  sections: [],
  links: [],
  editing: false,
  mode: 'save',
  target: null,
  password: '',
  busy: false,
};

const els = {};
let toastTimer = 0;

document.addEventListener('DOMContentLoaded', init);

function init() {
  cacheElements();
  state.sections = els.sections;
  buildNavigation();
  bindEvents();
  observeSections();
  els.year.textContent = String(new Date().getFullYear());
  setActive(location.hash.slice(1));
  loadLinks();
}

function cacheElements() {
  els.nav = document.getElementById('category-nav');
  els.sections = Array.from(document.querySelectorAll('main > section'));
  els.status = document.getElementById('load-status');
  els.statusText = document.getElementById('status-text');
  els.retry = document.getElementById('retry');

  els.dialog = document.getElementById('edit-dialog');
  els.form = document.getElementById('link-form');
  els.dialogTitle = document.getElementById('dialog-title');
  els.dialogSummary = document.getElementById('dialog-summary');
  els.fields = document.getElementById('link-fields');
  els.password = document.getElementById('edit-password');
  els.category = document.getElementById('category');
  els.title = document.getElementById('title');
  els.url = document.getElementById('url');
  els.icon = document.getElementById('icon');
  els.formMessage = document.getElementById('form-message');
  els.deleteButton = document.getElementById('delete-link');
  els.cancelButton = document.getElementById('cancel-edit');
  els.saveButton = document.getElementById('save-link');

  els.toggle = document.getElementById('toggle-edit');
  els.toggleLabel = document.getElementById('toggle-label');
  els.toggleIcon = document.getElementById('toggle-icon');
  els.addButton = document.getElementById('add-link');
  els.toast = document.getElementById('toast');
  els.year = document.getElementById('year');
}

function buildNavigation() {
  const fragment = document.createDocumentFragment();

  for (const section of state.sections) {
    const title = getSectionTitle(section);

    const anchor = document.createElement('a');
    anchor.href = `#${section.id}`;
    anchor.textContent = title;
    anchor.dataset.target = section.id;

    const item = document.createElement('li');
    item.append(anchor);
    fragment.append(item);

    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = title;
    els.category.append(option);
  }

  els.nav.append(fragment);
}

function getSectionTitle(section) {
  const heading = section.querySelector('.category-title');
  return heading ? heading.textContent.trim() : section.id;
}

function bindEvents() {
  els.form.addEventListener('submit', handleSubmit);
  els.deleteButton.addEventListener('click', handleDelete);
  els.cancelButton.addEventListener('click', () => els.dialog.close());
  els.retry.addEventListener('click', () => loadLinks());
  els.toggle.addEventListener('click', toggleEditMode);
  els.addButton.addEventListener('click', () => openDialog(null));

  for (const button of els.dialog.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => els.dialog.close());
  }

  els.dialog.addEventListener('click', (event) => {
    if (event.target !== els.dialog) return;

    const rect = els.dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (outside) els.dialog.close();
  });

  els.nav.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-target]');
    if (link) setActive(link.dataset.target);
  });

  window.addEventListener('hashchange', () => setActive(location.hash.slice(1)));
}

async function loadLinks({ silent = false } = {}) {
  if (!silent) {
    setStatus('正在加载链接…', { loading: true });
  }
  els.retry.hidden = true;

  try {
    const response = await fetch(API_ENDPOINT, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`服务返回 ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('数据格式不正确');
    }

    state.links = data;
    clearStatus();
    renderLinks();
    resolveActiveSection();
  } catch (error) {
    console.error('加载链接失败:', error);
    setStatus('链接加载失败，请检查网络或稍后重试。', { isError: true });
    els.retry.hidden = false;
  }
}

function setStatus(text, { isError = false, loading = false } = {}) {
  els.statusText.textContent = text;
  els.status.classList.toggle('is-error', isError);
  els.status.classList.toggle('is-loading', loading);
  els.status.hidden = false;
}

function clearStatus() {
  els.status.hidden = true;
}

function renderLinks() {
  const groups = new Map(state.sections.map((section) => [section.id, []]));

  for (const link of state.links) {
    if (!link || typeof link !== 'object') continue;

    const bucket = groups.get(link.category);
    const href = safeUrl(link.url);
    if (!bucket || !href) continue;

    bucket.push({
      category: link.category,
      title: typeof link.title === 'string' ? link.title : '',
      url: typeof link.url === 'string' ? link.url : '',
      icon: typeof link.icon === 'string' ? link.icon : '',
      href,
    });
  }

  for (const section of state.sections) {
    const items = groups.get(section.id) || [];
    const grid = section.querySelector('.link-grid');
    const fragment = document.createDocumentFragment();

    for (const link of items) {
      fragment.append(createCard(link));
    }

    grid.replaceChildren(fragment);
    section.hidden = items.length === 0;

    const navItem = els.nav.querySelector(`a[data-target="${section.id}"]`)?.parentElement;
    if (navItem) navItem.hidden = items.length === 0;
  }

  const total = state.sections.reduce((sum, section) => sum + groups.get(section.id).length, 0);
  if (total === 0) {
    setStatus('还没有任何链接，点击右下角「管理」添加第一条。');
  }
}

function createCard(link) {
  const card = document.createElement('article');
  card.className = 'link-card';

  const anchor = document.createElement('a');
  anchor.className = 'link-main';
  anchor.href = link.href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';

  const iconWrap = document.createElement('span');
  iconWrap.className = 'link-icon';

  const icon = document.createElement('i');
  icon.className = ICON_PATTERN.test(link.icon) ? link.icon : FALLBACK_ICON;
  icon.setAttribute('aria-hidden', 'true');
  iconWrap.append(icon);

  const title = document.createElement('span');
  title.className = 'link-title';
  title.textContent = link.title;

  anchor.append(iconWrap, title);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.append(
    createActionButton('fas fa-pen', `编辑 ${link.title}`, () => openDialog(link)),
    createActionButton('fas fa-trash-alt', `删除 ${link.title}`, () => openDialog(link, 'delete')),
  );

  card.append(anchor, actions);
  return card;
}

function createActionButton(iconClass, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn';
  button.setAttribute('aria-label', label);
  button.title = label;

  const icon = document.createElement('i');
  icon.className = iconClass;
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);

  button.addEventListener('click', onClick);
  return button;
}

function toggleEditMode() {
  state.editing = !state.editing;
  document.body.classList.toggle('is-editing', state.editing);
  els.toggle.setAttribute('aria-pressed', String(state.editing));
  els.toggleLabel.textContent = state.editing ? '完成' : '管理';
  els.toggleIcon.className = state.editing ? 'fas fa-check' : 'fas fa-edit';

  if (!state.editing && els.dialog.open) {
    els.dialog.close();
  }
}

function openDialog(link = null, mode = 'save') {
  if (mode === 'delete' && !link) return;

  state.mode = mode;
  state.target = link;

  const deleting = mode === 'delete';
  els.dialogTitle.textContent = deleting ? '删除链接' : link ? '编辑链接' : '添加链接';

  els.dialogSummary.hidden = !deleting;
  els.dialogSummary.textContent = deleting
    ? `确定要删除「${link.title}」吗？此操作不可撤销。`
    : '';

  els.fields.hidden = deleting;
  els.saveButton.hidden = deleting;
  els.deleteButton.hidden = !deleting;
  els.cancelButton.hidden = !deleting && !link;

  if (!deleting) {
    els.category.value = link ? link.category : firstVisibleCategory();
    els.title.value = link ? link.title : '';
    els.url.value = link ? link.url : '';
    els.icon.value = link ? link.icon : '';
  }

  els.password.value = state.password;
  els.formMessage.textContent = '';

  if (!els.dialog.open) {
    els.dialog.showModal();
  }

  if (state.password || deleting) {
    els.password.focus();
    els.password.select();
  } else if (link) {
    els.title.focus();
  } else {
    els.password.focus();
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  if (state.mode !== 'save') return;

  const password = els.password.value;
  if (!password) {
    showFormMessage('请输入编辑密码');
    els.password.focus();
    return;
  }

  const link = {
    category: els.category.value,
    title: els.title.value.trim(),
    url: els.url.value.trim(),
    icon: els.icon.value.trim(),
  };

  if (!link.title) {
    showFormMessage('请填写标题');
    els.title.focus();
    return;
  }

  if (!normalizeUrlInput(link.url)) {
    showFormMessage('请填写有效的网址，例如 https://example.com');
    els.url.focus();
    return;
  }

  if (link.icon && !ICON_PATTERN.test(link.icon)) {
    showFormMessage('图标类名格式不正确，例如 fas fa-globe');
    els.icon.focus();
    return;
  }

  const payload = { password, link };
  if (state.mode === 'save' && state.target) {
    payload.originalUrl = state.target.url;
  }

  await sendRequest('POST', payload, '链接已保存');
}

async function handleDelete() {
  const password = els.password.value;
  if (!password) {
    showFormMessage('请输入编辑密码');
    els.password.focus();
    return;
  }

  if (!state.target) return;

  await sendRequest('DELETE', { password, url: state.target.url }, '链接已删除');
}

async function sendRequest(method, payload, successMessage) {
  if (state.busy) return;

  state.busy = true;
  els.saveButton.disabled = true;
  els.deleteButton.disabled = true;

  try {
    const response = await fetch(API_ENDPOINT, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `请求失败（${response.status}）`);
    }

    state.password = payload.password;
    els.dialog.close();
    showToast(successMessage);
    await loadLinks({ silent: true });
  } catch (error) {
    showFormMessage(error.message || '请求失败，请稍后重试');
  } finally {
    state.busy = false;
    els.saveButton.disabled = false;
    els.deleteButton.disabled = false;
  }
}

function showFormMessage(message) {
  els.formMessage.textContent = message;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

function firstVisibleCategory() {
  const section = state.sections.find((item) => !item.hidden);
  return (section || state.sections[0]).id;
}

function observeSections() {
  let ticking = false;

  const update = () => {
    ticking = false;

    const visibleSections = state.sections.filter((section) => !section.hidden);
    if (!visibleSections.length) return;

    const marker = window.scrollY + 96;
    let activeId = visibleSections[0].id;

    for (const section of visibleSections) {
      const top = section.getBoundingClientRect().top + window.scrollY;
      if (top <= marker) activeId = section.id;
      else break;
    }

    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

    if (atBottom) {
      activeId = visibleSections[visibleSections.length - 1].id;
    }

    setActive(activeId);
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  update();
}

function setActive(id) {
  for (const link of els.nav.querySelectorAll('a[data-target]')) {
    const active = Boolean(id) && link.dataset.target === id;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

function resolveActiveSection() {
  const hash = location.hash.slice(1);
  if (hash && els.nav.querySelector(`a[data-target="${hash}"]`)) {
    setActive(hash);
    return;
  }

  const current = els.nav.querySelector('a.active');
  if (current && !current.parentElement.hidden) return;

  const firstVisible = state.sections.find((section) => !section.hidden);
  if (firstVisible) setActive(firstVisible.id);
}

function normalizeUrlInput(value) {
  if (typeof value !== 'string') return null;

  let raw = value.trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function safeUrl(value) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

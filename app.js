'use strict';

// ── State ──────────────────────────────────────────
let currentPage = 'friends';
let calDate = new Date();
let selectedDate = null;
let selectedMood = null;
let quickSelectedMood = null;
let pendingDeleteId = null;
let currentDetailId = null;   // 目前開啟的朋友詳情 ID

let friends = [];
let moods = {};

// ── 主題定義 ────────────────────────────────────────
const THEMES = {
  purple: {
    primary: '#7C3AED', light: '#A855F7', pale: '#F3E8FF',
    grad1: '#7C3AED', grad2: '#A855F7',
    bg: '#F5F3FF', card: '#ffffff', text: '#1E1B2E', text2: '#6B7280',
    border: '#E5E7EB', themeColor: '#7C3AED'
  },
  pink: {
    primary: '#DB2777', light: '#EC4899', pale: '#FDF2F8',
    grad1: '#DB2777', grad2: '#EC4899',
    bg: '#FFF0F6', card: '#ffffff', text: '#3D0A1E', text2: '#9D174D',
    border: '#FBCFE8', themeColor: '#DB2777'
  },
  blue: {
    primary: '#0284C7', light: '#38BDF8', pale: '#E0F2FE',
    grad1: '#0284C7', grad2: '#38BDF8',
    bg: '#F0F9FF', card: '#ffffff', text: '#0C2340', text2: '#075985',
    border: '#BAE6FD', themeColor: '#0284C7'
  },
  green: {
    primary: '#059669', light: '#34D399', pale: '#D1FAE5',
    grad1: '#059669', grad2: '#34D399',
    bg: '#ECFDF5', card: '#ffffff', text: '#052E16', text2: '#065F46',
    border: '#A7F3D0', themeColor: '#059669'
  },
  dark: {
    primary: '#A78BFA', light: '#C4B5FD', pale: '#2D2B3F',
    grad1: '#6D28D9', grad2: '#A78BFA',
    bg: '#1A1825', card: '#252334', text: '#F3F0FF', text2: '#9CA3AF',
    border: '#3F3D52', themeColor: '#6D28D9'
  }
};

// ── Storage ────────────────────────────────────────
function loadData() {
  try {
    friends = JSON.parse(localStorage.getItem('rt_friends') || '[]');
    moods   = JSON.parse(localStorage.getItem('rt_moods')   || '{}');
  } catch {
    friends = [];
    moods = {};
  }
}

function saveData() {
  localStorage.setItem('rt_friends', JSON.stringify(friends));
  localStorage.setItem('rt_moods',   JSON.stringify(moods));
}

// ── Utilities ──────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function daysSince(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now   = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now - start) / 86400000);
}

function formatDays(days) {
  if (days < 0)   return `倒數 ${-days} 天`;
  if (days === 0) return '今天認識的 🎉';
  if (days < 30)  return `認識 ${days} 天`;
  if (days < 365) {
    const m = Math.floor(days / 30);
    const d = days % 30;
    return d > 0 ? `認識 ${m} 個月 ${d} 天` : `認識 ${m} 個月`;
  }
  const y = Math.floor(days / 365);
  const rem = days - y * 365;
  const m = Math.floor(rem / 30);
  return m > 0 ? `認識 ${y} 年 ${m} 個月` : `認識 ${y} 年`;
}

function formatDisplayDate(dateStr) {
  const DAY = ['日', '一', '二', '三', '四', '五', '六'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${y} 年 ${m} 月 ${d} 日（${DAY[dow]}）`;
}

// ── 將 File 轉 base64 ───────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 主題系統 ────────────────────────────────────────
function applyTheme(themeKey, customColors) {
  const root = document.documentElement;

  // 移除所有主題 data 屬性
  root.removeAttribute('data-theme');

  let t;
  if (themeKey === 'custom' && customColors) {
    // 自訂主題：從用戶選的顏色衍生
    t = buildCustomTheme(customColors.primary, customColors.light);
  } else if (THEMES[themeKey]) {
    t = THEMES[themeKey];
    if (themeKey === 'dark') root.setAttribute('data-theme', 'dark');
  } else {
    t = THEMES.purple;
  }

  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-light', t.light);
  root.style.setProperty('--primary-pale', t.pale);
  root.style.setProperty('--grad', `linear-gradient(135deg, ${t.grad1} 0%, ${t.grad2} 100%)`);
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--card', t.card);
  root.style.setProperty('--text', t.text);
  root.style.setProperty('--text-2', t.text2);
  root.style.setProperty('--border', t.border);

  // 更新 meta theme-color
  document.getElementById('themeColorMeta').setAttribute('content', t.themeColor || t.primary);

  // 更新自訂色塊預覽
  if (themeKey === 'custom' && customColors) {
    document.getElementById('customSwatch').style.background =
      `linear-gradient(135deg, ${customColors.primary}, ${customColors.light})`;
    document.getElementById('customSwatch').textContent = '';
  }

  // 更新打勾標記
  document.querySelectorAll('.theme-check').forEach(el => el.textContent = '');
  const checkEl = document.getElementById(`check-${themeKey}`);
  if (checkEl) checkEl.textContent = '✓';

  // 更新 active 樣式
  document.querySelectorAll('.theme-option').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-theme="${themeKey}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

function buildCustomTheme(primary, light) {
  // 簡單衍生：pale 是主色的超淺版，bg 更淺
  return {
    primary, light,
    pale: hexWithAlpha(primary, 0.12),
    grad1: primary, grad2: light,
    bg: hexWithAlpha(primary, 0.05),
    card: '#ffffff', text: '#1E1B2E', text2: '#6B7280',
    border: hexWithAlpha(primary, 0.20),
    themeColor: primary
  };
}

// 將 hex 色彩轉成 rgba 字串（用於 CSS 淺色背景）
function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function loadTheme() {
  const saved = JSON.parse(localStorage.getItem('rt_theme') || '{"key":"purple"}');
  applyTheme(saved.key, saved.custom);
  // 若為自訂，設定 color picker 初始值
  if (saved.key === 'custom' && saved.custom) {
    document.getElementById('customPrimary').value = saved.custom.primary;
    document.getElementById('customLight').value   = saved.custom.light;
    document.getElementById('customThemePanel').classList.remove('hidden');
  }
}

function saveTheme(key, custom) {
  localStorage.setItem('rt_theme', JSON.stringify({ key, custom: custom || null }));
}

// ── Friends Page ───────────────────────────────────
function renderFriends() {
  const list = document.getElementById('friendsList');

  if (friends.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">👋</span>
        還沒有朋友記錄<br>快來新增第一位朋友吧！
      </div>`;
    return;
  }

  list.innerHTML = friends.map(f => {
    const days = daysSince(f.date);
    // 大頭照：有圖片用 img，否則顯示姓名首字
    const avatarInner = f.photo
      ? `<img src="${f.photo}" alt="${escapeHtml(f.name)}">`
      : escapeHtml(Array.from(f.name)[0]);
    return `
      <div class="friend-card" data-id="${escapeHtml(f.id)}">
        <div class="friend-avatar">${avatarInner}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(f.name)}</div>
          <div class="friend-days">${formatDays(days)}</div>
          <div class="friend-since">從 ${f.date} 開始</div>
        </div>
        <button class="delete-btn" data-id="${escapeHtml(f.id)}" aria-label="刪除">✕</button>
      </div>`;
  }).join('');
}

function addFriend() {
  const nameEl = document.getElementById('friendName');
  const dateEl = document.getElementById('friendDate');
  const name = nameEl.value.trim();
  const date = dateEl.value;

  let valid = true;
  if (!name) { nameEl.classList.add('error'); valid = false; }
  if (!date) { dateEl.classList.add('error'); valid = false; }
  if (!valid) return;

  friends.unshift({ id: Date.now().toString(36), name, date, photo: null, note: '', noteImages: [] });
  saveData();
  nameEl.value = '';
  setDefaultDate();
  renderFriends();
  nameEl.focus();
}

function setDefaultDate() {
  document.getElementById('friendDate').value = todayStr();
}

// ── 朋友詳情頁 ─────────────────────────────────────
function openFriendDetail(id) {
  const f = friends.find(x => x.id === id);
  if (!f) return;
  currentDetailId = id;

  // 顯示大頭照
  const avatarEl = document.getElementById('detailAvatar');
  if (f.photo) {
    avatarEl.innerHTML = `<img src="${f.photo}" alt="${escapeHtml(f.name)}">`;
  } else {
    avatarEl.textContent = Array.from(f.name)[0];
  }

  document.getElementById('detailName').textContent = f.name;
  const days = daysSince(f.date);
  document.getElementById('detailDays').textContent = formatDays(days);
  document.getElementById('detailSince').textContent = `從 ${f.date} 開始`;
  document.getElementById('detailNote').value = f.note || '';

  renderNoteImages(f);

  document.getElementById('friendDetailPage').classList.remove('hidden');
}

function closeFriendDetail() {
  document.getElementById('friendDetailPage').classList.add('hidden');
  currentDetailId = null;
  renderFriends(); // 更新列表（大頭照可能已更新）
}

function renderNoteImages(f) {
  const grid = document.getElementById('noteImagesGrid');
  const images = f.noteImages || [];
  if (images.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-2);font-size:13px;">還沒有圖片</div>';
    return;
  }
  grid.innerHTML = images.map((src, i) => `
    <div class="note-thumb-wrap">
      <img class="note-thumb" src="${src}" alt="備註圖片 ${i + 1}">
      <button class="note-thumb-del" data-index="${i}" aria-label="刪除圖片">✕</button>
    </div>`).join('');
}

// ── Calendar ───────────────────────────────────────
function renderCalendar() {
  const y = calDate.getFullYear();
  const m = calDate.getMonth();

  document.getElementById('monthYear').textContent = `${y} 年 ${m + 1} 月`;

  const firstDow  = new Date(y, m, 1).getDay();
  const lastDay   = new Date(y, m + 1, 0).getDate();
  const today     = todayStr();

  let html = '';

  for (let i = 0; i < firstDow; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let d = 1; d <= lastDay; d++) {
    const ds   = `${y}-${pad(m + 1)}-${pad(d)}`;
    const mood = moods[ds];
    const cls  = [
      'calendar-day',
      ds === today  ? 'today'    : '',
      mood          ? 'has-mood' : '',
    ].join(' ').trim();

    html += `
      <div class="${cls}" data-date="${ds}">
        <span class="day-num">${d}</span>
        ${mood ? `<span class="day-mood">${mood.emoji}</span>` : ''}
      </div>`;
  }

  document.getElementById('calendarDays').innerHTML = html;
  renderMoodHistory(y, m);
}

function renderMoodHistory(y, m) {
  const entries = Object.entries(moods)
    .filter(([ds]) => {
      const [ey, em] = ds.split('-').map(Number);
      return ey === y && em === m + 1;
    })
    .sort(([a], [b]) => b.localeCompare(a));

  const el = document.getElementById('moodHistory');

  if (entries.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📭</span>
        這個月還沒有心情記錄<br>點選日曆上的日期或右下角 ＋ 來新增！
      </div>`;
    return;
  }

  el.innerHTML = entries.map(([ds, data]) => `
    <div class="mood-entry" data-date="${ds}">
      <span class="entry-emoji">${data.emoji}</span>
      <div class="entry-content">
        <div class="entry-date">${formatDisplayDate(ds)}</div>
        ${data.note ? `<div class="entry-note">${escapeHtml(data.note)}</div>` : ''}
      </div>
    </div>`).join('');
}

// ── 裝飾圖案系統 ────────────────────────────────────

// 每個心情對應的色彩組
const MOOD_COLORS = {
  '😊': { c1: '#FEF3C7', c2: '#FCD34D', c3: '#F59E0B' }, // 黃色系
  '😢': { c1: '#DBEAFE', c2: '#93C5FD', c3: '#3B82F6' }, // 藍色系
  '😡': { c1: '#FEE2E2', c2: '#FCA5A5', c3: '#EF4444' }, // 紅色系
  '😴': { c1: '#EDE9FE', c2: '#C4B5FD', c3: '#8B5CF6' }, // 紫色系
  '😍': { c1: '#FCE7F3', c2: '#F9A8D4', c3: '#EC4899' }, // 粉色系
};
const DEFAULT_DECO_COLORS = { c1: '#EDE9FE', c2: '#C4B5FD', c3: '#8B5CF6' };

let currentDecoStyle = 0; // 0-3，每次開 modal 時隨機

// 繪製裝飾圖案到指定 canvas
function drawDecoration(mood, canvasId, decoId) {
  const canvas = document.getElementById(canvasId);
  const deco   = document.getElementById(decoId);
  if (!canvas || !deco) return;

  const colors = MOOD_COLORS[mood] || DEFAULT_DECO_COLORS;
  const W = deco.offsetWidth || 360;
  const H = 120;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  switch (currentDecoStyle) {
    case 0: drawStarsHearts(ctx, W, H, colors); break;
    case 1: drawWatercolor(ctx, W, H, colors);  break;
    case 2: drawPolkaDots(ctx, W, H, colors);   break;
    case 3: drawGeometric(ctx, W, H, colors);   break;
  }
}

// 風格一：漂浮星星與愛心
function drawStarsHearts(ctx, W, H, c) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, c.c1);
  bg.addColorStop(1, c.c2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 星星
  const rng = seededRng(currentDecoStyle * 31 + W);
  for (let i = 0; i < 14; i++) {
    drawStar(ctx, rng() * W, rng() * H, 5 + rng() * 9, c.c3, 0.55 + rng() * 0.4);
  }
  // 愛心
  for (let i = 0; i < 8; i++) {
    drawHeart(ctx, rng() * W, rng() * H, 7 + rng() * 8, c.c3, 0.45 + rng() * 0.4);
  }
}

// 風格二：水彩暈染
function drawWatercolor(ctx, W, H, c) {
  ctx.fillStyle = c.c1;
  ctx.fillRect(0, 0, W, H);
  const rng = seededRng(currentDecoStyle * 17 + W);
  for (let i = 0; i < 6; i++) {
    const x  = rng() * W;
    const y  = rng() * H;
    const rx = 50 + rng() * 70;
    const ry = 30 + rng() * 50;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    grad.addColorStop(0, c.c2 + 'aa');
    grad.addColorStop(0.5, c.c3 + '44');
    grad.addColorStop(1, c.c1 + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 風格三：小碎花點點
function drawPolkaDots(ctx, W, H, c) {
  ctx.fillStyle = c.c1;
  ctx.fillRect(0, 0, W, H);
  const rng = seededRng(currentDecoStyle * 53 + W);
  const cols = 14, rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const offsetX = (r % 2 === 0) ? 0 : (W / cols / 2);
      const x = offsetX + (col + 0.5) * (W / cols);
      const y = (r + 0.5) * (H / rows);
      const radius = 3 + rng() * 5;
      const alpha  = 0.25 + rng() * 0.55;
      const hex = Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fillStyle = (rng() > 0.5 ? c.c2 : c.c3) + hex;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 風格四：幾何線條
function drawGeometric(ctx, W, H, c) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, c.c1);
  bg.addColorStop(1, c.c2 + '88');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const rng = seededRng(currentDecoStyle * 97 + W);
  ctx.lineWidth = 1.5;
  // 線段
  for (let i = 0; i < 12; i++) {
    const x1 = rng() * W, y1 = rng() * H;
    const x2 = x1 + (rng() - 0.5) * 140;
    const y2 = y1 + (rng() - 0.5) * 80;
    const alpha = Math.floor((0.2 + rng() * 0.4) * 255).toString(16).padStart(2, '0');
    ctx.strokeStyle = c.c3 + alpha;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // 三角形
  for (let i = 0; i < 6; i++) {
    const cx = rng() * W, cy = rng() * H;
    const s  = 12 + rng() * 20;
    const alpha = Math.floor((0.25 + rng() * 0.35) * 255).toString(16).padStart(2, '0');
    ctx.strokeStyle = c.c2 + alpha;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.866, cy + s * 0.5);
    ctx.lineTo(cx - s * 0.866, cy + s * 0.5);
    ctx.closePath();
    ctx.stroke();
  }
}

// ── 繪圖工具函式 ───────────────────────────────────

// 簡單偽亂數（可重現，讓同一面板每次圖案一致）
function seededRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function drawStar(ctx, x, y, size, color, alpha) {
  const hex = Math.floor(alpha * 255).toString(16).padStart(2, '0');
  ctx.fillStyle = color + hex;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a  = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const ai = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2;
    if (i === 0) ctx.moveTo(x + size * Math.cos(a), y + size * Math.sin(a));
    else         ctx.lineTo(x + size * Math.cos(a), y + size * Math.sin(a));
    ctx.lineTo(x + size * 0.4 * Math.cos(ai), y + size * 0.4 * Math.sin(ai));
  }
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx, x, y, s, color, alpha) {
  const hex = Math.floor(alpha * 255).toString(16).padStart(2, '0');
  ctx.fillStyle = color + hex;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y - s * 0.3, x - s, y - s * 0.3, x - s, y + s * 0.3);
  ctx.bezierCurveTo(x - s, y + s * 0.85, x, y + s * 1.2, x, y + s * 1.5);
  ctx.bezierCurveTo(x, y + s * 1.2, x + s, y + s * 0.85, x + s, y + s * 0.3);
  ctx.bezierCurveTo(x + s, y - s * 0.3, x, y - s * 0.3, x, y + s * 0.3);
  ctx.closePath();
  ctx.fill();
}

// ── Mood Modal ─────────────────────────────────────
function openMoodModal(dateStr) {
  selectedDate = dateStr;
  selectedMood = null;

  // 每次開啟隨機選一種裝飾風格
  currentDecoStyle = Math.floor(Math.random() * 4);

  document.getElementById('modalDate').textContent = formatDisplayDate(dateStr);
  document.getElementById('moodNote').value = '';
  document.querySelectorAll('#moodPicker .mood-btn').forEach(b => b.classList.remove('selected'));

  const existing = moods[dateStr];
  if (existing) {
    selectedMood = existing.emoji;
    document.getElementById('moodNote').value = existing.note || '';
    document.querySelectorAll('#moodPicker .mood-btn').forEach(b => {
      if (b.dataset.mood === existing.emoji) b.classList.add('selected');
    });
  }

  document.getElementById('moodModal').classList.remove('hidden');

  // 畫裝飾（用 requestAnimationFrame 確保尺寸已計算好）
  requestAnimationFrame(() => drawDecoration(selectedMood, 'moodDecoCanvas', 'moodDeco'));
}

function saveMood() {
  if (!selectedMood) {
    const picker = document.getElementById('moodPicker');
    picker.classList.add('error');
    setTimeout(() => picker.classList.remove('error'), 400);
    return;
  }

  const note = document.getElementById('moodNote').value.trim();
  moods[selectedDate] = { emoji: selectedMood, note };
  saveData();
  document.getElementById('moodModal').classList.add('hidden');
  renderCalendar();
}

function deleteMood() {
  if (selectedDate) {
    delete moods[selectedDate];
    saveData();
  }
  document.getElementById('moodModal').classList.add('hidden');
  renderCalendar();
}

// ── 快速新增日記面板 ───────────────────────────────
function openQuickAdd() {
  quickSelectedMood = null;
  currentDecoStyle = Math.floor(Math.random() * 4);

  document.getElementById('quickDate').value = todayStr();
  document.getElementById('quickNote').value = '';
  document.querySelectorAll('#quickMoodPicker .mood-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('quickAddPanel').classList.remove('hidden');

  requestAnimationFrame(() => drawDecoration(null, 'quickDecoCanvas', 'quickDeco'));
}

function saveQuickDiary() {
  if (!quickSelectedMood) {
    const picker = document.getElementById('quickMoodPicker');
    picker.classList.add('error');
    setTimeout(() => picker.classList.remove('error'), 400);
    return;
  }
  const date = document.getElementById('quickDate').value;
  if (!date) return;
  const note = document.getElementById('quickNote').value.trim();
  moods[date] = { emoji: quickSelectedMood, note };
  saveData();
  document.getElementById('quickAddPanel').classList.add('hidden');

  // 若目前月份和日記相同，立即更新
  const [dy, dm] = date.split('-').map(Number);
  if (dy === calDate.getFullYear() && dm === calDate.getMonth() + 1) {
    renderCalendar();
  }
}

// ── Navigation ─────────────────────────────────────
function switchPage(page) {
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const titles = { friends: '朋友列表', diary: '心情日記', settings: '設定' };
  document.getElementById('pageTitle').textContent = titles[page] || '';

  if (page === 'friends') {
    document.getElementById('friendsPage').classList.add('active');
  } else if (page === 'diary') {
    document.getElementById('diaryPage').classList.add('active');
    renderCalendar();
  } else if (page === 'settings') {
    document.getElementById('settingsPage').classList.add('active');
  }

  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  // FAB 只在日記頁顯示
  const fab = document.getElementById('diaryFab');
  if (page === 'diary') {
    fab.classList.remove('hidden');
  } else {
    fab.classList.add('hidden');
  }
}

// ── Event Listeners ────────────────────────────────

// 新增朋友
document.getElementById('addFriendBtn').addEventListener('click', addFriend);

document.getElementById('friendName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('friendDate').focus();
});

document.getElementById('friendDate').addEventListener('keydown', e => {
  if (e.key === 'Enter') addFriend();
});

['friendName', 'friendDate'].forEach(id => {
  document.getElementById(id).addEventListener('input', function () {
    this.classList.remove('error');
  });
});

// 朋友列表事件委派（點卡片開詳情，點刪除按鈕刪除）
document.getElementById('friendsList').addEventListener('click', e => {
  // 若點的是刪除按鈕
  const delBtn = e.target.closest('.delete-btn');
  if (delBtn) {
    e.stopPropagation();
    const id = delBtn.dataset.id;
    const f  = friends.find(x => x.id === id);
    if (f) {
      pendingDeleteId = id;
      document.getElementById('confirmText').textContent =
        `確定要刪除「${f.name}」嗎？\n這個操作無法還原。`;
      document.getElementById('confirmModal').classList.remove('hidden');
    }
    return;
  }
  // 點卡片本體 → 開詳情
  const card = e.target.closest('.friend-card');
  if (card) {
    openFriendDetail(card.dataset.id);
  }
});

// 返回按鈕
document.getElementById('backBtn').addEventListener('click', closeFriendDetail);

// 更換大頭照
document.getElementById('changePhotoBtn').addEventListener('click', () => {
  document.getElementById('photoInput').click();
});

document.getElementById('photoInput').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file || !currentDetailId) return;
  const base64 = await fileToBase64(file);
  const f = friends.find(x => x.id === currentDetailId);
  if (!f) return;
  f.photo = base64;
  saveData();
  // 更新詳情頁大頭照
  const avatarEl = document.getElementById('detailAvatar');
  avatarEl.innerHTML = `<img src="${base64}" alt="${escapeHtml(f.name)}">`;
  this.value = '';
});

// 儲存備註
document.getElementById('saveNoteBtn').addEventListener('click', () => {
  if (!currentDetailId) return;
  const f = friends.find(x => x.id === currentDetailId);
  if (!f) return;
  f.note = document.getElementById('detailNote').value;
  saveData();
  // 短暫視覺回饋
  const btn = document.getElementById('saveNoteBtn');
  btn.textContent = '已儲存 ✓';
  setTimeout(() => { btn.textContent = '儲存備註'; }, 1500);
});

// 新增備註圖片
document.getElementById('addNoteImageBtn').addEventListener('click', () => {
  document.getElementById('noteImageInput').click();
});

document.getElementById('noteImageInput').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file || !currentDetailId) return;
  const base64 = await fileToBase64(file);
  const f = friends.find(x => x.id === currentDetailId);
  if (!f) return;
  if (!f.noteImages) f.noteImages = [];
  f.noteImages.push(base64);
  saveData();
  renderNoteImages(f);
  this.value = '';
});

// 刪除備註圖片（事件委派）
document.getElementById('noteImagesGrid').addEventListener('click', e => {
  const btn = e.target.closest('.note-thumb-del');
  if (!btn || !currentDetailId) return;
  const idx = parseInt(btn.dataset.index, 10);
  const f = friends.find(x => x.id === currentDetailId);
  if (!f || !f.noteImages) return;
  f.noteImages.splice(idx, 1);
  saveData();
  renderNoteImages(f);
});

// Calendar navigation
document.getElementById('prevMonth').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});

// 日曆點選
document.getElementById('calendarDays').addEventListener('click', e => {
  const day = e.target.closest('.calendar-day:not(.empty)');
  if (day) openMoodModal(day.dataset.date);
});

// 心情記錄列表點選
document.getElementById('moodHistory').addEventListener('click', e => {
  const entry = e.target.closest('.mood-entry');
  if (entry) openMoodModal(entry.dataset.date);
});

// 心情按鈕（既有 Modal）
document.querySelectorAll('#moodPicker .mood-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    selectedMood = this.dataset.mood;
    document.querySelectorAll('#moodPicker .mood-btn').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    // 依心情重繪裝飾
    drawDecoration(selectedMood, 'moodDecoCanvas', 'moodDeco');
  });
});

// Mood modal actions
document.getElementById('saveMood').addEventListener('click', saveMood);
document.getElementById('deleteMood').addEventListener('click', deleteMood);
document.getElementById('cancelMood').addEventListener('click', () => {
  document.getElementById('moodModal').classList.add('hidden');
});

// FAB 按鈕
document.getElementById('diaryFab').addEventListener('click', openQuickAdd);

// 快速新增面板心情按鈕
document.querySelectorAll('#quickMoodPicker .mood-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    quickSelectedMood = this.dataset.mood;
    document.querySelectorAll('#quickMoodPicker .mood-btn').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    // 依心情重繪裝飾
    drawDecoration(quickSelectedMood, 'quickDecoCanvas', 'quickDeco');
  });
});

document.getElementById('quickSave').addEventListener('click', saveQuickDiary);
document.getElementById('quickCancel').addEventListener('click', () => {
  document.getElementById('quickAddPanel').classList.add('hidden');
});

// Confirm modal
document.getElementById('confirmYes').addEventListener('click', () => {
  if (pendingDeleteId) {
    friends = friends.filter(f => f.id !== pendingDeleteId);
    pendingDeleteId = null;
    saveData();
    renderFriends();
  }
  document.getElementById('confirmModal').classList.add('hidden');
});
document.getElementById('confirmNo').addEventListener('click', () => {
  pendingDeleteId = null;
  document.getElementById('confirmModal').classList.add('hidden');
});

// 點覆蓋層背景關閉 Modal
['moodModal', 'confirmModal', 'quickAddPanel'].forEach(id => {
  document.getElementById(id).addEventListener('click', function (e) {
    if (e.target === this) this.classList.add('hidden');
  });
});

// Bottom nav
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', function () {
    switchPage(this.dataset.page);
  });
});

// ── 主題選擇事件 ────────────────────────────────────
document.getElementById('themeList').addEventListener('click', e => {
  const btn = e.target.closest('.theme-option');
  if (!btn) return;
  const key = btn.dataset.theme;

  // 自訂主題：顯示顏色選擇器
  const panel = document.getElementById('customThemePanel');
  if (key === 'custom') {
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
    applyTheme(key);
    saveTheme(key);
  }
});

document.getElementById('applyCustomTheme').addEventListener('click', () => {
  const primary = document.getElementById('customPrimary').value;
  const light   = document.getElementById('customLight').value;
  applyTheme('custom', { primary, light });
  saveTheme('custom', { primary, light });
});

// ── Service Worker ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── Init ───────────────────────────────────────────
loadData();
loadTheme();
setDefaultDate();
renderFriends();

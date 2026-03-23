'use strict';

// ── State ──────────────────────────────────────────
let currentPage = 'friends';
let calDate = new Date();
let selectedDate = null;
let selectedMood = null;
let pendingDeleteId = null;

let friends = [];
let moods = {};

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
    return `
      <div class="friend-card">
        <div class="friend-avatar">${escapeHtml(Array.from(f.name)[0])}</div>
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

  friends.unshift({ id: Date.now().toString(36), name, date });
  saveData();
  nameEl.value = '';
  setDefaultDate();
  renderFriends();
  nameEl.focus();
}

function setDefaultDate() {
  document.getElementById('friendDate').value = todayStr();
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
        這個月還沒有心情記錄<br>點選日曆上的日期來新增吧！
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

// ── Mood Modal ─────────────────────────────────────
function openMoodModal(dateStr) {
  selectedDate = dateStr;
  selectedMood = null;

  document.getElementById('modalDate').textContent = formatDisplayDate(dateStr);
  document.getElementById('moodNote').value = '';
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));

  const existing = moods[dateStr];
  if (existing) {
    selectedMood = existing.emoji;
    document.getElementById('moodNote').value = existing.note || '';
    document.querySelectorAll('.mood-btn').forEach(b => {
      if (b.dataset.mood === existing.emoji) b.classList.add('selected');
    });
  }

  document.getElementById('moodModal').classList.remove('hidden');
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

// ── Navigation ─────────────────────────────────────
function switchPage(page) {
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (page === 'friends') {
    document.getElementById('friendsPage').classList.add('active');
    document.getElementById('pageTitle').textContent = '朋友列表';
  } else {
    document.getElementById('diaryPage').classList.add('active');
    document.getElementById('pageTitle').textContent = '心情日記';
    renderCalendar();
  }

  document.querySelector(`[data-page="${page}"]`).classList.add('active');
}

// ── Event Listeners ────────────────────────────────

// Add friend
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

// Delete friend via event delegation
document.getElementById('friendsList').addEventListener('click', e => {
  const btn = e.target.closest('.delete-btn');
  if (!btn) return;
  const id = btn.dataset.id;
  const f  = friends.find(x => x.id === id);
  if (f) {
    pendingDeleteId = id;
    document.getElementById('confirmText').textContent =
      `確定要刪除「${f.name}」嗎？\n這個操作無法還原。`;
    document.getElementById('confirmModal').classList.remove('hidden');
  }
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

// Open mood modal from calendar (event delegation)
document.getElementById('calendarDays').addEventListener('click', e => {
  const day = e.target.closest('.calendar-day:not(.empty)');
  if (day) openMoodModal(day.dataset.date);
});

// Open mood modal from history list (event delegation)
document.getElementById('moodHistory').addEventListener('click', e => {
  const entry = e.target.closest('.mood-entry');
  if (entry) openMoodModal(entry.dataset.date);
});

// Mood buttons
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    selectedMood = this.dataset.mood;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
  });
});

// Mood modal actions
document.getElementById('saveMood').addEventListener('click', saveMood);
document.getElementById('deleteMood').addEventListener('click', deleteMood);
document.getElementById('cancelMood').addEventListener('click', () => {
  document.getElementById('moodModal').classList.add('hidden');
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

// Close modals on overlay click
['moodModal', 'confirmModal'].forEach(id => {
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

// ── Service Worker ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── Init ───────────────────────────────────────────
loadData();
setDefaultDate();
renderFriends();

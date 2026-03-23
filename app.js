'use strict';

// ── State ──────────────────────────────────────────
let currentPage = 'friends';
let calDate = new Date();
let selectedDate = null;
let selectedMood = null;
let quickSelectedMood = null;
let pendingDeleteId = null;
let currentDetailId = null;
let pendingCapsuleDeleteId = null;
let capsulePhotoBase64 = null;
let openingCapsuleId = null;
let healthCollapsed = false;

let friends = [];
let moods = {};
let capsules = [];

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
    friends  = JSON.parse(localStorage.getItem('rt_friends')  || '[]');
    moods    = JSON.parse(localStorage.getItem('rt_moods')    || '{}');
    capsules = JSON.parse(localStorage.getItem('rt_capsules') || '[]');
  } catch {
    friends = []; moods = {}; capsules = [];
  }
}

function saveData() {
  localStorage.setItem('rt_friends',  JSON.stringify(friends));
  localStorage.setItem('rt_moods',    JSON.stringify(moods));
  localStorage.setItem('rt_capsules', JSON.stringify(capsules));
}

// ── Utilities ──────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function daysSince(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m-1, d);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((now - start) / 86400000);
}

function formatDays(days) {
  if (days < 0)   return `倒數 ${-days} 天`;
  if (days === 0) return '今天認識的 🎉';
  if (days < 30)  return `認識 ${days} 天`;
  if (days < 365) {
    const m = Math.floor(days/30), d = days%30;
    return d > 0 ? `認識 ${m} 個月 ${d} 天` : `認識 ${m} 個月`;
  }
  const y = Math.floor(days/365), rem = days - y*365, m = Math.floor(rem/30);
  return m > 0 ? `認識 ${y} 年 ${m} 個月` : `認識 ${y} 年`;
}

function formatDisplayDate(dateStr) {
  const DAY = ['日','一','二','三','四','五','六'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m-1, d).getDay();
  return `${y} 年 ${m} 月 ${d} 日（${DAY[dow]}）`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 生日工具 ───────────────────────────────────────

// birthday 格式：'MM-DD'
function daysUntilBirthday(mmdd) {
  if (!mmdd) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const [m, d] = mmdd.split('-').map(Number);
  let next = new Date(today.getFullYear(), m-1, d); next.setHours(0,0,0,0);
  if (next < today) next = new Date(today.getFullYear()+1, m-1, d);
  return Math.round((next - today) / 86400000);
}

function isBirthdayToday(mmdd) {
  if (!mmdd) return false;
  const today = new Date();
  return mmdd === `${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
}

function isBirthdayThisMonth(mmdd) {
  if (!mmdd) return false;
  const today = new Date();
  return mmdd.startsWith(`${pad(today.getMonth()+1)}-`);
}

// ── 健康度 ─────────────────────────────────────────

// 檢查日記備註中是否出現朋友名字（最近 N 天）
function hasDiaryMention(name, days) {
  const today = new Date(); today.setHours(0,0,0,0);
  return Object.entries(moods).some(([ds, data]) => {
    const d = new Date(ds); d.setHours(0,0,0,0);
    const diff = (today - d) / 86400000;
    return diff >= 0 && diff <= days && data.note && data.note.includes(name);
  });
}

function calcHealth(f) {
  let score = 50;
  if (f.note && f.note.trim()) score += 10;
  if (f.photo) score += 5;
  if (f.birthday) score += 5;
  const inLast7  = hasDiaryMention(f.name, 7);
  const inLast30 = hasDiaryMention(f.name, 30);
  if (inLast7)       score += 20;
  else if (inLast30) score += 10;
  if (!inLast30 && daysSince(f.date) > 30) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function healthInfo(score) {
  if (score >= 80) return { emoji: '🔥', label: '熱絡',    cls: 'health-hot',  color: '#EF4444' };
  if (score >= 60) return { emoji: '💚', label: '穩定',    cls: 'health-good', color: '#10B981' };
  if (score >= 40) return { emoji: '🌙', label: '需要關心', cls: 'health-warn', color: '#F59E0B' };
  return             { emoji: '❄️', label: '漸漸淡出', cls: 'health-cold', color: '#94A3B8' };
}

function renderHealthDashboard() {
  if (friends.length === 0) {
    document.getElementById('healthDashboard').style.display = 'none';
    return;
  }
  document.getElementById('healthDashboard').style.display = '';

  const counts = { hot: 0, good: 0, warn: 0, cold: 0 };
  friends.forEach(f => {
    const h = healthInfo(calcHealth(f));
    if (h.cls === 'health-hot')  counts.hot++;
    else if (h.cls === 'health-good') counts.good++;
    else if (h.cls === 'health-warn') counts.warn++;
    else counts.cold++;
  });

  const statsEl = document.getElementById('healthStats');
  statsEl.innerHTML = `
    <div class="health-summary">共 ${friends.length} 位朋友的關係健康報告</div>
    ${counts.hot  ? `<span class="health-stat-chip"><span class="health-dot health-hot" style="position:static;width:10px;height:10px;display:inline-block;border-radius:50%;"></span>🔥 熱絡 ${counts.hot}</span>` : ''}
    ${counts.good ? `<span class="health-stat-chip"><span class="health-dot health-good" style="position:static;width:10px;height:10px;display:inline-block;border-radius:50%;"></span>💚 穩定 ${counts.good}</span>` : ''}
    ${counts.warn ? `<span class="health-stat-chip"><span class="health-dot health-warn" style="position:static;width:10px;height:10px;display:inline-block;border-radius:50%;"></span>🌙 需要關心 ${counts.warn}</span>` : ''}
    ${counts.cold ? `<span class="health-stat-chip"><span class="health-dot health-cold" style="position:static;width:10px;height:10px;display:inline-block;border-radius:50%;"></span>❄️ 漸漸淡出 ${counts.cold}</span>` : ''}
  `;

  // 套用收合狀態
  const bodyEl = document.getElementById('healthBody');
  const iconEl = document.getElementById('healthToggleIcon');
  if (healthCollapsed) {
    bodyEl.classList.add('collapsed');
    iconEl.classList.add('collapsed');
  } else {
    bodyEl.classList.remove('collapsed');
    iconEl.classList.remove('collapsed');
  }
}

// ── 即將生日 ───────────────────────────────────────
function renderUpcomingBirthdays() {
  const upcoming = friends.filter(f => {
    if (!f.birthday) return false;
    const d = daysUntilBirthday(f.birthday);
    return d !== null && d <= 30;
  }).sort((a, b) => daysUntilBirthday(a.birthday) - daysUntilBirthday(b.birthday));

  const el = document.getElementById('upcomingBirthdays');
  if (upcoming.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="upcoming-birthday-card">
      <div class="upcoming-birthday-title">🎂 即將生日（30天內）</div>
      ${upcoming.map(f => {
        const days = daysUntilBirthday(f.birthday);
        const isToday = days === 0;
        return `
          <div class="birthday-friend-row">
            <span>${escapeHtml(Array.from(f.name)[0])}</span>
            <span class="birthday-friend-name">${escapeHtml(f.name)}</span>
            ${isToday
              ? '<span class="birthday-today-tag">🎂 今天！</span>'
              : `<span class="birthday-countdown">${days} 天後</span>`}
          </div>`;
      }).join('')}
    </div>`;
}

// ── Friends Page ───────────────────────────────────
function renderFriends() {
  renderHealthDashboard();
  renderUpcomingBirthdays();

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
    const avatarInner = f.photo
      ? `<img src="${f.photo}" alt="${escapeHtml(f.name)}">`
      : escapeHtml(Array.from(f.name)[0]);

    const isToday = f.birthday && isBirthdayToday(f.birthday);
    const thisMonth = f.birthday && isBirthdayThisMonth(f.birthday);
    const bdDays = f.birthday ? daysUntilBirthday(f.birthday) : null;

    const score = calcHealth(f);
    const hi = healthInfo(score);

    let bdHtml = '';
    if (isToday) {
      bdHtml = `<div class="friend-birthday-tag" style="color:#DB2777;font-size:12px;font-weight:700;">🎂 今天生日！</div>`;
    } else if (bdDays !== null && bdDays <= 30) {
      bdHtml = `<div class="friend-birthday-tag" style="color:${thisMonth ? '#DB2777' : 'var(--text-2)'};font-size:12px;">${thisMonth ? '🌸' : '🎂'} 生日還有 ${bdDays} 天</div>`;
    }

    return `
      <div class="friend-card${isToday ? ' is-birthday' : ''}" data-id="${escapeHtml(f.id)}">
        <div class="health-dot ${hi.cls}"></div>
        <div class="friend-avatar">${avatarInner}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(f.name)}${isToday ? ' 🎂' : ''}</div>
          <div class="friend-days">${formatDays(days)}</div>
          <div class="friend-since">從 ${f.date} 開始</div>
          ${bdHtml}
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
  friends.unshift({ id: Date.now().toString(36), name, date, photo: null, note: '', noteImages: [], birthday: null });
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

  const avatarEl = document.getElementById('detailAvatar');
  if (f.photo) avatarEl.innerHTML = `<img src="${f.photo}" alt="${escapeHtml(f.name)}">`;
  else         avatarEl.textContent = Array.from(f.name)[0];

  document.getElementById('detailName').textContent = f.name;
  document.getElementById('detailDays').textContent = formatDays(daysSince(f.date));
  document.getElementById('detailSince').textContent = `從 ${f.date} 開始`;
  document.getElementById('detailNote').value = f.note || '';

  // 生日
  populateBirthdayDays();
  if (f.birthday) {
    const [mm, dd] = f.birthday.split('-');
    document.getElementById('birthdayMonth').value = mm;
    populateBirthdayDays(mm);
    document.getElementById('birthdayDay').value = dd;
    updateBirthdayInfo(f.birthday);
  } else {
    document.getElementById('birthdayMonth').value = '';
    document.getElementById('birthdayDay').innerHTML = '<option value="">日期</option>';
    document.getElementById('birthdayInfo').textContent = '';
  }

  renderNoteImages(f);
  document.getElementById('friendDetailPage').classList.remove('hidden');
}

function populateBirthdayDays(month) {
  const dayEl = document.getElementById('birthdayDay');
  const days = month ? new Date(2000, Number(month), 0).getDate() : 31;
  dayEl.innerHTML = '<option value="">日期</option>' +
    Array.from({length: days}, (_, i) => {
      const v = pad(i+1);
      return `<option value="${v}">${i+1}日</option>`;
    }).join('');
}

function updateBirthdayInfo(mmdd) {
  const el = document.getElementById('birthdayInfo');
  if (!mmdd) { el.textContent = ''; return; }
  const d = daysUntilBirthday(mmdd);
  if (d === 0) el.textContent = '🎂 今天就是生日！';
  else el.textContent = `🎂 距離下次生日還有 ${d} 天`;
}

function closeFriendDetail() {
  document.getElementById('friendDetailPage').classList.add('hidden');
  currentDetailId = null;
  renderFriends();
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
      <img class="note-thumb" src="${src}" alt="備註圖片 ${i+1}">
      <button class="note-thumb-del" data-index="${i}" aria-label="刪除圖片">✕</button>
    </div>`).join('');
}

// ── Calendar ───────────────────────────────────────
function renderCalendar() {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  document.getElementById('monthYear').textContent = `${y} 年 ${m+1} 月`;
  const firstDow = new Date(y, m, 1).getDay();
  const lastDay  = new Date(y, m+1, 0).getDate();
  const today    = todayStr();
  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="calendar-day empty"></div>';
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${y}-${pad(m+1)}-${pad(d)}`;
    const mood = moods[ds];
    const cls = ['calendar-day', ds===today?'today':'', mood?'has-mood':''].join(' ').trim();
    html += `<div class="${cls}" data-date="${ds}">
      <span class="day-num">${d}</span>
      ${mood ? `<span class="day-mood">${mood.emoji}</span>` : ''}
    </div>`;
  }
  document.getElementById('calendarDays').innerHTML = html;
  renderMoodHistory(y, m);
}

function renderMoodHistory(y, m) {
  const entries = Object.entries(moods)
    .filter(([ds]) => { const [ey,em] = ds.split('-').map(Number); return ey===y && em===m+1; })
    .sort(([a],[b]) => b.localeCompare(a));
  const el = document.getElementById('moodHistory');
  if (entries.length === 0) {
    el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📭</span>這個月還沒有心情記錄<br>點選日曆上的日期或右下角 ＋ 來新增！</div>`;
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
const MOOD_COLORS = {
  '😊': { c1:'#FEF3C7', c2:'#FCD34D', c3:'#F59E0B' },
  '😢': { c1:'#DBEAFE', c2:'#93C5FD', c3:'#3B82F6' },
  '😡': { c1:'#FEE2E2', c2:'#FCA5A5', c3:'#EF4444' },
  '😴': { c1:'#EDE9FE', c2:'#C4B5FD', c3:'#8B5CF6' },
  '😍': { c1:'#FCE7F3', c2:'#F9A8D4', c3:'#EC4899' },
};
const DEFAULT_DECO_COLORS = { c1:'#EDE9FE', c2:'#C4B5FD', c3:'#8B5CF6' };
let currentDecoStyle = 0;

function drawDecoration(mood, canvasId, decoId) {
  const canvas = document.getElementById(canvasId);
  const deco   = document.getElementById(decoId);
  if (!canvas || !deco) return;
  const colors = MOOD_COLORS[mood] || DEFAULT_DECO_COLORS;
  const W = deco.offsetWidth || 360, H = 120;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  switch (currentDecoStyle) {
    case 0: drawStarsHearts(ctx, W, H, colors); break;
    case 1: drawWatercolor(ctx, W, H, colors);  break;
    case 2: drawPolkaDots(ctx, W, H, colors);   break;
    case 3: drawGeometric(ctx, W, H, colors);   break;
  }
}

function drawStarsHearts(ctx, W, H, c) {
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0, c.c1); bg.addColorStop(1, c.c2);
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
  const rng = seededRng(currentDecoStyle*31+W);
  for (let i=0;i<14;i++) drawStar(ctx,rng()*W,rng()*H,5+rng()*9,c.c3,0.55+rng()*0.4);
  for (let i=0;i<8;i++)  drawHeart(ctx,rng()*W,rng()*H,7+rng()*8,c.c3,0.45+rng()*0.4);
}

function drawWatercolor(ctx, W, H, c) {
  ctx.fillStyle = c.c1; ctx.fillRect(0,0,W,H);
  const rng = seededRng(currentDecoStyle*17+W);
  for (let i=0;i<6;i++) {
    const x=rng()*W, y=rng()*H, rx=50+rng()*70, ry=30+rng()*50;
    const grad = ctx.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));
    grad.addColorStop(0, c.c2+'aa'); grad.addColorStop(0.5, c.c3+'44'); grad.addColorStop(1, c.c1+'00');
    ctx.fillStyle = grad; ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,rng()*Math.PI,0,Math.PI*2); ctx.fill();
  }
}

function drawPolkaDots(ctx, W, H, c) {
  ctx.fillStyle = c.c1; ctx.fillRect(0,0,W,H);
  const rng = seededRng(currentDecoStyle*53+W);
  const cols=14, rows=5;
  for (let r=0;r<rows;r++) for (let col=0;col<cols;col++) {
    const ox = (r%2===0)?0:(W/cols/2);
    const x = ox+(col+0.5)*(W/cols), y=(r+0.5)*(H/rows);
    const radius=3+rng()*5, alpha=0.25+rng()*0.55;
    const hex=Math.floor(alpha*255).toString(16).padStart(2,'0');
    ctx.fillStyle=(rng()>0.5?c.c2:c.c3)+hex;
    ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
  }
}

function drawGeometric(ctx, W, H, c) {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,c.c1); bg.addColorStop(1,c.c2+'88');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const rng=seededRng(currentDecoStyle*97+W); ctx.lineWidth=1.5;
  for (let i=0;i<12;i++) {
    const x1=rng()*W,y1=rng()*H,x2=x1+(rng()-0.5)*140,y2=y1+(rng()-0.5)*80;
    const a=Math.floor((0.2+rng()*0.4)*255).toString(16).padStart(2,'0');
    ctx.strokeStyle=c.c3+a; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
  for (let i=0;i<6;i++) {
    const cx=rng()*W,cy=rng()*H,s=12+rng()*20;
    const a=Math.floor((0.25+rng()*0.35)*255).toString(16).padStart(2,'0');
    ctx.strokeStyle=c.c2+a; ctx.beginPath();
    ctx.moveTo(cx,cy-s); ctx.lineTo(cx+s*0.866,cy+s*0.5); ctx.lineTo(cx-s*0.866,cy+s*0.5);
    ctx.closePath(); ctx.stroke();
  }
}

function seededRng(seed) {
  let s = seed|0;
  return function() { s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/0xffffffff; };
}

function drawStar(ctx, x, y, size, color, alpha) {
  const hex=Math.floor(alpha*255).toString(16).padStart(2,'0');
  ctx.fillStyle=color+hex; ctx.beginPath();
  for (let i=0;i<5;i++) {
    const a=(i*4*Math.PI)/5-Math.PI/2, ai=((i*4+2)*Math.PI)/5-Math.PI/2;
    if(i===0) ctx.moveTo(x+size*Math.cos(a),y+size*Math.sin(a));
    else      ctx.lineTo(x+size*Math.cos(a),y+size*Math.sin(a));
    ctx.lineTo(x+size*0.4*Math.cos(ai),y+size*0.4*Math.sin(ai));
  }
  ctx.closePath(); ctx.fill();
}

function drawHeart(ctx, x, y, s, color, alpha) {
  const hex=Math.floor(alpha*255).toString(16).padStart(2,'0');
  ctx.fillStyle=color+hex; ctx.beginPath();
  ctx.moveTo(x,y+s*0.3);
  ctx.bezierCurveTo(x,y-s*0.3,x-s,y-s*0.3,x-s,y+s*0.3);
  ctx.bezierCurveTo(x-s,y+s*0.85,x,y+s*1.2,x,y+s*1.5);
  ctx.bezierCurveTo(x,y+s*1.2,x+s,y+s*0.85,x+s,y+s*0.3);
  ctx.bezierCurveTo(x+s,y-s*0.3,x,y-s*0.3,x,y+s*0.3);
  ctx.closePath(); ctx.fill();
}

// ── Mood Modal ─────────────────────────────────────
function openMoodModal(dateStr) {
  selectedDate = dateStr; selectedMood = null;
  currentDecoStyle = Math.floor(Math.random()*4);
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
  requestAnimationFrame(() => drawDecoration(selectedMood, 'moodDecoCanvas', 'moodDeco'));
}

function saveMood() {
  if (!selectedMood) {
    const picker = document.getElementById('moodPicker');
    picker.classList.add('error'); setTimeout(() => picker.classList.remove('error'), 400); return;
  }
  moods[selectedDate] = { emoji: selectedMood, note: document.getElementById('moodNote').value.trim() };
  saveData(); document.getElementById('moodModal').classList.add('hidden'); renderCalendar();
}

function deleteMood() {
  if (selectedDate) { delete moods[selectedDate]; saveData(); }
  document.getElementById('moodModal').classList.add('hidden'); renderCalendar();
}

// ── 快速新增日記 ────────────────────────────────────
function openQuickAdd() {
  quickSelectedMood = null; currentDecoStyle = Math.floor(Math.random()*4);
  document.getElementById('quickDate').value = todayStr();
  document.getElementById('quickNote').value = '';
  document.querySelectorAll('#quickMoodPicker .mood-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('quickAddPanel').classList.remove('hidden');
  requestAnimationFrame(() => drawDecoration(null, 'quickDecoCanvas', 'quickDeco'));
}

function saveQuickDiary() {
  if (!quickSelectedMood) {
    const picker = document.getElementById('quickMoodPicker');
    picker.classList.add('error'); setTimeout(() => picker.classList.remove('error'), 400); return;
  }
  const date = document.getElementById('quickDate').value;
  if (!date) return;
  moods[date] = { emoji: quickSelectedMood, note: document.getElementById('quickNote').value.trim() };
  saveData(); document.getElementById('quickAddPanel').classList.add('hidden');
  const [dy, dm] = date.split('-').map(Number);
  if (dy===calDate.getFullYear() && dm===calDate.getMonth()+1) renderCalendar();
}

// ── 回憶膠囊 ───────────────────────────────────────
function isCapsuleUnlocked(c) {
  const today = new Date(); today.setHours(0,0,0,0);
  const unlock = new Date(c.unlockDate); unlock.setHours(0,0,0,0);
  return today >= unlock;
}

function daysUntilUnlock(c) {
  const today = new Date(); today.setHours(0,0,0,0);
  const unlock = new Date(c.unlockDate); unlock.setHours(0,0,0,0);
  return Math.ceil((unlock - today) / 86400000);
}

function renderCapsules() {
  const el = document.getElementById('capsuleList');
  if (capsules.length === 0) {
    el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📦</span>還沒有回憶膠囊<br>點右下角 ＋ 封存一段記憶吧！</div>`;
    return;
  }
  const locked   = capsules.filter(c => !isCapsuleUnlocked(c)).sort((a,b)=>daysUntilUnlock(a)-daysUntilUnlock(b));
  const unlocked = capsules.filter(c =>  isCapsuleUnlocked(c)).sort((a,b)=>b.unlockDate.localeCompare(a.unlockDate));
  let html = '';
  if (locked.length) {
    html += `<div class="capsule-section-title">🔒 未開啟（${locked.length}）</div>`;
    html += locked.map(c => renderCapsuleCard(c, false)).join('');
  }
  if (unlocked.length) {
    html += `<div class="capsule-section-title">📬 已開啟（${unlocked.length}）</div>`;
    html += unlocked.map(c => renderCapsuleCard(c, true)).join('');
  }
  el.innerHTML = html;
}

function renderCapsuleCard(c, unlocked) {
  const friend = c.friendId ? friends.find(f => f.id === c.friendId) : null;
  if (unlocked) {
    return `<div class="capsule-card capsule-unlocked" data-id="${escapeHtml(c.id)}">
      <div class="capsule-envelope">📬</div>
      <div class="capsule-info">
        <div class="capsule-title">${escapeHtml(c.title)}</div>
        <div class="capsule-date-text">開啟日：${c.unlockDate}</div>
        ${friend ? `<span class="capsule-friend-tag">👤 ${escapeHtml(friend.name)}</span>` : ''}
      </div>
    </div>`;
  } else {
    const days = daysUntilUnlock(c);
    return `<div class="capsule-card capsule-locked" data-id="${escapeHtml(c.id)}">
      <div class="capsule-envelope">📦</div>
      <div class="capsule-info">
        <div class="capsule-title capsule-title-blur">${escapeHtml(c.title)}</div>
        <div class="capsule-countdown">🔒 ${days} 天後開啟</div>
        ${friend ? `<span class="capsule-friend-tag">👤 ${escapeHtml(friend.name)}</span>` : ''}
      </div>
    </div>`;
  }
}

function openCapsuleDetail(id) {
  const c = capsules.find(x => x.id === id);
  if (!c) return;
  if (!isCapsuleUnlocked(c)) return; // 未到期不能開
  openingCapsuleId = id;
  const friend = c.friendId ? friends.find(f => f.id === c.friendId) : null;
  document.getElementById('capsuleDetailTitle').textContent = c.title;
  document.getElementById('capsuleDetailBody').innerHTML = `
    <div class="capsule-detail-text">${escapeHtml(c.content)}</div>
    ${c.photo ? `<div class="capsule-detail-photo"><img src="${c.photo}" alt="膠囊照片"></div>` : ''}
    <div class="capsule-detail-meta">
      📅 封存日：${c.createdAt}<br>
      🔓 開啟日：${c.unlockDate}
      ${friend ? `<br>👤 給 ${escapeHtml(friend.name)} 的膠囊` : ''}
    </div>`;

  // 設定裝飾顏色（依關聯朋友或預設）
  const decoArea = document.getElementById('capsuleDecoArea');
  const colors = ['#EDE9FE,#C4B5FD','#FEF3C7,#FCD34D','#FCE7F3,#F9A8D4','#D1FAE5,#34D399'];
  const ci = Math.floor(Math.random()*4);
  const [ca, cb] = colors[ci].split(',');
  decoArea.style.background = `linear-gradient(135deg,${ca},${cb})`;
  decoArea.innerHTML = `<div class="deco-handle"></div><div style="font-size:56px;position:absolute;bottom:10px;right:20px">📬</div>`;

  document.getElementById('capsuleDetailModal').classList.remove('hidden');
}

function openAddCapsuleModal() {
  capsulePhotoBase64 = null;
  document.getElementById('capsuleTitle').value = '';
  document.getElementById('capsuleContent').value = '';
  document.getElementById('capsulePhotoPreview').innerHTML = '';
  document.getElementById('capsuleUnlockDate').value = '';
  document.getElementById('capsuleUnlockDate').min = todayStr();
  // 填入朋友選項
  const sel = document.getElementById('capsuleFriendSelect');
  sel.innerHTML = '<option value="">不關聯特定朋友</option>' +
    friends.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('');
  document.getElementById('capsuleModal').classList.remove('hidden');
}

function saveCapsule() {
  const title = document.getElementById('capsuleTitle').value.trim();
  const content = document.getElementById('capsuleContent').value.trim();
  const unlockDate = document.getElementById('capsuleUnlockDate').value;
  const friendId = document.getElementById('capsuleFriendSelect').value || null;
  const titleEl = document.getElementById('capsuleTitle');
  const dateEl  = document.getElementById('capsuleUnlockDate');
  let valid = true;
  if (!title) { titleEl.classList.add('error'); valid = false; }
  if (!unlockDate || unlockDate <= todayStr()) { dateEl.classList.add('error'); valid = false; }
  if (!valid) return;
  capsules.unshift({
    id: Date.now().toString(36), title, content,
    photo: capsulePhotoBase64, unlockDate, friendId,
    createdAt: todayStr()
  });
  saveData();
  document.getElementById('capsuleModal').classList.add('hidden');
  renderCapsules();
}

// ── 生日彩帶 ───────────────────────────────────────
function launchConfetti() {
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  const colors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6BFF','#FF9F43','#A29BFE','#FD79A8'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random()*100 + '%';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.width  = (6+Math.random()*10) + 'px';
    piece.style.height = (10+Math.random()*14) + 'px';
    piece.style.borderRadius = Math.random()>0.5 ? '50%' : '2px';
    piece.style.animationDuration = (2+Math.random()*3) + 's';
    piece.style.animationDelay    = (Math.random()*1.5) + 's';
    piece.style.transform = `rotate(${Math.random()*360}deg)`;
    container.appendChild(piece);
  }
}

function checkBirthdayCelebration() {
  const birthdayFriends = friends.filter(f => f.birthday && isBirthdayToday(f.birthday));
  if (birthdayFriends.length === 0) return;
  const names = birthdayFriends.map(f => f.name).join('、');
  document.getElementById('birthdayText').innerHTML = `今天是<br><strong>${escapeHtml(names)}</strong><br>的生日！🎉`;
  document.getElementById('birthdayOverlay').classList.remove('hidden');
  launchConfetti();
}

// ── Navigation ─────────────────────────────────────
function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const titles = { friends:'朋友列表', diary:'心情日記', capsule:'回憶膠囊', settings:'設定' };
  document.getElementById('pageTitle').textContent = titles[page] || '';
  if (page === 'friends') {
    document.getElementById('friendsPage').classList.add('active');
    renderFriends();
  } else if (page === 'diary') {
    document.getElementById('diaryPage').classList.add('active');
    renderCalendar();
  } else if (page === 'capsule') {
    document.getElementById('capsulePage').classList.add('active');
    renderCapsules();
  } else if (page === 'settings') {
    document.getElementById('settingsPage').classList.add('active');
  }
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  // FAB 顯示邏輯
  document.getElementById('diaryFab').classList.toggle('hidden',   page !== 'diary');
  document.getElementById('capsuleFab').classList.toggle('hidden', page !== 'capsule');
}

// ── 主題系統 ────────────────────────────────────────
function applyTheme(themeKey, customColors) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  let t;
  if (themeKey === 'custom' && customColors) t = buildCustomTheme(customColors.primary, customColors.light);
  else if (THEMES[themeKey]) { t = THEMES[themeKey]; if (themeKey==='dark') root.setAttribute('data-theme','dark'); }
  else t = THEMES.purple;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-light', t.light);
  root.style.setProperty('--primary-pale', t.pale);
  root.style.setProperty('--grad', `linear-gradient(135deg, ${t.grad1} 0%, ${t.grad2} 100%)`);
  root.style.setProperty('--bg', t.bg); root.style.setProperty('--card', t.card);
  root.style.setProperty('--text', t.text); root.style.setProperty('--text-2', t.text2);
  root.style.setProperty('--border', t.border);
  document.getElementById('themeColorMeta').setAttribute('content', t.themeColor||t.primary);
  if (themeKey==='custom' && customColors) {
    document.getElementById('customSwatch').style.background = `linear-gradient(135deg, ${customColors.primary}, ${customColors.light})`;
    document.getElementById('customSwatch').textContent = '';
  }
  document.querySelectorAll('.theme-check').forEach(el => el.textContent = '');
  const checkEl = document.getElementById(`check-${themeKey}`);
  if (checkEl) checkEl.textContent = '✓';
  document.querySelectorAll('.theme-option').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-theme="${themeKey}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

function buildCustomTheme(primary, light) {
  return {
    primary, light, pale: hexWithAlpha(primary,0.12), grad1: primary, grad2: light,
    bg: hexWithAlpha(primary,0.05), card: '#ffffff', text: '#1E1B2E', text2: '#6B7280',
    border: hexWithAlpha(primary,0.20), themeColor: primary
  };
}

function hexWithAlpha(hex, alpha) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function loadTheme() {
  const saved = JSON.parse(localStorage.getItem('rt_theme')||'{"key":"purple"}');
  applyTheme(saved.key, saved.custom);
  if (saved.key==='custom' && saved.custom) {
    document.getElementById('customPrimary').value = saved.custom.primary;
    document.getElementById('customLight').value   = saved.custom.light;
    document.getElementById('customThemePanel').classList.remove('hidden');
  }
}

function saveTheme(key, custom) {
  localStorage.setItem('rt_theme', JSON.stringify({key, custom: custom||null}));
}

// ── Event Listeners ────────────────────────────────

document.getElementById('addFriendBtn').addEventListener('click', addFriend);
document.getElementById('friendName').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('friendDate').focus(); });
document.getElementById('friendDate').addEventListener('keydown', e => { if(e.key==='Enter') addFriend(); });
['friendName','friendDate'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() { this.classList.remove('error'); });
});

// 朋友列表事件委派
document.getElementById('friendsList').addEventListener('click', e => {
  const delBtn = e.target.closest('.delete-btn');
  if (delBtn) {
    e.stopPropagation();
    const id = delBtn.dataset.id;
    const f  = friends.find(x => x.id===id);
    if (f) {
      pendingDeleteId = id;
      document.getElementById('confirmText').textContent = `確定要刪除「${f.name}」嗎？\n這個操作無法還原。`;
      document.getElementById('confirmModal').classList.remove('hidden');
    }
    return;
  }
  const card = e.target.closest('.friend-card');
  if (card) openFriendDetail(card.dataset.id);
});

// 詳情頁
document.getElementById('backBtn').addEventListener('click', closeFriendDetail);

document.getElementById('changePhotoBtn').addEventListener('click', () => {
  document.getElementById('photoInput').click();
});

document.getElementById('photoInput').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file || !currentDetailId) return;
  const base64 = await fileToBase64(file);
  const f = friends.find(x => x.id===currentDetailId);
  if (!f) return;
  f.photo = base64; saveData();
  const avatarEl = document.getElementById('detailAvatar');
  avatarEl.innerHTML = `<img src="${base64}" alt="${escapeHtml(f.name)}">`;
  this.value = '';
});

document.getElementById('saveNoteBtn').addEventListener('click', () => {
  if (!currentDetailId) return;
  const f = friends.find(x => x.id===currentDetailId);
  if (!f) return;
  f.note = document.getElementById('detailNote').value;
  saveData();
  const btn = document.getElementById('saveNoteBtn');
  btn.textContent = '已儲存 ✓';
  setTimeout(() => { btn.textContent = '儲存備註'; }, 1500);
});

document.getElementById('addNoteImageBtn').addEventListener('click', () => {
  document.getElementById('noteImageInput').click();
});

document.getElementById('noteImageInput').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file || !currentDetailId) return;
  const base64 = await fileToBase64(file);
  const f = friends.find(x => x.id===currentDetailId);
  if (!f) return;
  if (!f.noteImages) f.noteImages = [];
  f.noteImages.push(base64);
  saveData(); renderNoteImages(f); this.value = '';
});

document.getElementById('noteImagesGrid').addEventListener('click', e => {
  const btn = e.target.closest('.note-thumb-del');
  if (!btn || !currentDetailId) return;
  const idx = parseInt(btn.dataset.index, 10);
  const f = friends.find(x => x.id===currentDetailId);
  if (!f || !f.noteImages) return;
  f.noteImages.splice(idx, 1);
  saveData(); renderNoteImages(f);
});

// 生日選擇
document.getElementById('birthdayMonth').addEventListener('change', function() {
  populateBirthdayDays(this.value);
  document.getElementById('birthdayDay').value = '';
  document.getElementById('birthdayInfo').textContent = '';
});

document.getElementById('saveBirthdayBtn').addEventListener('click', () => {
  if (!currentDetailId) return;
  const mm = document.getElementById('birthdayMonth').value;
  const dd = document.getElementById('birthdayDay').value;
  const f = friends.find(x => x.id===currentDetailId);
  if (!f) return;
  if (mm && dd) {
    f.birthday = `${mm}-${dd}`;
    updateBirthdayInfo(f.birthday);
  } else {
    f.birthday = null;
    document.getElementById('birthdayInfo').textContent = '';
  }
  saveData();
  const btn = document.getElementById('saveBirthdayBtn');
  btn.textContent = '已儲存 ✓';
  setTimeout(() => { btn.textContent = '儲存'; }, 1500);
});

// 健康度收合
document.getElementById('healthToggle').addEventListener('click', () => {
  healthCollapsed = !healthCollapsed;
  const bodyEl = document.getElementById('healthBody');
  const iconEl = document.getElementById('healthToggleIcon');
  bodyEl.classList.toggle('collapsed', healthCollapsed);
  iconEl.classList.toggle('collapsed', healthCollapsed);
});

// Calendar navigation
document.getElementById('prevMonth').addEventListener('click', () => { calDate.setMonth(calDate.getMonth()-1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { calDate.setMonth(calDate.getMonth()+1); renderCalendar(); });

document.getElementById('calendarDays').addEventListener('click', e => {
  const day = e.target.closest('.calendar-day:not(.empty)');
  if (day) openMoodModal(day.dataset.date);
});

document.getElementById('moodHistory').addEventListener('click', e => {
  const entry = e.target.closest('.mood-entry');
  if (entry) openMoodModal(entry.dataset.date);
});

document.querySelectorAll('#moodPicker .mood-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    selectedMood = this.dataset.mood;
    document.querySelectorAll('#moodPicker .mood-btn').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    drawDecoration(selectedMood, 'moodDecoCanvas', 'moodDeco');
  });
});

document.getElementById('saveMood').addEventListener('click', saveMood);
document.getElementById('deleteMood').addEventListener('click', deleteMood);
document.getElementById('cancelMood').addEventListener('click', () => { document.getElementById('moodModal').classList.add('hidden'); });

document.getElementById('diaryFab').addEventListener('click', openQuickAdd);

document.querySelectorAll('#quickMoodPicker .mood-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    quickSelectedMood = this.dataset.mood;
    document.querySelectorAll('#quickMoodPicker .mood-btn').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    drawDecoration(quickSelectedMood, 'quickDecoCanvas', 'quickDeco');
  });
});

document.getElementById('quickSave').addEventListener('click', saveQuickDiary);
document.getElementById('quickCancel').addEventListener('click', () => { document.getElementById('quickAddPanel').classList.add('hidden'); });

// 膠囊相關
document.getElementById('capsuleFab').addEventListener('click', openAddCapsuleModal);

document.getElementById('capsuleList').addEventListener('click', e => {
  const card = e.target.closest('.capsule-card');
  if (!card) return;
  const id = card.dataset.id;
  const c = capsules.find(x => x.id===id);
  if (!c) return;
  if (isCapsuleUnlocked(c)) openCapsuleDetail(id);
  // 未到期不做任何事（鎖住）
});

document.getElementById('saveCapsule').addEventListener('click', saveCapsule);
document.getElementById('cancelCapsule').addEventListener('click', () => { document.getElementById('capsuleModal').classList.add('hidden'); });

document.getElementById('capsulePhotoBtn').addEventListener('click', () => { document.getElementById('capsulePhotoInput').click(); });

document.getElementById('capsulePhotoInput').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  capsulePhotoBase64 = await fileToBase64(file);
  document.getElementById('capsulePhotoPreview').innerHTML = `<img src="${capsulePhotoBase64}" alt="預覽">`;
  this.value = '';
});

document.getElementById('deleteCapsule').addEventListener('click', () => {
  if (!openingCapsuleId) return;
  capsules = capsules.filter(c => c.id !== openingCapsuleId);
  saveData(); renderCapsules();
  document.getElementById('capsuleDetailModal').classList.add('hidden');
  openingCapsuleId = null;
});

document.getElementById('closeCapsuleDetail').addEventListener('click', () => {
  document.getElementById('capsuleDetailModal').classList.add('hidden');
  openingCapsuleId = null;
});

// Confirm delete friend
document.getElementById('confirmYes').addEventListener('click', () => {
  if (pendingDeleteId) {
    friends = friends.filter(f => f.id !== pendingDeleteId);
    pendingDeleteId = null; saveData(); renderFriends();
  }
  document.getElementById('confirmModal').classList.add('hidden');
});
document.getElementById('confirmNo').addEventListener('click', () => {
  pendingDeleteId = null; document.getElementById('confirmModal').classList.add('hidden');
});

// 點背景關閉
['moodModal','confirmModal','quickAddPanel','capsuleModal','capsuleDetailModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});

// 生日慶祝關閉
document.getElementById('closeBirthday').addEventListener('click', () => {
  document.getElementById('birthdayOverlay').classList.add('hidden');
});

// Bottom nav
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', function() { switchPage(this.dataset.page); });
});

// 主題
document.getElementById('themeList').addEventListener('click', e => {
  const btn = e.target.closest('.theme-option');
  if (!btn) return;
  const key = btn.dataset.theme;
  const panel = document.getElementById('customThemePanel');
  if (key === 'custom') { panel.classList.remove('hidden'); }
  else { panel.classList.add('hidden'); applyTheme(key); saveTheme(key); }
});

document.getElementById('applyCustomTheme').addEventListener('click', () => {
  const primary = document.getElementById('customPrimary').value;
  const light   = document.getElementById('customLight').value;
  applyTheme('custom', {primary, light}); saveTheme('custom', {primary, light});
});

// 輸入 error 清除
['capsuleTitle','capsuleUnlockDate'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() { this.classList.remove('error'); });
});

// ── Service Worker ─────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}

// ── Init ───────────────────────────────────────────
loadData();
loadTheme();
setDefaultDate();
renderFriends();
checkBirthdayCelebration();

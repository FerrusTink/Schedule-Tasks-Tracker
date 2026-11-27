    (function () {
      'use strict';

      /* ===== Constants & Palette ===== */
      const STORAGE_KEY = 'pa_tracker_v1';
      // Set these to the Project URL and anon/public key from your Supabase project.
      const SUPABASE_URL = 'https://wcmyqnbirgpnuelpbxfz.supabase.co';
      const SUPABASE_ANON_KEY = 'sb_publishable_yHPQBOZKnYaXZc93uCzFtg_Ac_otIwQ';
      const CLOUD_TABLE = 'user_tracker_data';
      let supabase = null;
      let signedInUser = null;
      let cloudSaveTimer = null;
      let cloudWriteChain = Promise.resolve();
      let authMode = 'signin';
      const ROUTES = ['daily', 'weekly', 'events', 'other'];
      const PAGE_TITLES = {
        daily: 'Daily Tasks',
        weekly: 'Weekly Tasks',
        events: 'Events & Meetings',
        other: 'Other Tasks'
      };
      const MONTHS_FULL = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const MONTHS_SHORT = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      const WEEKDAYS_FULL = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
      ];

      // 20 Tag colours (5 rows x 4 columns) with light & dark mode M3-consistent hex pairs
      const TAG_COLORS = {
        red:     { label: 'Red',     light: { bg: '#FEE2E2', text: '#991B1B' }, dark: { bg: '#7F1D1D', text: '#FECACA' } },
        rose:    { label: 'Rose',    light: { bg: '#FFE4E6', text: '#9F1239' }, dark: { bg: '#881337', text: '#FECDD3' } },
        pink:    { label: 'Pink',    light: { bg: '#FCE7F3', text: '#9D174D' }, dark: { bg: '#831843', text: '#FBCFE8' } },
        fuchsia: { label: 'Fuchsia', light: { bg: '#FAE8FF', text: '#86198F' }, dark: { bg: '#701A75', text: '#F5D0FE' } },
        purple:  { label: 'Purple',  light: { bg: '#F3E8FF', text: '#6B21A8' }, dark: { bg: '#581C87', text: '#E9D5FF' } },
        violet:  { label: 'Violet',  light: { bg: '#EDE9FE', text: '#5B21B6' }, dark: { bg: '#4C1D95', text: '#DDD6FE' } },
        indigo:  { label: 'Indigo',  light: { bg: '#E0E7FF', text: '#3730A3' }, dark: { bg: '#312E81', text: '#C7D2FE' } },
        blue:    { label: 'Blue',    light: { bg: '#DBEAFE', text: '#1E40AF' }, dark: { bg: '#1E3A8A', text: '#BFDBFE' } },
        sky:     { label: 'Sky',     light: { bg: '#E0F2FE', text: '#075985' }, dark: { bg: '#0C4A6E', text: '#BAE6FD' } },
        cyan:    { label: 'Cyan',    light: { bg: '#CFFAFE', text: '#155E75' }, dark: { bg: '#164E63', text: '#A5F3FC' } },
        teal:    { label: 'Teal',    light: { bg: '#CCFBF1', text: '#115E59' }, dark: { bg: '#134E4A', text: '#99F6E4' } },
        emerald: { label: 'Emerald', light: { bg: '#D1FAE5', text: '#065F46' }, dark: { bg: '#064E3B', text: '#A7F3D0' } },
        green:   { label: 'Green',   light: { bg: '#DCFCE7', text: '#166534' }, dark: { bg: '#14532D', text: '#BBF7D0' } },
        lime:    { label: 'Lime',    light: { bg: '#ECFCCB', text: '#3F6212' }, dark: { bg: '#365314', text: '#D9F99D' } },
        yellow:  { label: 'Yellow',  light: { bg: '#FEF9C3', text: '#854D0E' }, dark: { bg: '#713F12', text: '#FEF08A' } },
        amber:   { label: 'Amber',   light: { bg: '#FEF3C7', text: '#92400E' }, dark: { bg: '#78350F', text: '#FDE68A' } },
        orange:  { label: 'Orange',  light: { bg: '#FFEDD5', text: '#9A3412' }, dark: { bg: '#7C2D12', text: '#FED7AA' } },
        coral:   { label: 'Coral',   light: { bg: '#FED7D7', text: '#9B2C2C' }, dark: { bg: '#742A2A', text: '#FEB2B2' } },
        brown:   { label: 'Brown',   light: { bg: '#EFEBE9', text: '#4E342E' }, dark: { bg: '#3E2723', text: '#D7CCC8' } },
        slate:   { label: 'Slate',   light: { bg: '#E2E8F0', text: '#334155' }, dark: { bg: '#334155', text: '#E2E8F0' } }
      };

      /* ===== Inline SVG Icons ===== */
      const ICONS = {
        pen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
        plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
        bin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
        grip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
        sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
        moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
        chevLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
        chevRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>',
        check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      };

      /* ===== IST Time Authority (5.4) ===== */
      function now() {
        const ist = new Date(Date.now() + 330 * 60000);
        return {
          year: ist.getUTCFullYear(),
          month: ist.getUTCMonth() + 1,
          day: ist.getUTCDate(),
          hour: ist.getUTCHours(),
          minute: ist.getUTCMinutes(),
          second: ist.getUTCSeconds(),
          weekday: WEEKDAYS_FULL[ist.getUTCDay()],
          weekdayIdx: ist.getUTCDay()
        };
      }

      function pad2(n) {
        return String(n).padStart(2, '0');
      }

      function toISODate(y, m, d) {
        return `${y}-${pad2(m)}-${pad2(d)}`;
      }

      function todayISO() {
        const n = now();
        return toISODate(n.year, n.month, n.day);
      }

      function getMondayISO(n) {
        const dt = new Date(Date.UTC(n.year, n.month - 1, n.day));
        const dayIdx = dt.getUTCDay(); // 0=Sun..6=Sat
        const diffToMon = (dayIdx + 6) % 7;
        dt.setUTCDate(dt.getUTCDate() - diffToMon);
        return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      }

      function parseISODate(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        return { year: y, month: m, day: d };
      }

      function diffCalendarDays(isoA, isoB) {
        const a = parseISODate(isoA);
        const b = parseISODate(isoB);
        const utcA = Date.UTC(a.year, a.month - 1, a.day);
        const utcB = Date.UTC(b.year, b.month - 1, b.day);
        return Math.round((utcA - utcB) / 86400000);
      }

      function formatDisplayDate(iso) {
        const { month, day } = parseISODate(iso);
        return `${pad2(day)}-${MONTHS_SHORT[month - 1]}`;
      }

      function formatDisplayTime(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return `${h}:${pad2(m)}`;
      }

      function timeToMinutes(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
      }

      function isValidCalendarDate(year, month, day) {
        if (month < 1 || month > 12 || day < 1 || day > 31) return false;
        const dt = new Date(Date.UTC(year, month - 1, day));
        return dt.getUTCFullYear() === year && (dt.getUTCMonth() + 1) === month && dt.getUTCDate() === day;
      }

      function uuid() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      }

      /* ===== State & Storage (B4, Section 10) ===== */
      let memoryFallbackState = null;

      function createDefaultState() {
        const n = now();
        return {
          version: 1,
          theme: 'light',
          lastDailyReset: toISODate(n.year, n.month, n.day),
          lastWeekStart: getMondayISO(n),
          activeTagFilter: null,
          tags: [{ id: 'high-priority', name: 'High-Priority', colorKey: 'red', order: 0 }],
          daily: [],
          weekly: [],
          events: [],
          other: []
        };
      }

      function loadState() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) {
            const def = createDefaultState();
            saveState(def);
            return def;
          }
          const parsed = JSON.parse(raw);
          const def = createDefaultState();
          const merged = {
            version: 1,
            theme: parsed.theme === 'dark' ? 'dark' : 'light',
            lastDailyReset: parsed.lastDailyReset || def.lastDailyReset,
            lastWeekStart: parsed.lastWeekStart || def.lastWeekStart,
            activeTagFilter: parsed.activeTagFilter || null,
            tags: Array.isArray(parsed.tags) ? parsed.tags : def.tags,
            daily: Array.isArray(parsed.daily) ? parsed.daily : [],
            weekly: Array.isArray(parsed.weekly) ? parsed.weekly : [],
            events: Array.isArray(parsed.events) ? parsed.events : [],
            other: Array.isArray(parsed.other) ? parsed.other : []
          };
          ensureHighPriorityTag(merged);
          return merged;
        } catch (e) {
          if (!memoryFallbackState) memoryFallbackState = createDefaultState();
          return memoryFallbackState;
        }
      }

      function removeDefaultDemoData(targetState) {
        const demoTagIds = new Set(['ipmat', 'self-improvement']);
        ['daily', 'weekly', 'events', 'other'].forEach(route => {
          targetState[route] = (Array.isArray(targetState[route]) ? targetState[route] : []).filter(item => !String(item.id || '').startsWith('seed-'));
          targetState[route].forEach(item => {
            if (Array.isArray(item.tagIds)) item.tagIds = item.tagIds.filter(id => !demoTagIds.has(id));
          });
        });
        targetState.tags = (Array.isArray(targetState.tags) ? targetState.tags : []).filter(tag => !demoTagIds.has(tag.id));
      }

      function ensureHighPriorityTag(targetState) {
        if (!Array.isArray(targetState.tags)) targetState.tags = [];
        if (targetState.tags.some(tag => tag.id === 'high-priority')) return;
        const firstOrder = targetState.tags.reduce((min, tag) => Math.min(min, Number(tag.order) || 0), 0);
        targetState.tags.push({ id: 'high-priority', name: 'High-Priority', colorKey: 'red', order: firstOrder - 1 });
      }

      function removeLegacyStatisticsState(targetState) {
        ['signupDate', 'dailyHistory', 'weeklyHistory', 'statsDailyWeeks', 'statsWeeklyWeeks', 'statsAttendanceWeeks'].forEach(key => {
          delete targetState[key];
        });
      }

      function saveState(nextState) {
        removeLegacyStatisticsState(nextState);
        memoryFallbackState = nextState;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        } catch (e) {
          // In-memory fallback already updated
        }
        if (signedInUser && supabase) {
          clearTimeout(cloudSaveTimer);
          const userId = signedInUser.id;
          const snapshot = JSON.parse(JSON.stringify(nextState));
          cloudSaveTimer = setTimeout(() => {
            cloudWriteChain = cloudWriteChain.then(async () => {
              const { error } = await supabase.from(CLOUD_TABLE).upsert({ user_id: userId, state: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
              if (error) showCloudStatus('Sync failed. Changes are saved on this device.');
              else showCloudStatus('Synced');
            }).catch(() => showCloudStatus('Sync failed. Changes are saved on this device.'));
          }, 500);
        }
      }

      let state = loadState();

      /* ===== Ephemeral UI State ===== */
      let currentRoute = document.body.dataset.route || 'daily';
      const editMode = { daily: false, weekly: false, events: false, other: false };
      const undoStacks = { daily: [], weekly: [], events: [], other: [] };
      const redoStacks = { daily: [], weekly: [], events: [], other: [] };
      // Open drafts and inline edits (never persisted per Section 10)
      let openDrafts = []; // [{ draftId, route, values, error, invalidFields }]
      let openEdits = {};  // { [taskId]: { route, focusField, values, error, invalidFields } }
      let activeRatingId = null;
      let calendarMonth = now().month; // 1..12
      let editingTagId = null;
      let selectedTagColor = 'blue';

      /* ===== Rollover Engine (6.5) ===== */
      function runRollovers() {
        const n = now();
        const today = toISODate(n.year, n.month, n.day);
        const weekMon = getMondayISO(n);
        let changed = false;

        if (state.lastDailyReset !== today) {
          state.daily.forEach(t => { t.completed = false; });
          state.lastDailyReset = today;
          changed = true;
        }

        if (state.lastWeekStart !== weekMon) {
          state.weekly = state.weekly.filter(t => {
            if (t.thisWeekOnly && t.completed) return false;
            if (!t.thisWeekOnly) {
              t.completion = 0;
              t.completed = false;
            }
            return true;
          });
          state.lastWeekStart = weekMon;
          changed = true;
        }

        const beforeOtherLen = state.other.length;
        state.other = state.other.filter(t => {
          if (t.completed && t.completedDate) {
            return diffCalendarDays(today, t.completedDate) < 7;
          }
          return true;
        });
        if (state.other.length !== beforeOtherLen) changed = true;

        if (changed) {
          saveState(state);
        }
        return changed;
      }

      /* ===== Derived Helpers ===== */
      function isEventEnded(ev, n) {
        const today = toISODate(n.year, n.month, n.day);
        if (ev.date < today) return true;
        if (ev.date > today) return false;
        const nowMins = n.hour * 60 + n.minute;
        if (ev.end) {
          return nowMins >= timeToMinutes(ev.end);
        }
        return false; // No end time: ended when event date's day is over (next day 00:00 IST)
      }

      function isEventLocked(ev, n) {
        const today = toISODate(n.year, n.month, n.day);
        if (ev.date < today) return false;
        if (ev.date > today) return true;
        const nowMins = n.hour * 60 + n.minute;
        const unlockMins = ev.end ? timeToMinutes(ev.end) : (timeToMinutes(ev.start) + 30);
        return nowMins < unlockMins;
      }

      function computeStartsIn(ev, n) {
        const today = toISODate(n.year, n.month, n.day);
        const daysDiff = diffCalendarDays(ev.date, today);
        if (daysDiff > 0) {
          return daysDiff === 1 ? '1 day' : `${daysDiff} days`;
        }
        if (daysDiff < 0) return '—';
        const nowMins = n.hour * 60 + n.minute;
        const startMins = timeToMinutes(ev.start);
        const remMins = startMins - nowMins;
        if (remMins <= 0) return '—';
        if (remMins < 60) return 'Less than 1 hour';
        const hrs = Math.floor(remMins / 60);
        return hrs === 1 ? '1 hour' : `${hrs} hours`;
      }

      function computeDueIn(task, today) {
        if (task.completed && task.completedDate) {
          const x = diffCalendarDays(task.deadline, task.completedDate);
          if (x < 0) return { text: 'COMPLETED after deadline', cls: 'sem-green' };
          if (x === 0) return { text: 'COMPLETED 0 days before deadline', cls: 'sem-green' };
          return { text: `COMPLETED ${x} ${x === 1 ? 'day' : 'days'} before deadline`, cls: 'sem-green' };
        }
        const x = diffCalendarDays(task.deadline, today);
        if (x >= 8) return { text: `${x} days`, cls: 'sem-green' };
        if (x >= 5) return { text: `${x} days`, cls: 'sem-yellow' };
        if (x >= 1) return { text: x === 1 ? '1 day' : `${x} days`, cls: 'sem-red' };
        if (x === 0) return { text: 'TODAY', cls: 'sem-red' };
        return { text: 'DEADLINE PASSED', cls: 'sem-red' };
      }

      function getTaskGroup(route, task, n) {
        const isDone = route === 'events' ? isEventEnded(task, n) : !!task.completed;
        if (isDone) return 2;
        if (Array.isArray(task.tagIds) && task.tagIds.includes('high-priority')) return 0;
        return 1;
      }

      function getSortedFilteredTasks(route) {
        const n = now();
        let items = state[route].slice();
        if (state.activeTagFilter) {
          items = items.filter(t => Array.isArray(t.tagIds) && t.tagIds.includes(state.activeTagFilter));
        }
        items.sort((a, b) => {
          const ga = getTaskGroup(route, a, n);
          const gb = getTaskGroup(route, b, n);
          if (ga !== gb) return ga - gb;
          return (a.order ?? 0) - (b.order ?? 0);
        });
        return items;
      }

      function getTagById(id) {
        return state.tags.find(t => t.id === id) || null;
      }

      function getTagStyle(tag) {
        const colorDef = TAG_COLORS[tag.colorKey] || TAG_COLORS.red;
        const pair = state.theme === 'dark' ? colorDef.dark : colorDef.light;
        return `background-color:${pair.bg};color:${pair.text};`;
      }

      function escapeHtml(str) {
        return String(str ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      /* ===== FLIP Animation (6.2, 6.7) ===== */
      function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }

      function capturePositions() {
        const map = new Map();
        document.querySelectorAll('.task-row[data-id]').forEach(el => {
          map.set(el.dataset.id, el.getBoundingClientRect());
        });
        return map;
      }

      function playFLIP(prevRects) {
        if (prefersReducedMotion() || !prevRects || prevRects.size === 0) return;
        document.querySelectorAll('.task-row[data-id]').forEach(el => {
          const oldRect = prevRects.get(el.dataset.id);
          if (!oldRect) return;
          const newRect = el.getBoundingClientRect();
          const dy = oldRect.top - newRect.top;
          if (Math.abs(dy) < 1) return;
          el.style.transition = 'none';
          el.style.transform = `translateY(${dy}px)`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0, 1)';
              el.style.transform = '';
            });
          });
        });
      }

      /* ===== Confetti Burst (6.7) ===== */
      function fireConfettiFromElement(el) {
        if (prefersReducedMotion() || !el) return;
        const canvas = document.getElementById('confetti-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const rect = el.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;
        const colors = ['#D97706', '#16A34A', '#2563EB', '#DB2777', '#9333EA', '#EAB308'];
        const particles = Array.from({ length: 28 }, () => {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2.5 + Math.random() * 5;
          return {
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2.5,
            size: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            rot: Math.random() * 360,
            vrot: (Math.random() - 0.5) * 14
          };
        });
        const start = performance.now();
        function step(ts) {
          const elapsed = ts - start;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18;
            p.rot += p.vrot;
            p.alpha = Math.max(0, 1 - elapsed / 700);
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
            ctx.restore();
          });
          if (elapsed < 700) {
            requestAnimationFrame(step);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        requestAnimationFrame(step);
      }

      /* ===== Undo / Redo (6.6) ===== */
      function pushUndo(route, snapshot) {
        if (!editMode[route]) return;
        undoStacks[route].push(JSON.parse(JSON.stringify(snapshot)));
        redoStacks[route] = [];
        updateHeaderActions();
      }

      function performUndo(route) {
        if (!undoStacks[route].length) return;
        redoStacks[route].push(JSON.parse(JSON.stringify(state[route])));
        state[route] = undoStacks[route].pop();
        saveState(state);
        renderTaskList();
        updateHeaderActions();
      }

      function performRedo(route) {
        if (!redoStacks[route].length) return;
        undoStacks[route].push(JSON.parse(JSON.stringify(state[route])));
        state[route] = redoStacks[route].pop();
        saveState(state);
        renderTaskList();
        updateHeaderActions();
      }

      /* ===== Theme & Ribbon ===== */
      function applyTheme() {
        document.documentElement.setAttribute('data-theme', state.theme);
        const iconEl = document.getElementById('theme-icon');
        const labelEl = document.getElementById('theme-label');
        if (state.theme === 'dark') {
          iconEl.innerHTML = ICONS.sun;
          labelEl.textContent = 'Light mode';
        } else {
          iconEl.innerHTML = ICONS.moon;
          labelEl.textContent = 'Dark mode';
        }
      }

      function syncRibbonHeight() {
        const ribbon = document.getElementById('top-ribbon');
        if (ribbon) {
          document.documentElement.style.setProperty('--ribbon-height', `${ribbon.offsetHeight}px`);
        }
      }

      let lastTickDate = todayISO();
      let lastTickMinute = -1;

      function updateClockAndDerived() {
        const n = now();
        document.getElementById('ist-time').textContent = `${pad2(n.hour)}:${pad2(n.minute)}`;
        document.getElementById('ist-date-btn').textContent = `${pad2(n.day)} ${MONTHS_FULL[n.month - 1]}, ${n.year}`;
        document.getElementById('ist-day').textContent = n.weekday;

        const curDate = toISODate(n.year, n.month, n.day);
        const dateChanged = curDate !== lastTickDate;
        const minuteChanged = n.minute !== lastTickMinute;
        const rolled = dateChanged ? runRollovers() : false;
        if (dateChanged) {
          lastTickDate = curDate;
          renderTaskList();
        } else if (minuteChanged) {
          // Re-evaluate Starts in, Due in, and event locks once per minute.
          lastTickMinute = n.minute;
          if (openDrafts.length === 0 && Object.keys(openEdits).length === 0 && !activeRatingId) renderTaskList();
        }
        if (rolled) renderTaskList();
      }

      /* ===== Header Actions ===== */
      function updateHeaderActions() {
        const isTaskRoute = ROUTES.includes(currentRoute);
        const isEdit = isTaskRoute && editMode[currentRoute];
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const editBtn = document.getElementById('edit-mode-btn');
        undoBtn.style.display = isEdit ? 'inline-flex' : 'none';
        redoBtn.style.display = isEdit ? 'inline-flex' : 'none';
        undoBtn.disabled = !isTaskRoute || undoStacks[currentRoute].length === 0;
        redoBtn.disabled = !isTaskRoute || redoStacks[currentRoute].length === 0;
        editBtn.classList.toggle('active-edit', isEdit);
        editBtn.setAttribute('aria-pressed', isEdit ? 'true' : 'false');
        document.getElementById('header-actions').style.display = isTaskRoute ? 'flex' : 'none';
      }

      /* ===== Masked Input Helpers (8.2, 8.3) ===== */
      function formatMaskDisplay(digits, type) {
        const template = type === 'date' ? 'DD/MM' : 'HH:MM';
        const chars = digits.split('');
        let typedHtml = '';
        let phHtml = '';
        let dIdx = 0;
        for (let i = 0; i < template.length; i++) {
          const ch = template[i];
          if (ch === '/' || ch === ':') {
            if (dIdx <= chars.length && chars.length >= 2) {
              typedHtml += ch;
            } else {
              phHtml += ch;
            }
          } else {
            if (dIdx < chars.length) {
              typedHtml += escapeHtml(chars[dIdx]);
              dIdx++;
            } else {
              phHtml += ch;
            }
          }
        }
        return `<span class="mask-typed">${typedHtml}</span><span class="mask-placeholder">${phHtml}</span>`;
      }

      function attachMaskedDigitsInput(inputEl, displayEl, type, onChange) {
        function sync() {
          const clean = inputEl.value.replace(/\D/g, '').slice(0, 4);
          if (inputEl.value !== clean) inputEl.value = clean;
          displayEl.innerHTML = formatMaskDisplay(clean, type);
          onChange(clean);
        }
        inputEl.addEventListener('keydown', e => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
          if (allowed.includes(e.key)) return;
          if (!/^\d$/.test(e.key)) {
            e.preventDefault();
          }
        });
        inputEl.addEventListener('input', sync);
        sync();
      }

      /* ===== Tag-Capable Contenteditable Field (9.4) ===== */
      function buildTagRichInput(initialText, initialTagIds, placeholder, onUpdate) {
        const wrap = document.createElement('div');
        wrap.className = 'tag-editor-wrap';

        const editor = document.createElement('div');
        editor.className = 'tag-rich-input';
        editor.contentEditable = 'true';
        editor.setAttribute('data-placeholder', placeholder);

        const menu = document.createElement('div');
        menu.className = 'tag-suggest-menu';
        menu.style.display = 'none';

        wrap.appendChild(editor);
        wrap.appendChild(menu);

        // Populate initial content
        if (initialText) {
          editor.appendChild(document.createTextNode(initialText));
        }
        (initialTagIds || []).forEach(tid => {
          const tag = getTagById(tid);
          if (tag) {
            if (editor.childNodes.length) editor.appendChild(document.createTextNode(' '));
            editor.appendChild(createChipSpan(tag));
          }
        });

        let suggestOpen = false;
        let suggestItems = [];
        let suggestIdx = 0;

        function createChipSpan(tag) {
          const span = document.createElement('span');
          span.className = 'inline-tag-chip';
          span.contentEditable = 'false';
          span.dataset.tagId = tag.id;
          span.setAttribute('style', getTagStyle(tag));
          span.textContent = tag.name;
          return span;
        }

        function extractValue() {
          const tagIds = [];
          const textParts = [];
          editor.childNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.dataset && node.dataset.tagId) {
              if (!tagIds.includes(node.dataset.tagId)) tagIds.push(node.dataset.tagId);
            } else if (node.nodeType === Node.TEXT_NODE) {
              textParts.push(node.textContent);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              textParts.push(node.textContent);
            }
          });
          const text = textParts.join(' ').replace(/\s+/g, ' ').trim();
          return { text, tagIds };
        }

        function getActiveHashToken() {
          const sel = window.getSelection();
          if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
          const node = sel.anchorNode;
          if (node.nodeType !== Node.TEXT_NODE) return null;
          const before = node.textContent.slice(0, sel.anchorOffset);
          const match = before.match(/(^|\s)#([^#]*)$/);
          if (!match) return null;
          return {
            node,
            startOffset: before.length - match[2].length - 1,
            endOffset: sel.anchorOffset,
            query: match[2]
          };
        }

        function insertChipAtToken(token, tag) {
          const full = token.node.textContent;
          const before = full.slice(0, token.startOffset);
          const after = full.slice(token.endOffset);
          const parent = token.node.parentNode;

          const beforeNode = document.createTextNode(before);
          const chip = createChipSpan(tag);
          const afterNode = document.createTextNode(after.startsWith(' ') ? after : ' ' + after);

          parent.insertBefore(beforeNode, token.node);
          parent.insertBefore(chip, token.node);
          parent.insertBefore(afterNode, token.node);
          parent.removeChild(token.node);

          const sel = window.getSelection();
          const range = document.createRange();
          range.setStart(afterNode, 1);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);

          closeMenu();
          onUpdate(extractValue());
        }

        function renderMenu(token) {
          const q = token.query.toLowerCase();
          suggestItems = state.tags
            .slice()
            .sort((a, b) => a.order - b.order)
            .filter(t => t.name.toLowerCase().includes(q));

          if (!suggestItems.length) {
            closeMenu();
            return;
          }
          suggestOpen = true;
          if (suggestIdx >= suggestItems.length) suggestIdx = 0;
          menu.innerHTML = '';
          suggestItems.forEach((tag, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tag-suggest-item' + (idx === suggestIdx ? ' active' : '');
            const pill = document.createElement('span');
            pill.className = 'inline-tag-chip';
            pill.setAttribute('style', getTagStyle(tag));
            pill.textContent = tag.name;
            btn.appendChild(pill);
            btn.addEventListener('mousedown', e => {
              e.preventDefault();
              insertChipAtToken(token, tag);
            });
            menu.appendChild(btn);
          });
          menu.style.display = 'flex';
        }

        function closeMenu() {
          suggestOpen = false;
          suggestItems = [];
          suggestIdx = 0;
          menu.style.display = 'none';
        }

        function tryAutoConvertExactMatch() {
          // Convert any #exactTagName when followed by space or on blur
          const childNodes = Array.from(editor.childNodes);
          let converted = false;
          childNodes.forEach(node => {
            if (node.nodeType !== Node.TEXT_NODE) return;
            const sortedByLen = state.tags.slice().sort((a, b) => b.name.length - a.name.length);
            const escapedNames = sortedByLen.map(t => t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            if (!escapedNames.length) return;
            const regex = new RegExp(`(^|\\s)#(${escapedNames.join('|')})(?=\\s|$)`, 'gi');
            const text = node.textContent;
            let match;
            let lastIdx = 0;
            const frag = document.createDocumentFragment();
            let nodeChanged = false;
            while ((match = regex.exec(text)) !== null) {
              const found = state.tags.find(t => t.name.toLowerCase() === match[2].toLowerCase());
              if (found) {
                nodeChanged = true;
                converted = true;
                const prefix = text.slice(lastIdx, match.index + match[1].length);
                if (prefix) frag.appendChild(document.createTextNode(prefix));
                frag.appendChild(createChipSpan(found));
                lastIdx = match.index + match[0].length;
              }
            }
            if (nodeChanged) {
              const tail = text.slice(lastIdx);
              if (tail) frag.appendChild(document.createTextNode(tail));
              node.parentNode.replaceChild(frag, node);
            }
          });
          return converted;
        }

        editor.addEventListener('keydown', e => {
          if (suggestOpen) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              suggestIdx = (suggestIdx + 1) % suggestItems.length;
              const tok = getActiveHashToken();
              if (tok) renderMenu(tok);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              suggestIdx = (suggestIdx - 1 + suggestItems.length) % suggestItems.length;
              const tok = getActiveHashToken();
              if (tok) renderMenu(tok);
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const tok = getActiveHashToken();
              if (tok && suggestItems[suggestIdx]) {
                insertChipAtToken(tok, suggestItems[suggestIdx]);
              }
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              closeMenu();
              return;
            }
          }
          if (e.key === 'Enter') {
            e.preventDefault(); // single-line style inside table cell
          }
          if (e.key === ' ') {
            const tok = getActiveHashToken();
            if (tok && tok.query) {
              const exact = state.tags.find(t => t.name.toLowerCase() === tok.query.toLowerCase());
              if (exact) {
                e.preventDefault();
                insertChipAtToken(tok, exact);
                return;
              }
            }
          }
        });

        editor.addEventListener('input', () => {
          const tok = getActiveHashToken();
          if (tok) {
            renderMenu(tok);
          } else {
            closeMenu();
          }
          onUpdate(extractValue());
        });

        editor.addEventListener('blur', () => {
          setTimeout(() => {
            closeMenu();
            if (tryAutoConvertExactMatch()) {
              onUpdate(extractValue());
            } else {
              onUpdate(extractValue());
            }
          }, 120);
        });

        return { wrap, editor, getValue: extractValue };
      }

      /* ===== Inline Draft / Edit Form Renderer ===== */
      function createDefaultFormValues(route) {
        if (route === 'daily') {
          return { task: '', detail: '', tagIds: [], goalType: 'numeric', goal: '' };
        }
        if (route === 'weekly') {
          return { task: '', detail: '', tagIds: [], goalType: 'recurring', goal: '', dailyGoal: '', thisWeekOnly: false };
        }
        if (route === 'events') {
          return { agenda: '', tagIds: [], organizer: '', dateDigits: '', startDigits: '', endDigits: '' };
        }
        return { task: '', detail: '', tagIds: [], deadlineDigits: '' };
      }

      function taskToFormValues(route, task) {
        if (route === 'daily') {
          return {
            task: task.task,
            detail: task.detail,
            tagIds: [...(task.tagIds || [])],
            goalType: task.goalType,
            goal: String(task.goal)
          };
        }
        if (route === 'weekly') {
          return {
            task: task.task,
            detail: task.detail,
            tagIds: [...(task.tagIds || [])],
            goalType: task.goalType,
            goal: String(task.goal),
            dailyGoal: task.dailyGoal || '',
            thisWeekOnly: !!task.thisWeekOnly
          };
        }
        if (route === 'events') {
          const [, m, d] = task.date.split('-');
          const startDigits = task.start.replace(':', '');
          const endDigits = task.end ? task.end.replace(':', '') : '';
          return {
            agenda: task.agenda,
            tagIds: [...(task.tagIds || [])],
            organizer: task.organizer,
            dateDigits: `${d}${m}`,
            startDigits,
            endDigits
          };
        }
        const [, m, d] = task.deadline.split('-');
        return {
          task: task.task,
          detail: task.detail,
          tagIds: [...(task.tagIds || [])],
          deadlineDigits: `${d}${m}`
        };
      }

      function parseDailyGoalValue(raw) {
        const s = String(raw || '').trim();
        if (!s) return null;
        if (/^\d+(?:\.\d+)?$/.test(s)) {
          const n = parseFloat(s);
          return Number.isFinite(n) ? n : null;
        }
        const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (frac) {
          const num = parseFloat(frac[1]);
          const den = parseFloat(frac[2]);
          return den > 0 ? num / den : null;
        }
        const mult = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)$/);
        if (mult) {
          const num = parseFloat(mult[1]);
          const den = parseFloat(mult[2]);
          const m = parseFloat(mult[3]);
          return den > 0 ? (num / den) * m : null;
        }
        return null;
      }

      function validateForm(route, values) {
        const invalid = [];
        const errors = [];
        const istYear = now().year;

        if (route === 'daily') {
          if (!values.task.trim()) { invalid.push('task'); errors.push('Task is required.'); }
          if (!values.detail.trim() && (!values.tagIds || !values.tagIds.length)) {
            invalid.push('detail'); errors.push('Detail is required.');
          }
          if (values.goalType === 'numeric') {
            if (!/^\d+$/.test(values.goal.trim())) {
              invalid.push('goal'); errors.push('Numeric Weekly Goal must be digits only.');
            }
          } else if (!values.goal.trim()) {
            invalid.push('goal'); errors.push('Weekly Goal is required.');
          }
          return { ok: errors.length === 0, invalid, message: errors.join(' ') };
        }

        if (route === 'weekly') {
          if (!values.task.trim()) { invalid.push('task'); errors.push('Task is required.'); }
          if (!values.detail.trim() && (!values.tagIds || !values.tagIds.length)) {
            invalid.push('detail'); errors.push('Detail is required.');
          }
          if (values.goalType === 'recurring') {
            const g = values.goal.trim();
            if (!/^\d+$/.test(g) || parseInt(g, 10) < 2) {
              invalid.push('goal'); errors.push('Recurring goal must be an integer >= 2.');
            }
          } else if (values.goalType === 'subjective') {
            if (!values.goal.trim()) {
              invalid.push('goal'); errors.push('Subjective goal is required.');
            }
          }
          if ((values.dailyGoal || '').trim() && parseDailyGoalValue(values.dailyGoal) === null) {
            invalid.push('dailyGoal');
            errors.push('Daily Goal must be a valid number or fraction (e.g. 1/2 or 0.5).');
          }
          return { ok: errors.length === 0, invalid, message: errors.join(' ') };
        }

        if (route === 'events') {
          if (!values.agenda.trim() && (!values.tagIds || !values.tagIds.length)) {
            invalid.push('agenda'); errors.push('Agenda is required.');
          }
          if (!values.organizer.trim()) {
            invalid.push('organizer'); errors.push('Organizer is required.');
          }
          if (values.dateDigits.length !== 4) {
            invalid.push('date'); errors.push('Date must be 4 digits (DDMM).');
          } else {
            const dd = parseInt(values.dateDigits.slice(0, 2), 10);
            const mm = parseInt(values.dateDigits.slice(2, 4), 10);
            if (!isValidCalendarDate(istYear, mm, dd)) {
              invalid.push('date'); errors.push('Date is not a valid calendar date.');
            }
          }
          let startMins = null;
          if (values.startDigits.length !== 4) {
            invalid.push('start'); errors.push('Start Time must be 4 digits (HHMM).');
          } else {
            const hh = parseInt(values.startDigits.slice(0, 2), 10);
            const mm = parseInt(values.startDigits.slice(2, 4), 10);
            if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
              invalid.push('start'); errors.push('Start Time must be valid 24-hour HHMM.');
            } else {
              startMins = hh * 60 + mm;
            }
          }
          if (values.endDigits.length > 0) {
            if (values.endDigits.length !== 4) {
              invalid.push('end'); errors.push('End Time must be 4 digits (HHMM).');
            } else {
              const hh = parseInt(values.endDigits.slice(0, 2), 10);
              const mm = parseInt(values.endDigits.slice(2, 4), 10);
              if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
                invalid.push('end'); errors.push('End Time must be valid 24-hour HHMM.');
              } else if (startMins !== null && (hh * 60 + mm) <= startMins) {
                invalid.push('end'); errors.push('End Time must be later than Start Time.');
              }
            }
          }
          return { ok: errors.length === 0, invalid, message: errors.join(' ') };
        }

        // other
        if (!values.task.trim()) { invalid.push('task'); errors.push('Task is required.'); }
        if (!values.detail.trim() && (!values.tagIds || !values.tagIds.length)) {
          invalid.push('detail'); errors.push('Detail is required.');
        }
        if (values.deadlineDigits.length !== 4) {
          invalid.push('deadline'); errors.push('Deadline must be 4 digits (DDMM).');
        } else {
          const dd = parseInt(values.deadlineDigits.slice(0, 2), 10);
          const mm = parseInt(values.deadlineDigits.slice(2, 4), 10);
          if (!isValidCalendarDate(istYear, mm, dd)) {
            invalid.push('deadline'); errors.push('Deadline is not a valid calendar date.');
          }
        }
        return { ok: errors.length === 0, invalid, message: errors.join(' ') };
      }

      function renderInlineFormBlock({ route, values, invalidFields, errorMsg, focusField, snoLabel, onSave, onDiscard }) {
        const block = document.createElement('div');
        block.className = 'draft-block';

        const row = document.createElement('div');
        row.className = `draft-row cols-${route}`;

        const fieldsMap = {};

        // S. no. cell
        const snoCell = document.createElement('div');
        snoCell.className = 'task-cell';
        snoCell.textContent = snoLabel;
        row.appendChild(snoCell);

        if (route === 'daily') {
          // Task
          const cTask = document.createElement('div');
          cTask.className = 'task-cell';
          const inTask = document.createElement('input');
          inTask.type = 'text';
          inTask.className = 'field-input' + (invalidFields.includes('task') ? ' field-invalid' : '');
          inTask.placeholder = 'Task';
          inTask.value = values.task;
          inTask.addEventListener('input', () => { values.task = inTask.value; });
          cTask.appendChild(inTask);
          fieldsMap.task = inTask;
          row.appendChild(cTask);

          // Detail (with tags)
          const cDetail = document.createElement('div');
          cDetail.className = 'task-cell';
          const rich = buildTagRichInput(values.detail, values.tagIds, 'Details (#tag)', v => {
            values.detail = v.text;
            values.tagIds = v.tagIds;
          });
          if (invalidFields.includes('detail')) rich.editor.classList.add('field-invalid');
          cDetail.appendChild(rich.wrap);
          fieldsMap.detail = rich.editor;
          row.appendChild(cDetail);

          // Completion (placeholder)
          const cComp = document.createElement('div');
          cComp.className = 'task-cell';
          cComp.textContent = '—';
          row.appendChild(cComp);

          // Weekly Goal
          const cGoal = document.createElement('div');
          cGoal.className = 'task-cell';
          const gWrap = document.createElement('div');
          gWrap.className = 'goal-input-group';
          const sel = document.createElement('select');
          sel.className = 'field-select';
          sel.innerHTML = '<option value="numeric">Numeric</option><option value="subjective">Subjective</option>';
          sel.value = values.goalType;

          const inGoal = document.createElement('input');
          inGoal.type = 'text';
          inGoal.className = 'field-input' + (invalidFields.includes('goal') ? ' field-invalid' : '');
          inGoal.placeholder = values.goalType === 'numeric' ? 'Digits only' : 'Goal text';
          inGoal.value = values.goal;

          sel.addEventListener('change', () => {
            values.goalType = sel.value;
            if (values.goalType === 'numeric') {
              values.goal = values.goal.replace(/\D/g, '');
              inGoal.value = values.goal;
              inGoal.placeholder = 'Digits only';
            } else {
              inGoal.placeholder = 'Goal text';
            }
          });
          inGoal.addEventListener('keydown', e => {
            if (values.goalType !== 'numeric') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
            if (allowed.includes(e.key)) return;
            if (!/^\d$/.test(e.key)) e.preventDefault();
          });
          inGoal.addEventListener('input', () => {
            if (values.goalType === 'numeric') {
              const clean = inGoal.value.replace(/\D/g, '');
              if (inGoal.value !== clean) inGoal.value = clean;
            }
            values.goal = inGoal.value;
          });

          gWrap.appendChild(sel);
          gWrap.appendChild(inGoal);
          cGoal.appendChild(gWrap);
          fieldsMap.goal = inGoal;
          row.appendChild(cGoal);
        } else if (route === 'weekly') {
          // Task
          const cTask = document.createElement('div');
          cTask.className = 'task-cell';
          const inTask = document.createElement('input');
          inTask.type = 'text';
          inTask.className = 'field-input' + (invalidFields.includes('task') ? ' field-invalid' : '');
          inTask.placeholder = 'Task';
          inTask.value = values.task;
          inTask.addEventListener('input', () => { values.task = inTask.value; });
          cTask.appendChild(inTask);
          fieldsMap.task = inTask;
          row.appendChild(cTask);

          // Detail
          const cDetail = document.createElement('div');
          cDetail.className = 'task-cell';
          const rich = buildTagRichInput(values.detail, values.tagIds, 'Details (#tag)', v => {
            values.detail = v.text;
            values.tagIds = v.tagIds;
          });
          if (invalidFields.includes('detail')) rich.editor.classList.add('field-invalid');
          cDetail.appendChild(rich.wrap);
          fieldsMap.detail = rich.editor;
          row.appendChild(cDetail);

          // Progress / This Week Only checkbox
          const cProg = document.createElement('div');
          cProg.className = 'task-cell';
          const lbl = document.createElement('label');
          lbl.className = 'this-week-label';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'm3-checkbox';
          cb.checked = !!values.thisWeekOnly;
          cb.addEventListener('change', () => { values.thisWeekOnly = cb.checked; });
          lbl.appendChild(cb);
          lbl.appendChild(document.createTextNode('This Week Only'));
          cProg.appendChild(lbl);
          row.appendChild(cProg);

          // Completion (placeholder)
          const cComp = document.createElement('div');
          cComp.className = 'task-cell';
          cComp.textContent = '—';
          row.appendChild(cComp);

          // Goal
          const cGoal = document.createElement('div');
          cGoal.className = 'task-cell';
          const gWrap = document.createElement('div');
          gWrap.className = 'goal-input-group';
          const sel = document.createElement('select');
          sel.className = 'field-select';
          sel.innerHTML = '<option value="recurring">Recurring</option><option value="nonrecurring">Non-recurring</option><option value="subjective">Subjective</option>';
          sel.value = values.goalType;

          const inGoal = document.createElement('input');
          inGoal.type = 'text';
          inGoal.className = 'field-input' + (invalidFields.includes('goal') ? ' field-invalid' : '');
          inGoal.value = values.goal;

          function syncWeeklyGoalInput() {
            if (values.goalType === 'nonrecurring') {
              inGoal.style.display = 'none';
              values.goal = '1';
            } else {
              inGoal.style.display = '';
              inGoal.placeholder = values.goalType === 'recurring' ? 'Int >= 2' : 'Goal text';
            }
          }
          syncWeeklyGoalInput();

          sel.addEventListener('change', () => {
            values.goalType = sel.value;
            if (values.goalType === 'recurring') {
              values.goal = values.goal.replace(/\D/g, '');
              inGoal.value = values.goal;
            }
            syncWeeklyGoalInput();
          });
          inGoal.addEventListener('keydown', e => {
            if (values.goalType !== 'recurring') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
            if (allowed.includes(e.key)) return;
            if (!/^\d$/.test(e.key)) e.preventDefault();
          });
          inGoal.addEventListener('input', () => {
            if (values.goalType === 'recurring') {
              const clean = inGoal.value.replace(/\D/g, '');
              if (inGoal.value !== clean) inGoal.value = clean;
            }
            values.goal = inGoal.value;
          });

          gWrap.appendChild(sel);
          gWrap.appendChild(inGoal);
          cGoal.appendChild(gWrap);
          fieldsMap.goal = inGoal;
          row.appendChild(cGoal);

          // Daily Goal
          const cDailyGoal = document.createElement('div');
          cDailyGoal.className = 'task-cell';
          const inDailyGoal = document.createElement('input');
          inDailyGoal.type = 'text';
          inDailyGoal.className = 'field-input' + (invalidFields.includes('dailyGoal') ? ' field-invalid' : '');
          inDailyGoal.placeholder = 'e.g. 1/2 or 0.5';
          inDailyGoal.value = values.dailyGoal || '';
          inDailyGoal.addEventListener('keydown', e => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', '.', '/'];
            if (allowed.includes(e.key)) return;
            if (!/^\d$/.test(e.key)) e.preventDefault();
          });
          inDailyGoal.addEventListener('input', () => {
            const clean = inDailyGoal.value.replace(/[^0-9./]/g, '');
            if (inDailyGoal.value !== clean) inDailyGoal.value = clean;
            values.dailyGoal = clean;
          });
          cDailyGoal.appendChild(inDailyGoal);
          fieldsMap.dailyGoal = inDailyGoal;
          row.appendChild(cDailyGoal);
        } else if (route === 'events') {
          // Agenda (tags)
          const cAgenda = document.createElement('div');
          cAgenda.className = 'task-cell';
          const rich = buildTagRichInput(values.agenda, values.tagIds, 'Agenda (#tag)', v => {
            values.agenda = v.text;
            values.tagIds = v.tagIds;
          });
          if (invalidFields.includes('agenda')) rich.editor.classList.add('field-invalid');
          cAgenda.appendChild(rich.wrap);
          fieldsMap.agenda = rich.editor;
          row.appendChild(cAgenda);

          // Organizer
          const cOrg = document.createElement('div');
          cOrg.className = 'task-cell';
          const inOrg = document.createElement('input');
          inOrg.type = 'text';
          inOrg.className = 'field-input' + (invalidFields.includes('organizer') ? ' field-invalid' : '');
          inOrg.placeholder = 'Organizer';
          inOrg.value = values.organizer;
          inOrg.addEventListener('input', () => { values.organizer = inOrg.value; });
          cOrg.appendChild(inOrg);
          fieldsMap.organizer = inOrg;
          row.appendChild(cOrg);

          // Date (DDMM)
          const cDate = document.createElement('div');
          cDate.className = 'task-cell';
          const dateWrap = document.createElement('div');
          dateWrap.className = 'mask-wrap';
          const inDate = document.createElement('input');
          inDate.type = 'text';
          inDate.inputMode = 'numeric';
          inDate.className = 'field-input mask-input' + (invalidFields.includes('date') ? ' field-invalid' : '');
          inDate.value = values.dateDigits;
          const dateDisp = document.createElement('div');
          dateDisp.className = 'mask-display';
          dateWrap.appendChild(inDate);
          dateWrap.appendChild(dateDisp);
          attachMaskedDigitsInput(inDate, dateDisp, 'date', d => { values.dateDigits = d; });
          cDate.appendChild(dateWrap);
          fieldsMap.date = inDate;
          row.appendChild(cDate);

          // Time (Start + Optional End)
          const cTime = document.createElement('div');
          cTime.className = 'task-cell';
          const tGroup = document.createElement('div');
          tGroup.className = 'goal-input-group';

          const startWrap = document.createElement('div');
          startWrap.className = 'mask-wrap';
          const inStart = document.createElement('input');
          inStart.type = 'text';
          inStart.inputMode = 'numeric';
          inStart.className = 'field-input mask-input' + (invalidFields.includes('start') ? ' field-invalid' : '');
          inStart.value = values.startDigits;
          const startDisp = document.createElement('div');
          startDisp.className = 'mask-display';
          startWrap.appendChild(inStart);
          startWrap.appendChild(startDisp);
          attachMaskedDigitsInput(inStart, startDisp, 'time', d => { values.startDigits = d; });

          const endWrap = document.createElement('div');
          endWrap.className = 'mask-wrap';
          const inEnd = document.createElement('input');
          inEnd.type = 'text';
          inEnd.inputMode = 'numeric';
          inEnd.className = 'field-input mask-input' + (invalidFields.includes('end') ? ' field-invalid' : '');
          inEnd.value = values.endDigits;
          const endDisp = document.createElement('div');
          endDisp.className = 'mask-display';
          endWrap.appendChild(inEnd);
          endWrap.appendChild(endDisp);
          attachMaskedDigitsInput(inEnd, endDisp, 'time', d => { values.endDigits = d; });

          tGroup.appendChild(startWrap);
          tGroup.appendChild(endWrap);
          cTime.appendChild(tGroup);
          fieldsMap.time = inStart;
          row.appendChild(cTime);

          // Attendance, Rating, Starts in placeholders
          ['—', '—', '—'].forEach(txt => {
            const c = document.createElement('div');
            c.className = 'task-cell';
            c.textContent = txt;
            row.appendChild(c);
          });
        } else {
          // other
          const cTask = document.createElement('div');
          cTask.className = 'task-cell';
          const inTask = document.createElement('input');
          inTask.type = 'text';
          inTask.className = 'field-input' + (invalidFields.includes('task') ? ' field-invalid' : '');
          inTask.placeholder = 'Task';
          inTask.value = values.task;
          inTask.addEventListener('input', () => { values.task = inTask.value; });
          cTask.appendChild(inTask);
          fieldsMap.task = inTask;
          row.appendChild(cTask);

          const cDetail = document.createElement('div');
          cDetail.className = 'task-cell';
          const rich = buildTagRichInput(values.detail, values.tagIds, 'Detail (#tag)', v => {
            values.detail = v.text;
            values.tagIds = v.tagIds;
          });
          if (invalidFields.includes('detail')) rich.editor.classList.add('field-invalid');
          cDetail.appendChild(rich.wrap);
          fieldsMap.detail = rich.editor;
          row.appendChild(cDetail);

          const cDeadline = document.createElement('div');
          cDeadline.className = 'task-cell';
          const dlWrap = document.createElement('div');
          dlWrap.className = 'mask-wrap';
          const inDl = document.createElement('input');
          inDl.type = 'text';
          inDl.inputMode = 'numeric';
          inDl.className = 'field-input mask-input' + (invalidFields.includes('deadline') ? ' field-invalid' : '');
          inDl.value = values.deadlineDigits;
          const dlDisp = document.createElement('div');
          dlDisp.className = 'mask-display';
          dlWrap.appendChild(inDl);
          dlWrap.appendChild(dlDisp);
          attachMaskedDigitsInput(inDl, dlDisp, 'date', d => { values.deadlineDigits = d; });
          cDeadline.appendChild(dlWrap);
          fieldsMap.deadline = inDl;
          row.appendChild(cDeadline);

          ['—', '—'].forEach(txt => {
            const c = document.createElement('div');
            c.className = 'task-cell';
            c.textContent = txt;
            row.appendChild(c);
          });
        }

        block.appendChild(row);

        if (errorMsg) {
          const err = document.createElement('div');
          err.className = 'draft-error';
          err.textContent = errorMsg;
          block.appendChild(err);
        }

        const actions = document.createElement('div');
        actions.className = 'draft-actions';
        const discardBtn = document.createElement('button');
        discardBtn.type = 'button';
        discardBtn.className = 'text-btn';
        discardBtn.textContent = 'Discard';
        discardBtn.addEventListener('click', onDiscard);

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'text-btn btn-primary';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', onSave);

        actions.appendChild(discardBtn);
        actions.appendChild(saveBtn);
        block.appendChild(actions);

        if (focusField && fieldsMap[focusField]) {
          requestAnimationFrame(() => {
            const target = fieldsMap[focusField];
            target.focus();
            if (target.setSelectionRange && target.value) {
              const len = target.value.length;
              target.setSelectionRange(len, len);
            } else if (target.isContentEditable) {
              const range = document.createRange();
              range.selectNodeContents(target);
              range.collapse(false);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }
          });
        }

        return block;
      }

      function buildTaskFromValues(route, values, existing) {
        const istYear = now().year;
        const maxOrder = state[route].reduce((m, t) => Math.max(m, t.order ?? 0), -1);
        const order = existing ? existing.order : maxOrder + 1;
        const id = existing ? existing.id : uuid();

        if (route === 'daily') {
          const goalChanged = existing && existing.goalType !== values.goalType;
          return {
            id,
            task: values.task.trim(),
            detail: values.detail.trim(),
            tagIds: [...values.tagIds],
            goalType: values.goalType,
            goal: values.goalType === 'numeric' ? String(parseInt(values.goal.trim(), 10)) : values.goal.trim(),
            completed: existing ? (goalChanged ? false : existing.completed) : false,
            order
          };
        }
        if (route === 'weekly') {
          const goalChanged = existing && existing.goalType !== values.goalType;
          const nextGoal = values.goalType === 'nonrecurring'
            ? '1'
            : (values.goalType === 'recurring' ? String(parseInt(values.goal.trim(), 10)) : values.goal.trim());
          let completion = existing && !goalChanged ? (existing.completion || 0) : 0;
          let completed = existing && !goalChanged ? !!existing.completed : false;
          if (values.goalType === 'recurring') {
            const gNum = parseInt(nextGoal, 10);
            if (completion > gNum) completion = gNum;
            completed = completion >= gNum;
          }
          return {
            id,
            task: values.task.trim(),
            detail: values.detail.trim(),
            tagIds: [...values.tagIds],
            goalType: values.goalType,
            goal: nextGoal,
            dailyGoal: (values.dailyGoal || '').trim(),
            completion,
            completed,
            thisWeekOnly: !!values.thisWeekOnly,
            order
          };
        }
        if (route === 'events') {
          const dd = parseInt(values.dateDigits.slice(0, 2), 10);
          const mm = parseInt(values.dateDigits.slice(2, 4), 10);
          const sh = values.startDigits.slice(0, 2);
          const sm = values.startDigits.slice(2, 4);
          const endStr = values.endDigits.length === 4
            ? `${values.endDigits.slice(0, 2)}:${values.endDigits.slice(2, 4)}`
            : null;
          return {
            id,
            agenda: values.agenda.trim(),
            tagIds: [...values.tagIds],
            organizer: values.organizer.trim(),
            date: toISODate(istYear, mm, dd),
            start: `${sh}:${sm}`,
            end: endStr,
            attended: existing ? !!existing.attended : false,
            rating: existing ? existing.rating : null,
            order
          };
        }
        // other
        const dd = parseInt(values.deadlineDigits.slice(0, 2), 10);
        const mm = parseInt(values.deadlineDigits.slice(2, 4), 10);
        return {
          id,
          task: values.task.trim(),
          detail: values.detail.trim(),
          tagIds: [...values.tagIds],
          deadline: toISODate(istYear, mm, dd),
          completed: existing ? !!existing.completed : false,
          completedDate: existing ? existing.completedDate : null,
          order
        };
      }

      /* ===== Render Task Table ===== */
      function renderTagsChipsHtml(tagIds) {
        if (!Array.isArray(tagIds) || !tagIds.length) return '';
        const chips = tagIds
          .map(id => getTagById(id))
          .filter(Boolean)
          .map(tag => `<span class="inline-tag-chip" style="${getTagStyle(tag)}">${escapeHtml(tag.name)}</span>`)
          .join('');
        return chips ? `<div class="cell-tags-row">${chips}</div>` : '';
      }

      function renderTaskList(prevRects) {
        if (!ROUTES.includes(currentRoute)) return;
        const table = document.getElementById('task-table');
        table.innerHTML = '';
        const route = currentRoute;
        const n = now();
        const today = toISODate(n.year, n.month, n.day);
        const isEdit = editMode[route];

        // Header Row (exact column headers)
        const headersMap = {
          daily: ['S. no.', 'Task', 'Details', 'Completion', 'Weekly Goal'],
          weekly: ['S. no.', 'Task', 'Details', 'Progress', 'Completion', 'Goal', 'Daily Goal'],
          events: ['S. no.', 'Agenda', 'Organizer', 'Date', 'Time', 'Attendance', 'Rating', 'Starts in'],
          other: ['S. no.', 'Task', 'Detail', 'Deadline', 'Completion', 'Due in']
        };
        const hdrRow = document.createElement('div');
        hdrRow.className = `task-header-row cols-${route}`;
        headersMap[route].forEach(h => {
          const cell = document.createElement('div');
          cell.textContent = h;
          hdrRow.appendChild(cell);
        });
        table.appendChild(hdrRow);

        const items = getSortedFilteredTasks(route);
        const routeDrafts = openDrafts.filter(d => d.route === route);

        if (items.length === 0 && routeDrafts.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'No tasks here';
          table.appendChild(empty);
        }

        items.forEach((task, index) => {
          // If this task is open for inline edit
          if (isEdit && openEdits[task.id] && openEdits[task.id].route === route) {
            const editState = openEdits[task.id];
            const formBlock = renderInlineFormBlock({
              route,
              values: editState.values,
              invalidFields: editState.invalidFields || [],
              errorMsg: editState.error || '',
              focusField: editState.focusField,
              snoLabel: String(index + 1),
              onDiscard: () => {
                delete openEdits[task.id];
                renderTaskList();
              },
              onSave: () => {
                const res = validateForm(route, editState.values);
                if (!res.ok) {
                  editState.invalidFields = res.invalid;
                  editState.error = res.message;
                  renderTaskList();
                  return;
                }
                const snap = state[route];
                pushUndo(route, snap);
                const updated = buildTaskFromValues(route, editState.values, task);
                const idx = state[route].findIndex(t => t.id === task.id);
                if (idx !== -1) state[route][idx] = updated;
                delete openEdits[task.id];
                saveState(state);
                const rects = capturePositions();
                renderTaskList(rects);
              }
            });
            table.appendChild(formBlock);
            return;
          }

          const row = document.createElement('div');
          row.className = `task-row cols-${route}`;
          row.dataset.id = task.id;

          const hasHP = Array.isArray(task.tagIds) && task.tagIds.includes('high-priority');
          const ended = route === 'events' ? isEventEnded(task, n) : false;
          const completed = route === 'events' ? false : !!task.completed;

          if (completed) row.classList.add('is-dimmed');
          if (ended) row.classList.add('is-ended');
          if (hasHP && !completed && !ended) row.classList.add('is-high-priority');
          if (route === 'other' && !completed && diffCalendarDays(task.deadline, today) <= 2) {
            row.classList.add('is-deadline-urgent');
          }
          if (isEdit) row.classList.add('is-edit-mode');

          // S. no. cell
          const cSno = document.createElement('div');
          cSno.className = 'task-cell';
          if (isEdit) {
            const wrap = document.createElement('div');
            wrap.className = 'sno-edit-controls';
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'mini-icon-btn delete-btn';
            delBtn.setAttribute('aria-label', 'Delete');
            delBtn.innerHTML = ICONS.bin;
            delBtn.addEventListener('click', e => {
              e.stopPropagation();
              pushUndo(route, state[route]);
              state[route] = state[route].filter(t => t.id !== task.id);
              delete openEdits[task.id];
              saveState(state);
              renderTaskList();
            });

            const gripBtn = document.createElement('button');
            gripBtn.type = 'button';
            gripBtn.className = 'mini-icon-btn drag-grip';
            gripBtn.setAttribute('aria-label', 'Reorder');
            gripBtn.innerHTML = ICONS.grip;
            attachRowDrag(gripBtn, row, task, route);

            wrap.appendChild(delBtn);
            wrap.appendChild(gripBtn);
            cSno.appendChild(wrap);
          } else {
            cSno.textContent = String(index + 1);
          }
          row.appendChild(cSno);

          function makeEditableCell(fieldKey, contentEl) {
            contentEl.classList.add('task-cell');
            if (isEdit) {
              contentEl.classList.add('editable-cell');
              contentEl.addEventListener('click', e => {
                if (e.target.closest('button, input')) return;
                openEdits[task.id] = {
                  route,
                  focusField: fieldKey,
                  values: taskToFormValues(route, task),
                  error: '',
                  invalidFields: []
                };
                renderTaskList();
              });
            }
            return contentEl;
          }

          if (route === 'daily') {
            const cTask = document.createElement('div');
            cTask.textContent = task.task;
            row.appendChild(makeEditableCell('task', cTask));

            const cDet = document.createElement('div');
            cDet.innerHTML = (task.detail ? `<span>${escapeHtml(task.detail)}</span>` : '') + renderTagsChipsHtml(task.tagIds);
            row.appendChild(makeEditableCell('detail', cDet));

            const cComp = document.createElement('div');
            cComp.className = 'task-cell';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'm3-checkbox';
            cb.checked = !!task.completed;
            cb.setAttribute('aria-label', `Mark ${task.task} complete`);
            cb.addEventListener('change', () => {
              const rects = capturePositions();
              task.completed = cb.checked;
              saveState(state);
              if (cb.checked) {
                cb.classList.add('pop');
                fireConfettiFromElement(cb);
              }
              setTimeout(() => renderTaskList(rects), cb.checked && !prefersReducedMotion() ? 180 : 0);
            });
            cComp.appendChild(cb);
            row.appendChild(cComp);

            const cGoal = document.createElement('div');
            cGoal.textContent = task.goal;
            row.appendChild(makeEditableCell('goal', cGoal));
          } else if (route === 'weekly') {
            const cTask = document.createElement('div');
            cTask.textContent = task.task;
            row.appendChild(makeEditableCell('task', cTask));

            const cDet = document.createElement('div');
            cDet.innerHTML = (task.detail ? `<span>${escapeHtml(task.detail)}</span>` : '') + renderTagsChipsHtml(task.tagIds);
            row.appendChild(makeEditableCell('detail', cDet));

            // Progress cell
            const cProg = document.createElement('div');
            cProg.className = 'task-cell';
            if (task.goalType === 'recurring') {
              const gNum = Math.max(2, parseInt(task.goal, 10) || 2);
              const comp = Math.min(gNum, Math.max(0, task.completion || 0));
              const pct = Math.floor((comp / gNum) * 100);
              const barWrap = document.createElement('div');
              barWrap.className = 'progress-wrap' + (comp >= gNum ? ' is-complete' : '');
              const fill = document.createElement('div');
              fill.className = 'progress-fill';
              fill.style.width = `${(comp / gNum) * 100}%`;
              const txt = document.createElement('span');
              txt.className = 'progress-text';
              txt.textContent = comp === 0 ? 'Not Started' : (comp >= gNum ? 'Completed' : `${pct}%`);
              barWrap.appendChild(fill);
              barWrap.appendChild(txt);
              cProg.appendChild(barWrap);
            } else {
              cProg.textContent = '—';
            }
            row.appendChild(cProg);

            // Completion cell
            const cComp = document.createElement('div');
            cComp.className = 'task-cell';
            if (task.goalType === 'recurring') {
              const gNum = Math.max(2, parseInt(task.goal, 10) || 2);
              const stepper = document.createElement('div');
              stepper.className = 'stepper';
              const minus = document.createElement('button');
              minus.type = 'button';
              minus.className = 'stepper-btn';
              minus.textContent = '−';
              minus.setAttribute('aria-label', 'Decrement completion');
              minus.disabled = (task.completion || 0) <= 0;

              const val = document.createElement('span');
              val.className = 'stepper-val';
              val.textContent = String(task.completion || 0);

              const plus = document.createElement('button');
              plus.type = 'button';
              plus.className = 'stepper-btn';
              plus.textContent = '+';
              plus.setAttribute('aria-label', 'Increment completion');
              plus.disabled = (task.completion || 0) >= gNum;

              minus.addEventListener('click', () => {
                const rects = capturePositions();
                task.completion = Math.max(0, (task.completion || 0) - 1);
                task.completed = task.completion >= gNum;
                saveState(state);
                renderTaskList(rects);
              });
              plus.addEventListener('click', () => {
                const rects = capturePositions();
                task.completion = Math.min(gNum, (task.completion || 0) + 1);
                const justCompleted = task.completion >= gNum && !task.completed;
                task.completed = task.completion >= gNum;
                saveState(state);
                if (justCompleted) fireConfettiFromElement(plus);
                setTimeout(() => renderTaskList(rects), justCompleted && !prefersReducedMotion() ? 180 : 0);
              });

              stepper.appendChild(minus);
              stepper.appendChild(val);
              stepper.appendChild(plus);
              cComp.appendChild(stepper);
            } else {
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.className = 'm3-checkbox';
              cb.checked = !!task.completed;
              cb.setAttribute('aria-label', `Mark ${task.task} complete`);
              cb.addEventListener('change', () => {
                const rects = capturePositions();
                task.completed = cb.checked;
                saveState(state);
                if (cb.checked) {
                  cb.classList.add('pop');
                  fireConfettiFromElement(cb);
                }
                setTimeout(() => renderTaskList(rects), cb.checked && !prefersReducedMotion() ? 180 : 0);
              });
              cComp.appendChild(cb);
            }
            row.appendChild(cComp);

            const cGoal = document.createElement('div');
            cGoal.textContent = task.goalType === 'nonrecurring' ? '1' : String(task.goal);
            row.appendChild(makeEditableCell('goal', cGoal));

            const cDailyGoal = document.createElement('div');
            cDailyGoal.textContent = task.dailyGoal ? task.dailyGoal : '—';
            row.appendChild(makeEditableCell('dailyGoal', cDailyGoal));
          } else if (route === 'events') {
            const cAgenda = document.createElement('div');
            cAgenda.innerHTML = (task.agenda ? `<span>${escapeHtml(task.agenda)}</span>` : '') + renderTagsChipsHtml(task.tagIds);
            row.appendChild(makeEditableCell('agenda', cAgenda));

            const cOrg = document.createElement('div');
            cOrg.textContent = task.organizer;
            row.appendChild(makeEditableCell('organizer', cOrg));

            const cDate = document.createElement('div');
            cDate.textContent = formatDisplayDate(task.date);
            row.appendChild(makeEditableCell('date', cDate));

            const cTime = document.createElement('div');
            cTime.textContent = task.end
              ? `${formatDisplayTime(task.start)} – ${formatDisplayTime(task.end)}`
              : `${formatDisplayTime(task.start)} onwards`;
            row.appendChild(makeEditableCell('time', cTime));

            const locked = isEventLocked(task, n);

            // Attendance
            const cAtt = document.createElement('div');
            cAtt.className = 'task-cell';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'm3-checkbox';
            cb.checked = !!task.attended;
            cb.disabled = locked;
            cb.setAttribute('aria-label', `Mark attendance for ${task.agenda || 'event'}`);
            cb.addEventListener('change', () => {
              task.attended = cb.checked;
              saveState(state);
              if (cb.checked) {
                cb.classList.add('pop');
                fireConfettiFromElement(cb);
              }
            });
            cAtt.appendChild(cb);
            row.appendChild(cAtt);

            // Rating
            const cRat = document.createElement('div');
            cRat.className = 'task-cell';
            if (!locked && activeRatingId === task.id) {
              const inp = document.createElement('input');
              inp.type = 'text';
              inp.className = 'rating-inline-input';
              inp.value = task.rating !== null && task.rating !== undefined ? String(task.rating) : '';
              inp.placeholder = '0-10';
              let committed = false;
              function commitRating() {
                if (committed) return;
                committed = true;
                const raw = inp.value.trim();
                if (raw === '') {
                  task.rating = null;
                  activeRatingId = null;
                  saveState(state);
                  renderTaskList();
                  return;
                }
                const num = Number(raw);
                if (!Number.isFinite(num) || num < 0 || num > 10) {
                  activeRatingId = null;
                  renderTaskList();
                  const cell = document.querySelector(`.task-row[data-id="${task.id}"] .rating-cell-btn`);
                  if (cell) cell.classList.add('shake');
                  return;
                }
                task.rating = num;
                activeRatingId = null;
                saveState(state);
                renderTaskList();
              }
              inp.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRating(); }
                if (e.key === 'Escape') { committed = true; activeRatingId = null; renderTaskList(); }
              });
              inp.addEventListener('blur', commitRating);
              cRat.appendChild(inp);
              requestAnimationFrame(() => { inp.focus(); inp.select(); });
            } else {
              const rBtn = document.createElement('button');
              rBtn.type = 'button';
              rBtn.className = 'rating-cell-btn';
              rBtn.disabled = locked;
              rBtn.textContent = task.rating !== null && task.rating !== undefined ? `${task.rating}/10` : '—';
              rBtn.setAttribute('aria-label', 'Edit rating');
              rBtn.addEventListener('click', () => {
                activeRatingId = task.id;
                renderTaskList();
              });
              cRat.appendChild(rBtn);
            }
            row.appendChild(cRat);

            // Starts in
            const cStarts = document.createElement('div');
            cStarts.className = 'task-cell';
            cStarts.textContent = computeStartsIn(task, n);
            row.appendChild(cStarts);
          } else {
            // other
            const cTask = document.createElement('div');
            cTask.textContent = task.task;
            row.appendChild(makeEditableCell('task', cTask));

            const cDet = document.createElement('div');
            cDet.innerHTML = (task.detail ? `<span>${escapeHtml(task.detail)}</span>` : '') + renderTagsChipsHtml(task.tagIds);
            row.appendChild(makeEditableCell('detail', cDet));

            const cDl = document.createElement('div');
            cDl.textContent = formatDisplayDate(task.deadline);
            row.appendChild(makeEditableCell('deadline', cDl));

            const cComp = document.createElement('div');
            cComp.className = 'task-cell';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'm3-checkbox';
            cb.checked = !!task.completed;
            cb.setAttribute('aria-label', `Mark ${task.task} complete`);
            cb.addEventListener('change', () => {
              const rects = capturePositions();
              task.completed = cb.checked;
              task.completedDate = cb.checked ? todayISO() : null;
              saveState(state);
              if (cb.checked) {
                cb.classList.add('pop');
                fireConfettiFromElement(cb);
              }
              setTimeout(() => renderTaskList(rects), cb.checked && !prefersReducedMotion() ? 180 : 0);
            });
            cComp.appendChild(cb);
            row.appendChild(cComp);

            const due = computeDueIn(task, today);
            const cDue = document.createElement('div');
            cDue.className = `task-cell ${due.cls}`;
            cDue.textContent = due.text;
            row.appendChild(cDue);
          }

          table.appendChild(row);
        });

        // Weekly Total Progress summary row
        if (route === 'weekly' && items.length > 0) {
          const totalTasks = items.length;
          const completedTasks = items.filter(t => !!t.completed).length;
          const sumCompletion = items.reduce((acc, t) => {
            if (t.goalType === 'recurring') {
              const g = parseInt(t.goal, 10) || 0;
              return acc + Math.max(0, Math.min(g, t.completion || 0));
            }
            return acc + (t.completed ? 1 : 0);
          }, 0);
          const sumGoal = items.reduce((acc, t) => {
            if (t.goalType === 'recurring' || t.goalType === 'nonrecurring') {
              const g = parseInt(t.goal, 10);
              return acc + (Number.isFinite(g) ? g : 0);
            }
            return acc + 1;
          }, 0);
          const totalPct = sumGoal > 0 ? Math.floor((sumCompletion / sumGoal) * 100) : 0;
          const sumDailyGoal = items.reduce((acc, t) => {
            const val = parseDailyGoalValue(t.dailyGoal);
            return acc + (val !== null ? val : 0);
          }, 0);
          const sumDailyFormatted = Number.isInteger(sumDailyGoal)
            ? String(sumDailyGoal)
            : String(Number(sumDailyGoal.toFixed(2)));

          const totalRow = document.createElement('div');
          totalRow.className = 'total-progress-row cols-weekly';

          const tSno = document.createElement('div');
          tSno.className = 'task-cell';
          tSno.textContent = '—';
          totalRow.appendChild(tSno);

          const tLabel = document.createElement('div');
          tLabel.className = 'task-cell';
          tLabel.textContent = 'Total Progress';
          totalRow.appendChild(tLabel);

          const tDet = document.createElement('div');
          tDet.className = 'task-cell';
          tDet.textContent = `${completedTasks} of ${totalTasks} tasks completed`;
          totalRow.appendChild(tDet);

          const tProg = document.createElement('div');
          tProg.className = 'task-cell';
          const barWrap = document.createElement('div');
          barWrap.className = 'progress-wrap' + (sumGoal > 0 && sumCompletion >= sumGoal ? ' is-complete' : '');
          const fill = document.createElement('div');
          fill.className = 'progress-fill';
          fill.style.width = `${sumGoal > 0 ? Math.min(100, (sumCompletion / sumGoal) * 100) : 0}%`;
          const txt = document.createElement('span');
          txt.className = 'progress-text';
          txt.textContent = sumCompletion === 0 ? 'Not Started' : (sumCompletion >= sumGoal ? 'Completed' : `${totalPct}%`);
          barWrap.appendChild(fill);
          barWrap.appendChild(txt);
          tProg.appendChild(barWrap);
          totalRow.appendChild(tProg);

          const tComp = document.createElement('div');
          tComp.className = 'task-cell';
          tComp.textContent = String(sumCompletion);
          totalRow.appendChild(tComp);

          const tGoal = document.createElement('div');
          tGoal.className = 'task-cell';
          tGoal.textContent = sumGoal > 0 ? String(sumGoal) : '—';
          totalRow.appendChild(tGoal);

          const tDaily = document.createElement('div');
          tDaily.className = 'task-cell';
          tDaily.textContent = sumDailyFormatted;
          totalRow.appendChild(tDaily);

          table.appendChild(totalRow);
        }

        // Open Drafts at bottom (6.4)
        routeDrafts.forEach((draft, dIdx) => {
          const formBlock = renderInlineFormBlock({
            route,
            values: draft.values,
            invalidFields: draft.invalidFields || [],
            errorMsg: draft.error || '',
            focusField: dIdx === routeDrafts.length - 1 ? (route === 'events' ? 'agenda' : 'task') : null,
            snoLabel: String(items.length + dIdx + 1),
            onDiscard: () => {
              openDrafts = openDrafts.filter(d => d.draftId !== draft.draftId);
              renderTaskList();
            },
            onSave: () => {
              const res = validateForm(route, draft.values);
              if (!res.ok) {
                draft.invalidFields = res.invalid;
                draft.error = res.message;
                renderTaskList();
                return;
              }
              if (editMode[route]) pushUndo(route, state[route]);
              const newTask = buildTaskFromValues(route, draft.values, null);
              state[route].push(newTask);
              openDrafts = openDrafts.filter(d => d.draftId !== draft.draftId);
              saveState(state);
              const rects = capturePositions();
              renderTaskList(rects);
              const newRow = document.querySelector(`.task-row[data-id="${newTask.id}"]`);
              if (newRow) newRow.classList.add('row-adding');
            }
          });
          table.appendChild(formBlock);
        });

        if (prevRects) playFLIP(prevRects);
      }

      /* ===== Row Drag Reorder (6.6) ===== */
      function attachRowDrag(gripBtn, rowEl, task, route) {
        let pressTimer = null;
        let dragging = false;
        let startY = 0;

        gripBtn.addEventListener('pointerdown', e => {
          e.preventDefault();
          e.stopPropagation();
          startY = e.clientY;
          gripBtn.setPointerCapture(e.pointerId);

          pressTimer = setTimeout(() => {
            dragging = true;
            rowEl.classList.add('is-dragging');
          }, 120);

          function onMove(ev) {
            if (!dragging) return;
            const dy = ev.clientY - startY;
            rowEl.style.transform = `translateY(${dy}px)`;
          }

          function onUp(ev) {
            clearTimeout(pressTimer);
            gripBtn.removeEventListener('pointermove', onMove);
            gripBtn.removeEventListener('pointerup', onUp);
            gripBtn.removeEventListener('pointercancel', onUp);
            if (!dragging) return;
            dragging = false;
            rowEl.classList.remove('is-dragging');
            rowEl.style.transform = '';

            // Determine drop target within same group
            const n = now();
            const myGroup = getTaskGroup(route, task, n);
            const visibleRows = Array.from(document.querySelectorAll('.task-row[data-id]'));
            const visibleIds = visibleRows.map(r => r.dataset.id);
            const dropY = ev.clientY;

            // Filter to same group
            const sameGroupRows = visibleRows.filter(r => {
              const t = state[route].find(x => x.id === r.dataset.id);
              return t && getTaskGroup(route, t, n) === myGroup;
            });

            if (sameGroupRows.length < 2) return;

            let targetIdx = sameGroupRows.length - 1;
            for (let i = 0; i < sameGroupRows.length; i++) {
              const rect = sameGroupRows[i].getBoundingClientRect();
              if (dropY < rect.top + rect.height / 2) {
                targetIdx = i;
                break;
              }
            }

            const sameGroupIds = sameGroupRows.map(r => r.dataset.id);
            const fromIdx = sameGroupIds.indexOf(task.id);
            if (fromIdx === -1 || fromIdx === targetIdx) return;

            pushUndo(route, state[route]);

            // Reorder within visible subset slots (6.6)
            const reorderedIds = sameGroupIds.slice();
            const [moved] = reorderedIds.splice(fromIdx, 1);
            reorderedIds.splice(targetIdx, 0, moved);

            const originalOrders = sameGroupIds.map(id => state[route].find(t => t.id === id).order).sort((a, b) => a - b);
            reorderedIds.forEach((id, idx) => {
              const item = state[route].find(t => t.id === id);
              if (item) item.order = originalOrders[idx];
            });

            saveState(state);
            const rects = capturePositions();
            renderTaskList(rects);
          }

          gripBtn.addEventListener('pointermove', onMove);
          gripBtn.addEventListener('pointerup', onUp);
          gripBtn.addEventListener('pointercancel', onUp);
        });
      }

      /* ===== Tags Grid, Drag Reorder & Filtering (9.1 - 9.6) ===== */
      function renderTagsGrid() {
        const grid = document.getElementById('tags-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const sortedTags = state.tags.slice().sort((a, b) => a.order - b.order);

        sortedTags.forEach(tag => {
          const tile = document.createElement('div');
          tile.className = 'tag-tile' + (state.activeTagFilter === tag.id ? ' is-active-filter' : '');
          tile.dataset.tagId = tag.id;
          tile.setAttribute('style', getTagStyle(tag));

          const nameSpan = document.createElement('span');
          nameSpan.className = 'tag-name-text';
          nameSpan.textContent = tag.name;
          tile.appendChild(nameSpan);

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'tag-edit-btn';
          editBtn.setAttribute('aria-label', `Edit tag ${tag.name}`);
          editBtn.innerHTML = ICONS.pen;
          editBtn.addEventListener('click', e => {
            e.stopPropagation();
            openTagEditor(tag.id);
          });
          tile.appendChild(editBtn);

          // Press-and-hold (300ms+) to drag, short click to filter (9.2, 9.6)
          let holdTimer = null;
          let isDragging = false;
          let startX = 0, startY = 0;

          tile.addEventListener('pointerdown', e => {
            if (e.target.closest('.tag-edit-btn')) return;
            startX = e.clientX;
            startY = e.clientY;
            tile.setPointerCapture(e.pointerId);

            holdTimer = setTimeout(() => {
              isDragging = true;
              tile.classList.add('is-dragging');
            }, 300);

            function onMove(ev) {
              if (!isDragging) {
                if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) {
                  clearTimeout(holdTimer);
                }
                return;
              }
              tile.style.transform = `translate(${ev.clientX - startX}px, ${ev.clientY - startY}px)`;
            }

            function onUp(ev) {
              clearTimeout(holdTimer);
              tile.removeEventListener('pointermove', onMove);
              tile.removeEventListener('pointerup', onUp);
              tile.removeEventListener('pointercancel', onUp);

              if (isDragging) {
                isDragging = false;
                tile.classList.remove('is-dragging');
                tile.style.transform = '';

                const tiles = Array.from(grid.querySelectorAll('.tag-tile[data-tag-id]'));
                let targetId = null;
                for (const t of tiles) {
                  const r = t.getBoundingClientRect();
                  if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
                    targetId = t.dataset.tagId;
                    break;
                  }
                }
                if (targetId && targetId !== tag.id) {
                  const ordered = state.tags.slice().sort((a, b) => a.order - b.order);
                  const fromI = ordered.findIndex(x => x.id === tag.id);
                  const toI = ordered.findIndex(x => x.id === targetId);
                  if (fromI !== -1 && toI !== -1) {
                    const [moved] = ordered.splice(fromI, 1);
                    ordered.splice(toI, 0, moved);
                    ordered.forEach((t, i) => { t.order = i; });
                    saveState(state);
                    renderTagsGrid();
                  }
                }
              } else {
                // Short click: toggle filter
                state.activeTagFilter = state.activeTagFilter === tag.id ? null : tag.id;
                saveState(state);
                renderTagsGrid();
                renderTaskList();
              }
            }

            tile.addEventListener('pointermove', onMove);
            tile.addEventListener('pointerup', onUp);
            tile.addEventListener('pointercancel', onUp);
          });

          grid.appendChild(tile);
        });

        // '+' tile at the end of the grid (9.2, DEC-09)
        const addTile = document.createElement('button');
        addTile.type = 'button';
        addTile.className = 'tag-add-tile';
        addTile.setAttribute('aria-label', 'Add Tag');
        addTile.innerHTML = ICONS.plus;
        addTile.addEventListener('click', () => openTagEditor(null));
        grid.appendChild(addTile);
      }

      /* ===== Tag Editor Pop-up (9.3) ===== */
      function renderTagColorGrid() {
        const grid = document.getElementById('tag-color-grid');
        grid.innerHTML = '';
        Object.keys(TAG_COLORS).forEach(key => {
          const colorDef = TAG_COLORS[key];
          const pair = state.theme === 'dark' ? colorDef.dark : colorDef.light;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tag-color-swatch' + (selectedTagColor === key ? ' is-selected' : '');
          btn.style.backgroundColor = pair.bg;
          btn.style.color = pair.text;
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', selectedTagColor === key ? 'true' : 'false');
          btn.setAttribute('aria-label', colorDef.label);
          if (selectedTagColor === key) {
            btn.innerHTML = ICONS.check;
          }
          btn.addEventListener('click', () => {
            selectedTagColor = key;
            renderTagColorGrid();
          });
          grid.appendChild(btn);
        });
      }

      function openTagEditor(tagId) {
        editingTagId = tagId;
        const backdrop = document.getElementById('tag-editor-backdrop');
        const titleEl = document.getElementById('tag-editor-title');
        const nameInput = document.getElementById('tag-name-input');
        const delBtn = document.getElementById('tag-delete-btn');
        const errEl = document.getElementById('tag-editor-error');

        errEl.style.display = 'none';
        errEl.textContent = '';

        if (tagId) {
          const tag = getTagById(tagId);
          titleEl.textContent = 'Edit Tag';
          nameInput.value = tag.name;
          selectedTagColor = TAG_COLORS[tag.colorKey] ? tag.colorKey : 'blue';
          delBtn.style.display = tag.id === 'high-priority' ? 'none' : 'inline-flex';
        } else {
          titleEl.textContent = 'New Tag';
          nameInput.value = '';
          selectedTagColor = 'blue';
          delBtn.style.display = 'none';
        }

        renderTagColorGrid();
        backdrop.classList.add('open');
        requestAnimationFrame(() => nameInput.focus());
      }

      function closeTagEditor() {
        document.getElementById('tag-editor-backdrop').classList.remove('open');
        editingTagId = null;
      }

      function saveTagEditor() {
        const nameInput = document.getElementById('tag-name-input');
        const errEl = document.getElementById('tag-editor-error');

        const rawName = nameInput.value.trim();
        if (!rawName || !/^[A-Za-z0-9 _-]+$/.test(rawName)) {
          errEl.textContent = 'Tag name is required and may only contain letters, digits, spaces, - or _.';
          errEl.style.display = 'block';
          return;
        }
        const dup = state.tags.find(t => t.name.toLowerCase() === rawName.toLowerCase() && t.id !== editingTagId);
        if (dup) {
          errEl.textContent = 'A tag with that name already exists.';
          errEl.style.display = 'block';
          return;
        }

        if (editingTagId) {
          const tag = getTagById(editingTagId);
          if (tag) {
            tag.name = rawName;
            tag.colorKey = selectedTagColor;
          }
        } else {
          const maxOrder = state.tags.reduce((m, t) => Math.max(m, t.order ?? 0), -1);
          state.tags.push({
            id: uuid(),
            name: rawName,
            colorKey: selectedTagColor,
            order: maxOrder + 1
          });
        }

        saveState(state);
        closeTagEditor();
        renderTagsGrid();
        renderTaskList();
      }

      function deleteEditingTag() {
        if (!editingTagId || editingTagId === 'high-priority') return;
        const delId = editingTagId;
        ROUTES.forEach(r => {
          state[r].forEach(t => {
            if (Array.isArray(t.tagIds)) {
              t.tagIds = t.tagIds.filter(id => id !== delId);
            }
          });
        });
        state.tags = state.tags.filter(t => t.id !== delId);
        if (state.activeTagFilter === delId) state.activeTagFilter = null;
        saveState(state);
        closeTagEditor();
        renderTagsGrid();
        renderTaskList();
      }

      /* ===== Calendar Pop-up (5.3) ===== */
      function renderCalendar() {
        const n = now();
        const year = n.year;
        document.getElementById('cal-title').textContent = `${MONTHS_FULL[calendarMonth - 1]} ${year}`;
        document.getElementById('cal-prev-btn').disabled = calendarMonth <= 1;
        document.getElementById('cal-next-btn').disabled = calendarMonth >= 12;

        const daysEl = document.getElementById('cal-days');
        daysEl.innerHTML = '';

        const firstDay = new Date(Date.UTC(year, calendarMonth - 1, 1));
        const startOffset = (firstDay.getUTCDay() + 6) % 7; // Mon=0..Sun=6
        const daysInMonth = new Date(Date.UTC(year, calendarMonth, 0)).getUTCDate();

        for (let i = 0; i < startOffset; i++) {
          const empty = document.createElement('div');
          empty.className = 'cal-cell is-empty';
          daysEl.appendChild(empty);
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const cell = document.createElement('div');
          cell.className = 'cal-cell';
          if (calendarMonth === n.month && d === n.day) {
            cell.classList.add('is-today');
          }
          cell.textContent = String(d);
          daysEl.appendChild(cell);
        }
      }

      function openCalendar() {
        calendarMonth = now().month;
        renderCalendar();
        document.getElementById('calendar-backdrop').classList.add('open');
      }

      function closeCalendar() {
        document.getElementById('calendar-backdrop').classList.remove('open');
      }

      /* ===== Master Render ===== */
      function renderAll() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
          const active = btn.dataset.route === currentRoute;
          btn.classList.toggle('active', active);
        });
        const title = document.getElementById('page-title');
        if (title) title.textContent = PAGE_TITLES[currentRoute] || 'Schedule & Task Tracker';
        updateHeaderActions();
        renderTaskList();
        renderTagsGrid();
        syncRibbonHeight();
      }

      function showCloudStatus(message) {
        const button = document.getElementById('sign-out-btn');
        if (button) button.title = message;
      }

      function setAuthView(mode, message = '') {
        authMode = mode;
        document.getElementById('auth-title').textContent = mode === 'signup' ? 'Create your account' : 'Sign in to your tracker';
        document.getElementById('auth-copy').textContent = mode === 'signup' ? 'Your tracker data will be saved to this account and available on your other devices.' : 'Use your email and password to access your tasks on any device.';
        document.getElementById('auth-submit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
        document.getElementById('auth-toggle').textContent = mode === 'signup' ? 'I already have an account' : 'Create account';
        document.getElementById('auth-error').textContent = message;
        document.getElementById('auth-backdrop').classList.add('open');
      }

      async function loadAccountState(user) {
        signedInUser = user;
        document.getElementById('sign-out-btn').style.display = 'inline-flex';
        const { data, error } = await supabase.from(CLOUD_TABLE).select('state').eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        const ownerKey = `${STORAGE_KEY}_owner`;
        let cachedOwner = null;
        try { cachedOwner = localStorage.getItem(ownerKey); } catch (_) {}
        if (data && data.state && typeof data.state === 'object') {
          state = data.state;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
        } else {
          // Import legacy local data only once, so another account on this browser never inherits it.
          if (cachedOwner && cachedOwner !== user.id) state = createDefaultState();
        }
        removeLegacyStatisticsState(state);
        removeDefaultDemoData(state);
        ensureHighPriorityTag(state);
        saveState(state);
        try { localStorage.setItem(ownerKey, user.id); } catch (_) {}
        if (runRollovers()) saveState(state);
        document.getElementById('auth-backdrop').classList.remove('open');
        applyTheme();
        renderAll();
      }

      async function bootstrapAuth() {
        const configMissing = SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_ANON_KEY.includes('YOUR_');
        if (!window.supabase || configMissing) {
          setAuthView('signin', 'Account sync is not configured yet. Configure the Supabase project URL and publishable key in assets/app.js, then reload.');
          document.getElementById('auth-submit').disabled = true;
          document.getElementById('auth-toggle').disabled = true;
          return;
        }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
        document.getElementById('auth-toggle').addEventListener('click', () => setAuthView(authMode === 'signin' ? 'signup' : 'signin'));
        document.getElementById('auth-form').addEventListener('submit', async event => {
          event.preventDefault();
          const submit = document.getElementById('auth-submit');
          submit.disabled = true;
          document.getElementById('auth-error').textContent = '';
          try {
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const result = authMode === 'signup'
              ? await supabase.auth.signUp({ email, password })
              : await supabase.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            if (authMode === 'signup' && !result.data.session) {
              setAuthView('signin', 'Check your email to confirm your account, then sign in.');
              return;
            }
            if (result.data.user) await loadAccountState(result.data.user);
          } catch (error) {
            document.getElementById('auth-error').textContent = error.message || 'Could not authenticate. Please try again.';
          } finally { submit.disabled = false; }
        });
        document.getElementById('sign-out-btn').addEventListener('click', () => {
          const email = signedInUser && signedInUser.email ? signedInUser.email : 'this account';
          document.getElementById('signout-confirm-message').textContent = `Are you sure you want to sign out of ${email}?`;
          document.getElementById('signout-confirm-backdrop').classList.add('open');
        });
        document.getElementById('signout-cancel-btn').addEventListener('click', () => document.getElementById('signout-confirm-backdrop').classList.remove('open'));
        document.getElementById('signout-confirm-backdrop').addEventListener('click', event => {
          if (event.target.id === 'signout-confirm-backdrop') event.currentTarget.classList.remove('open');
        });
        document.getElementById('signout-confirm-btn').addEventListener('click', async () => {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) {
            document.getElementById('signout-confirm-message').textContent = `Could not sign out: ${signOutError.message}`;
            return;
          }
          signedInUser = null;
          document.getElementById('signout-confirm-backdrop').classList.remove('open');
          document.getElementById('sign-out-btn').style.display = 'none';
          setAuthView('signin');
        });
        const { data, error } = await supabase.auth.getSession();
        if (error) { showCloudStatus(`Could not check saved login: ${error.message}`); return; }
        if (data.session) {
          try { await loadAccountState(data.session.user); }
          catch (err) {
            showCloudStatus(`Could not load cloud data: ${err.message}`);
          }
        } else setAuthView('signin');
      }

      /* ===== Event Wiring ===== */
      function init() {
        // Static icons
        document.getElementById('edit-mode-btn').innerHTML = ICONS.pen;
        document.getElementById('add-task-btn').innerHTML = ICONS.plus;
        document.getElementById('cal-prev-btn').innerHTML = ICONS.chevLeft;
        document.getElementById('cal-next-btn').innerHTML = ICONS.chevRight;
        document.getElementById('tag-delete-btn').innerHTML = ICONS.bin;
        renderTagColorGrid();

        applyTheme();
        runRollovers();

        // Theme toggle
        document.getElementById('theme-toggle-btn').addEventListener('click', () => {
          state.theme = state.theme === 'dark' ? 'light' : 'dark';
          saveState(state);
          applyTheme();
          renderTagsGrid();
          renderTaskList();
        });

        // Edit mode toggle
        if (ROUTES.includes(currentRoute)) document.getElementById('edit-mode-btn').addEventListener('click', () => {
          const next = !editMode[currentRoute];
          editMode[currentRoute] = next;
          if (!next) {
            undoStacks[currentRoute] = [];
            redoStacks[currentRoute] = [];
            Object.keys(openEdits).forEach(k => {
              if (openEdits[k].route === currentRoute) delete openEdits[k];
            });
          }
          updateHeaderActions();
          renderTaskList();
        });

        // Undo / Redo
        if (ROUTES.includes(currentRoute)) {
          document.getElementById('undo-btn').addEventListener('click', () => performUndo(currentRoute));
          document.getElementById('redo-btn').addEventListener('click', () => performRedo(currentRoute));
        }

        // Add task (+)
        if (ROUTES.includes(currentRoute)) document.getElementById('add-task-btn').addEventListener('click', () => {
          openDrafts.push({
            draftId: uuid(),
            route: currentRoute,
            values: createDefaultFormValues(currentRoute),
            error: '',
            invalidFields: []
          });
          renderTaskList();
        });

        // Calendar pop-up
        document.getElementById('ist-date-btn').addEventListener('click', openCalendar);
        document.getElementById('cal-prev-btn').addEventListener('click', () => {
          if (calendarMonth > 1) { calendarMonth--; renderCalendar(); }
        });
        document.getElementById('cal-next-btn').addEventListener('click', () => {
          if (calendarMonth < 12) { calendarMonth++; renderCalendar(); }
        });
        document.getElementById('calendar-backdrop').addEventListener('click', e => {
          if (e.target.id === 'calendar-backdrop') closeCalendar();
        });

        // Tag Editor pop-up
        document.getElementById('tag-save-btn').addEventListener('click', saveTagEditor);
        document.getElementById('tag-discard-btn').addEventListener('click', closeTagEditor);
        document.getElementById('tag-delete-btn').addEventListener('click', deleteEditingTag);
        document.getElementById('tag-editor-backdrop').addEventListener('click', e => {
          if (e.target.id === 'tag-editor-backdrop') closeTagEditor();
        });

        // Escape closes pop-ups
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            closeCalendar();
            closeTagEditor();
            document.getElementById('signout-confirm-backdrop').classList.remove('open');
          }
        });

        // Visibility change rollover catch-up
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            if (runRollovers()) renderTaskList();
            updateClockAndDerived();
          }
        });

        window.addEventListener('resize', syncRibbonHeight);

        renderAll();
        updateClockAndDerived();
        bootstrapAuth();
        setInterval(updateClockAndDerived, 1000);
      }

      init();
    })();

/* ═══════════════════════════════════════════════════════════════════════════
   Instructor Schedule — self-contained module
   Fetches the timetable based on the secure PHP session.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

    /* ── Config ────────────────────────────────────────────────────────── */
    const API_BASE = '/backend/endpoints/instructors.schedule.php';

    const DAYS      = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const DAY_SHORT = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

    const GRID_START = 7;   // 07:00
    const GRID_END   = 20;  // 20:00
    const SLOT_MIN   = 30;
    const SLOT_PX    = 44;  // px per 30-min slot
    const TOTAL_SLOTS = ((GRID_END - GRID_START) * 60) / SLOT_MIN; // 26 slots

    /* Colour palette — system colours matching the LMS palette */
    const PALETTE = [
        { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },  // blue
        { bg:'#f0fdf4', border:'#22c55e', text:'#15803d' },  // green
        { bg:'#faf5ff', border:'#a855f7', text:'#7e22ce' },  // purple
        { bg:'#fffbeb', border:'#f59e0b', text:'#b45309' },  // amber
        { bg:'#fff1f2', border:'#f43f5e', text:'#be123c' },  // rose
        { bg:'#ecfdf5', border:'#10b981', text:'#065f46' },  // emerald
        { bg:'#fff7ed', border:'#f97316', text:'#c2410c' },  // orange
        { bg:'#f0f9ff', border:'#0ea5e9', text:'#0369a1' },  // sky
    ];

    /* State */
    const S = {
        semester     : '1st Semester',
        schoolYear   : '2025-2026',
        data         : null,
        colorMap     : {},
        colorIdx     : 0,
        activeDay    : null,
    };

    const TODAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

    /* ── Helpers ───────────────────────────────────────────────────────── */
    function toMins(t) {
        if (!t) return 0;
        let m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (m) return +m[1] * 60 + +m[2];
        m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (m) {
            let h = +m[1]; const mn = +m[2]; const mer = m[3].toUpperCase();
            if (mer === 'PM' && h !== 12) h += 12;
            if (mer === 'AM' && h === 12) h = 0;
            return h * 60 + mn;
        }
        return 0;
    }

    function fmtTime(mins) {
        let h = Math.floor(mins / 60), m = mins % 60;
        const mer = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`;
    }

    function colorFor(code) {
        if (!S.colorMap[code]) { S.colorMap[code] = PALETTE[S.colorIdx % PALETTE.length]; S.colorIdx++; }
        return S.colorMap[code];
    }

    function slotOf(mins) { return Math.round((mins - GRID_START * 60) / SLOT_MIN); }

    /* ── DOM helpers ───────────────────────────────────────────────────── */
    const $  = id  => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    function showLoader(v)  { $('schedLoader').style.display  = v ? 'flex'  : 'none'; }
    function showGrid(v)    { $('timetableScroll').style.display = v ? 'block' : 'none'; }
    function showEmpty(v)   { $('schedEmpty').style.display   = v ? 'flex'  : 'none'; }
    function showError(msg) { const e=$('schedError'); e.textContent=msg; e.style.display='block'; }
    function hideError()    { $('schedError').style.display   = 'none'; }

    /* ── Fetch ─────────────────────────────────────────────────────────── */
    async function getSchedule() {
        // We no longer send instructor_id. The PHP session handles it securely.
        const url = `${API_BASE}?semester=${encodeURIComponent(S.semester)}&school_year=${encodeURIComponent(S.schoolYear)}`;
        const r = await fetch(url);

        // Handle unauthorized or not-found status specifically
        if (r.status === 401) {
            const j = await r.json();
            throw new Error(j.message || "Unauthorized. Please log in as a teacher.");
        }
        if (r.status === 404) {
            const j = await r.json();
            throw new Error(j.message || "No schedule found.");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const j = await r.json();
        if (!j.success) throw new Error(j.message || 'API error');
        return j.data;
    }

    /* ── Render stats ──────────────────────────────────────────────────── */
    function renderStats(stats) {
        $('statSessions').textContent = stats.total_sessions;
        $('statHours').textContent    = stats.total_hours + 'h';
        $('statSubjects').textContent = stats.unique_subjects;
        $('statRooms').textContent    = stats.unique_rooms;
    }

    /* ── Render timetable ──────────────────────────────────────────────── */
    function renderTimetable(byDay) {
        const displayDays = S.activeDay ? [S.activeDay] : DAYS;
        const hasSessions = displayDays.some(d => (byDay[d] || []).length > 0);

        if (!hasSessions) { showGrid(false); showEmpty(true); return; }
        showEmpty(false); showGrid(true);

        const gridEl = $('schedGrid');
        gridEl.style.setProperty('--day-count', displayDays.length);

        let html = `<div class="sched-grid">`;

        /* Corner */
        html += `<div class="sched-corner" style="height:${SLOT_PX}px"></div>`;

        /* Day headers */
        displayDays.forEach(day => {
            const sessions = byDay[day] || [];
            const hasClass = sessions.length > 0;
            const isToday  = day === TODAY;
            let cls = 'sched-day-header';
            if (isToday)   cls += ' is-today';
            if (hasClass)  cls += ' has-class';
            if (!hasClass) cls += ' empty-day';

            html += `<div class="${cls}">
                ${isToday ? '<span class="today-dot"></span>' : ''}
                <span class="day-hdr-short">${DAY_SHORT[DAYS.indexOf(day)]}</span>
                <span class="day-hdr-full">${day}</span>
                ${hasClass ? `<span class="day-count-badge">${sessions.length}</span>` : ''}
            </div>`;
        });

        /* Time rows */
        for (let s = 0; s < TOTAL_SLOTS; s++) {
            const slotMins = GRID_START * 60 + s * SLOT_MIN;
            const isHour   = slotMins % 60 === 0;

            html += `<div class="sched-time-cell ${isHour ? 'on-hour' : ''}">${isHour ? fmtTime(slotMins) : ''}</div>`;

            displayDays.forEach(day => {
                const sessions  = byDay[day] || [];
                const isToday   = day === TODAY;
                const todayCls  = isToday ? ' today-col' : '';

                const starting = sessions.filter(sess => slotOf(toMins(sess.start_raw || sess.start_time)) === s);
                const spanned  = !starting.length && sessions.some(sess => {
                    const sm = slotOf(toMins(sess.start_raw || sess.start_time));
                    const em = slotOf(toMins(sess.end_raw   || sess.end_time));
                    return sm < s && s < em;
                });

                if (starting.length) {
                    html += `<div class="sched-cell session-start${todayCls}">`;
                    starting.forEach(sess => {
                        const sm       = toMins(sess.start_raw || sess.start_time);
                        const em       = toMins(sess.end_raw   || sess.end_time);
                        const spans    = Math.round((em - sm) / SLOT_MIN);
                        const height   = spans * SLOT_PX - 6;
                        const c        = colorFor(sess.subject_code);
                        html += `
                            <div class="sched-session"
                                 style="height:${height}px;background:${c.bg};border-left:4px solid ${c.border};color:${c.text};"
                                 title="${sess.subject_name} | ${sess.section} | ${sess.room_name}">
                                <div class="sess-code">${sess.subject_code}</div>
                                <div class="sess-name">${sess.subject_name}</div>
                                <div class="sess-row"><i class="bi bi-clock"></i> ${sess.start_time} – ${sess.end_time}</div>
                                <div class="sess-row"><i class="bi bi-building"></i> ${sess.room_name}${sess.building ? ' · ' + sess.building : ''}</div>
                                <div class="sess-section"><i class="bi bi-people"></i> ${sess.section}</div>
                            </div>`;
                    });
                    html += `</div>`;
                } else if (spanned) {
                    html += `<div class="sched-cell${todayCls}" style="border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;"></div>`;
                } else {
                    html += `<div class="sched-cell empty${todayCls}"></div>`;
                }
            });
        }

        html += `</div>`;
        gridEl.innerHTML = html;
    }

    /* ── Render legend ─────────────────────────────────────────────────── */
    function renderLegend() {
        const wrap = $('schedLegend');
        if (!wrap) return;

        const seen = new Map();
        document.querySelectorAll('.sched-session').forEach(el => {
            const code = el.querySelector('.sess-code')?.textContent?.trim();
            const name = el.querySelector('.sess-name')?.textContent?.trim();
            if (code && !seen.has(code)) {
                seen.set(code, { name, bg: el.style.background, border: el.style.borderLeftColor, text: el.style.color });
            }
        });

        if (!seen.size) { wrap.style.display = 'none'; return; }
        wrap.style.display = '';

        let html = '<span class="legend-lbl">Subjects:</span>';
        seen.forEach((v, code) => {
            html += `<div class="legend-item">
                <div class="legend-dot" style="background:${v.bg};border:2px solid ${v.border}"></div>
                <span style="color:${v.text};font-weight:800">${code}</span>
                <span style="color:#64748b">— ${v.name}</span>
            </div>`;
        });
        wrap.innerHTML = html;
    }

    /* ── Bind day pills ────────────────────────────────────────────────── */
    function bindDayPills() {
        $$('#dayPills .day-pill[data-day]').forEach(btn => {
            if (btn.dataset.day === TODAY) btn.classList.add('is-today');
            btn.addEventListener('click', () => {
                $$('#dayPills .day-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                S.activeDay = btn.dataset.day === 'all' ? null : btn.dataset.day;
                renderTimetable(S.data.schedule_by_day);
                renderLegend();
            });
        });
    }

    /* ── Bind semester/year selects ────────────────────────────────────── */
    function bindSelects() {
        $('semesterSelect').value = S.semester;
        $('yearSelect').value     = S.schoolYear;

        ['semesterSelect', 'yearSelect'].forEach(id => {
            $(id).addEventListener('change', function () {
                if (id === 'semesterSelect') S.semester   = this.value;
                else                         S.schoolYear = this.value;
                reload();
            });
        });
    }

    /* ── Reload on semester/year change ────────────────────────────────── */
    async function reload() {
        showGrid(false); showEmpty(false); hideError();
        showLoader(true);
        S.colorMap = {}; S.colorIdx = 0;
        try {
            S.data = await getSchedule();
            renderStats(S.data.stats);
            renderTimetable(S.data.schedule_by_day);
            renderLegend();
        } catch (err) {
            showError('Could not load schedule: ' + err.message);
        } finally {
            showLoader(false);
        }
    }

    /* ── Boot ──────────────────────────────────────────────────────────── */
    async function boot() {
        showLoader(true);
        hideError();

        try {
            // Directly fetch the schedule. The backend checks the session itself.
            S.data = await getSchedule();

            renderStats(S.data.stats);
            renderTimetable(S.data.schedule_by_day);
            renderLegend();
            bindDayPills();
            bindSelects();

        } catch (err) {
            console.error('[MySchedule]', err);
            showError(err.message);
        } finally {
            showLoader(false);
        }
    }

    document.addEventListener('DOMContentLoaded', boot);

})();
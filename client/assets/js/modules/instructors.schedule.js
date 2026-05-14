// Path: client/assets/js/modules/instructors.schedule.js

// ─── Header & Session Logic ───────────────────────────────────────────────────
const API = 'https://artisanslms.onrender.com/backend/index.php';

window.initHeader = function() {
    const PAGE_TITLES = {
        'dashboard.html':              { title: 'Dashboard',              subtitle: 'Overview of your academic progress and activities.' },
        'collaborations.html':         { title: 'Collaboration Spaces',   subtitle: 'Select a class to enter the live chat and video space.' },
        'messages.html':               { title: 'Direct Messages',        subtitle: 'Communicate privately with instructors and peers.' },
        'instructor_dashboard.html':   { title: 'Instructor Dashboard',   subtitle: 'Manage your assigned courses and student spaces.' },
        'courses.html':                { title: 'Course Materials',       subtitle: 'Upload and organize files, lectures, and resources.' },
        'instructor_assignments.html': { title: 'Task Manager',           subtitle: 'Create and manage assignments for your assigned classes.' },
        'students.html':               { title: 'Manage Students',        subtitle: 'Manage student profiles, accounts, and records.' },
        'instructors.html':            { title: 'Master Instructors',     subtitle: 'Manage faculty accounts, profiles, and subject loads.' },
        'instructors.schedule.html':   { title: 'My Schedule',            subtitle: 'View your weekly timetable and teaching loads.' },
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
    };

    const currentPage = window.location.pathname.split('/').pop() || 'instructors.schedule.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'My Schedule', subtitle: 'View your weekly timetable and teaching loads.' };

    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: API,
        method: 'POST',
        xhrFields: { withCredentials: true },
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success: function(res) {
            if (res.status === 'success' && res.logged_in) {
                const u     = res.user;
                const smAvt = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e2e8f0&color=475569`;
                const lgAvt = smAvt + '&size=128';
                $('#headerUserName').text(u.name);
                $('#headerUserRole').text(u.role || 'Teacher');
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'Teacher');
                $('#dropdownAvatar').attr({ src: lgAvt, alt: u.name });
                $('#heroName').html(u.name + ' <span class="fs-3">👋</span>');
            } else {
                window.location.href = '/client/pages/login.html';
            }
        },
        error: function() { window.location.href = '/client/pages/login.html'; }
    });

    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        $.ajax({
            url: API, method: 'POST', contentType: 'application/json', dataType: 'json', xhrFields: { withCredentials: true },
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/client/pages/login.html'; }
        });
    });
}

// ─── Schedule Rendering Logic ─────────────────────────────────────────────────
$(document).ready(function() {

    // ── Load UI Components (Matches Task Manager EXACTLY) ──
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error' && typeof initHeader === 'function') {
            initHeader();
        }
    });

    const API_BASE = '/backend/endpoints/instructors.schedule.php';
    const DAYS      = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const DAY_SHORT = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
    const GRID_START = 7, GRID_END = 20, SLOT_MIN = 30, SLOT_PX = 44;
    const TOTAL_SLOTS = ((GRID_END - GRID_START) * 60) / SLOT_MIN;

    const PALETTE = [
        { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
        { bg:'#f0fdf4', border:'#22c55e', text:'#15803d' },
        { bg:'#faf5ff', border:'#a855f7', text:'#7e22ce' },
        { bg:'#fffbeb', border:'#f59e0b', text:'#b45309' },
        { bg:'#fff1f2', border:'#f43f5e', text:'#be123c' },
        { bg:'#ecfdf5', border:'#10b981', text:'#065f46' },
        { bg:'#fff7ed', border:'#f97316', text:'#c2410c' },
        { bg:'#f0f9ff', border:'#0ea5e9', text:'#0369a1' }
    ];

    const S = { semester: '1st Semester', schoolYear: '2025-2026', data: null, colorMap: {}, colorIdx: 0, activeDay: null };
    const TODAY = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

    function toMins(t) {
        if (!t) return 0;
        let m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (m) return +m[1] * 60 + +m[2];
        m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (m) {
            let h = +m[1], mn = +m[2], mer = m[3].toUpperCase();
            if (mer === 'PM' && h !== 12) h += 12;
            if (mer === 'AM' && h === 12) h = 0;
            return h * 60 + mn;
        }
        return 0;
    }

    function fmtTime(mins) {
        let h = Math.floor(mins / 60), m = mins % 60, mer = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12; if (h === 0) h = 12;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`;
    }

    function colorFor(code) {
        if (!S.colorMap[code]) { S.colorMap[code] = PALETTE[S.colorIdx % PALETTE.length]; S.colorIdx++; }
        return S.colorMap[code];
    }
    function slotOf(mins) { return Math.round((mins - GRID_START * 60) / SLOT_MIN); }

    const $el = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    function showLoader(v)  { if($el('schedLoader')) $el('schedLoader').style.display = v ? 'flex' : 'none'; }
    function showGrid(v)    { if($el('timetableScroll')) $el('timetableScroll').style.display = v ? 'block' : 'none'; }
    function showEmpty(v)   { if($el('schedEmpty')) $el('schedEmpty').style.display = v ? 'flex' : 'none'; }
    function showError(msg) { const e=$el('schedError'); if(e) { e.innerHTML=msg; e.style.display='block'; } }
    function hideError()    { const e=$el('schedError'); if(e) e.style.display = 'none'; }

    async function getSchedule() {
        const url = `${API_BASE}?semester=${encodeURIComponent(S.semester)}&school_year=${encodeURIComponent(S.schoolYear)}`;
        const r = await fetch(url);

        if (!r.ok) {
            let errMsg = `HTTP ${r.status}`;
            try { const j = await r.json(); if (j.message) errMsg = j.message; } catch(e){}
            throw new Error(errMsg);
        }
        const j = await r.json();
        if (!j.success) throw new Error(j.message || 'API error');
        return j.data;
    }

    function renderStats(stats) {
        if($el('statSessions')) $el('statSessions').textContent = stats.total_sessions;
        if($el('statHours')) $el('statHours').textContent = stats.total_hours + 'h';
        if($el('statSubjects')) $el('statSubjects').textContent = stats.unique_subjects;
        if($el('statRooms')) $el('statRooms').textContent = stats.unique_rooms;
    }

    function renderTimetable(byDay) {
        const displayDays = S.activeDay ? [S.activeDay] : DAYS;
        const hasSessions = displayDays.some(d => (byDay[d] || []).length > 0);

        if (!hasSessions) { showGrid(false); showEmpty(true); return; }
        showEmpty(false); showGrid(true);

        const gridEl = $el('schedGrid');
        if(!gridEl) return;

        gridEl.style.setProperty('--day-count', displayDays.length);
        let html = `<div class="sched-grid"><div class="sched-corner" style="height:${SLOT_PX}px"></div>`;

        displayDays.forEach(day => {
            const hasClass = (byDay[day] || []).length > 0;
            const isToday = day === TODAY;
            let cls = `sched-day-header ${isToday?'is-today':''} ${hasClass?'has-class':'empty-day'}`;
            html += `<div class="${cls}">
                ${isToday ? '<span class="today-dot"></span>' : ''}
                <span class="day-hdr-short">${DAY_SHORT[DAYS.indexOf(day)]}</span>
                <span class="day-hdr-full">${day}</span>
                ${hasClass ? `<span class="day-count-badge">${byDay[day].length}</span>` : ''}
            </div>`;
        });

        for (let s = 0; s < TOTAL_SLOTS; s++) {
            const slotMins = GRID_START * 60 + s * SLOT_MIN;
            const isHour = slotMins % 60 === 0;
            html += `<div class="sched-time-cell ${isHour ? 'on-hour' : ''}">${isHour ? fmtTime(slotMins) : ''}</div>`;

            displayDays.forEach(day => {
                const sessions = byDay[day] || [];
                const todayCls = day === TODAY ? ' today-col' : '';
                const starting = sessions.filter(sess => slotOf(toMins(sess.start_raw || sess.start_time)) === s);
                const spanned = !starting.length && sessions.some(sess => {
                    const sm = slotOf(toMins(sess.start_raw || sess.start_time)), em = slotOf(toMins(sess.end_raw || sess.end_time));
                    return sm < s && s < em;
                });

                if (starting.length) {
                    html += `<div class="sched-cell session-start${todayCls}">`;
                    starting.forEach(sess => {
                        const sm = toMins(sess.start_raw || sess.start_time), em = toMins(sess.end_raw || sess.end_time);
                        const spans = Math.round((em - sm) / SLOT_MIN);
                        const c = colorFor(sess.subject_code);
                        html += `
                            <div class="sched-session" style="height:${spans * SLOT_PX - 6}px;background:${c.bg};border-left:4px solid ${c.border};color:${c.text};">
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
        gridEl.innerHTML = html + `</div>`;
    }

    function renderLegend() {
        const wrap = $el('schedLegend');
        if (!wrap) return;
        const seen = new Map();
        document.querySelectorAll('.sched-session').forEach(el => {
            const code = el.querySelector('.sess-code')?.textContent?.trim(), name = el.querySelector('.sess-name')?.textContent?.trim();
            if (code && !seen.has(code)) seen.set(code, { name, bg: el.style.background, border: el.style.borderLeftColor, text: el.style.color });
        });
        if (!seen.size) { wrap.style.display = 'none'; return; }
        wrap.style.display = '';
        let html = '<span class="legend-lbl">Subjects:</span>';
        seen.forEach((v, code) => {
            html += `<div class="legend-item"><div class="legend-dot" style="background:${v.bg};border:2px solid ${v.border}"></div><span style="color:${v.text};font-weight:800">${code}</span><span style="color:#64748b">— ${v.name}</span></div>`;
        });
        wrap.innerHTML = html;
    }

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

    function bindSelects() {
        if($el('semesterSelect')) $el('semesterSelect').value = S.semester;
        if($el('yearSelect')) $el('yearSelect').value = S.schoolYear;

        ['semesterSelect', 'yearSelect'].forEach(id => {
            const element = $el(id);
            if(element) {
                element.addEventListener('change', function () {
                    if (id === 'semesterSelect') S.semester = this.value; else S.schoolYear = this.value;
                    boot(true);
                });
            }
        });
    }

    async function boot(isReload = false) {
        showLoader(true); hideError();
        try {
            S.colorMap = {}; S.colorIdx = 0;
            S.data = await getSchedule();
            renderStats(S.data.stats);
            renderTimetable(S.data.schedule_by_day);
            renderLegend();
            if (!isReload) { bindDayPills(); bindSelects(); }
        } catch (err) {
            console.error('[MySchedule]', err);
            showError(`<strong><i class="fas fa-exclamation-circle"></i> Error:</strong> ${err.message}`);
        } finally {
            showLoader(false);
        }
    }

    boot(false);
});
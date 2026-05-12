/**
 * instructors.schedule.js
 * Module for fetching and rendering the instructor's weekly schedule timetable.
 * Path: client/assets/js/modules/instructors.schedule.js
 */

const InstructorSchedule = (() => {

    // ── Config ────────────────────────────────────────────────────────────────
    const API_BASE   = '../../../backend/endpoints/instructors.schedule.php';
    const DAYS       = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const DAY_SHORT  = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    // Grid: 08:00 – 17:00, each slot = 30 min
    const GRID_START_H = 8;   // 08:00
    const GRID_END_H   = 17;  // 17:00 (last slot ends at 17:00)
    const SLOT_MINUTES = 30;
    const TOTAL_SLOTS  = ((GRID_END_H - GRID_START_H) * 60) / SLOT_MINUTES; // 18 slots

    // Subject colour palette (assigned per subject_code, cycles)
    const PALETTE = [
        { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20' },
        { bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1' },
        { bg: '#fce4ec', border: '#ad1457', text: '#880e4f' },
        { bg: '#fff8e1', border: '#f57f17', text: '#e65100' },
        { bg: '#f3e5f5', border: '#6a1b9a', text: '#4a148c' },
        { bg: '#e0f2f1', border: '#00695c', text: '#004d40' },
        { bg: '#fbe9e7', border: '#bf360c', text: '#8d1c00' },
        { bg: '#e8eaf6', border: '#283593', text: '#1a237e' },
    ];

    // State
    let state = {
        instructorId : null,
        semester     : '1st Semester',
        schoolYear   : '2025-2026',
        data         : null,
        colorMap     : {},
        colorIndex   : 0,
        activeDay    : null,   // null = all days
    };

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const el = {
        root          : () => document.getElementById('scheduleRoot'),
        header        : () => document.getElementById('schedInstructorName'),
        dept          : () => document.getElementById('schedDept'),
        empId         : () => document.getElementById('schedEmpId'),
        semLabel      : () => document.getElementById('schedSemLabel'),
        statsBox      : () => document.getElementById('schedStats'),
        timetable     : () => document.getElementById('schedTimetable'),
        loader        : () => document.getElementById('schedLoader'),
        errorBox      : () => document.getElementById('schedError'),
        dayTabs       : () => document.querySelectorAll('.sched-day-tab'),
        printBtn      : () => document.getElementById('schedPrintBtn'),
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Convert "08:00 AM" or raw "08:00:00" → minutes since midnight */
    function toMinutes(timeStr) {
        if (!timeStr) return 0;
        // Handle "HH:MM:SS"
        const raw = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (raw) return parseInt(raw[1]) * 60 + parseInt(raw[2]);
        // Handle "HH:MM AM/PM"
        const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (ampm) {
            let h = parseInt(ampm[1]);
            const m = parseInt(ampm[2]);
            const meridiem = ampm[3].toUpperCase();
            if (meridiem === 'PM' && h !== 12) h += 12;
            if (meridiem === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        }
        return 0;
    }

    /** Format minutes-since-midnight → "08:00 AM" */
    function formatTime(totalMins) {
        let h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const meridiem = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
    }

    /** Return (or create) a colour for a subject code */
    function colorFor(subjectCode) {
        if (!state.colorMap[subjectCode]) {
            state.colorMap[subjectCode] = PALETTE[state.colorIndex % PALETTE.length];
            state.colorIndex++;
        }
        return state.colorMap[subjectCode];
    }

    /** Slot index (0-based) for a given total-minutes value */
    function slotIndex(totalMins) {
        return Math.round((totalMins - GRID_START_H * 60) / SLOT_MINUTES);
    }

    // ── Fetch ─────────────────────────────────────────────────────────────────
    async function fetchSchedule(instructorId, semester, schoolYear) {
        const url = `${API_BASE}?instructor_id=${encodeURIComponent(instructorId)}`
                  + `&semester=${encodeURIComponent(semester)}`
                  + `&school_year=${encodeURIComponent(schoolYear)}`;
        const res  = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'API error');
        return json.data;
    }

    // ── Render helpers ────────────────────────────────────────────────────────

    function renderHeader(instructor, semester, schoolYear) {
        if (el.header()) el.header().textContent = instructor.name;
        if (el.dept())   el.dept().textContent   = instructor.department || '—';
        if (el.empId())  el.empId().textContent  = instructor.employee_id || '—';
        if (el.semLabel()) el.semLabel().textContent = `${semester} · SY ${schoolYear}`;
    }

    function renderStats(stats) {
        const box = el.statsBox();
        if (!box) return;
        box.innerHTML = `
            <div class="sched-stat">
                <span class="sched-stat-val">${stats.total_sessions}</span>
                <span class="sched-stat-lbl">Sessions</span>
            </div>
            <div class="sched-stat">
                <span class="sched-stat-val">${stats.total_hours}h</span>
                <span class="sched-stat-lbl">Teaching Hours</span>
            </div>
            <div class="sched-stat">
                <span class="sched-stat-val">${stats.unique_subjects}</span>
                <span class="sched-stat-lbl">Subjects</span>
            </div>
            <div class="sched-stat">
                <span class="sched-stat-val">${stats.unique_rooms}</span>
                <span class="sched-stat-lbl">Rooms Used</span>
            </div>
        `;
    }

    /**
     * Build the timetable grid.
     * Columns = days (filtered if activeDay set), rows = 30-min slots 08:00–17:00.
     */
    function renderTimetable(scheduleByDay) {
        const container = el.timetable();
        if (!container) return;

        const activeDays = state.activeDay
            ? [state.activeDay]
            : DAYS.filter(d => scheduleByDay[d] && scheduleByDay[d].length > 0
                          || !state.activeDay);

        // Always show Mon–Sun if "All" selected
        const displayDays = state.activeDay ? [state.activeDay] : DAYS;

        // Build time-label column values
        const timeLabels = [];
        for (let i = 0; i <= TOTAL_SLOTS; i++) {
            const mins = GRID_START_H * 60 + i * SLOT_MINUTES;
            timeLabels.push(formatTime(mins));
        }

        // ── Grid HTML ──
        let html = `<div class="sched-grid" style="--day-count:${displayDays.length}">`;

        // Corner cell
        html += `<div class="sched-corner"></div>`;

        // Day headers
        displayDays.forEach((day, idx) => {
            const daySlots = scheduleByDay[day] || [];
            const hasClass = daySlots.length > 0;
            html += `<div class="sched-day-header ${hasClass ? 'has-class' : 'empty-day'}">
                        <span class="day-short">${DAY_SHORT[DAYS.indexOf(day)]}</span>
                        <span class="day-full">${day}</span>
                        ${hasClass ? `<span class="day-badge">${daySlots.length}</span>` : ''}
                     </div>`;
        });

        // Rows (time slots)
        for (let s = 0; s < TOTAL_SLOTS; s++) {
            const slotMins  = GRID_START_H * 60 + s * SLOT_MINUTES;
            const isHour    = slotMins % 60 === 0;
            const timeLabel = formatTime(slotMins);

            // Time label cell
            html += `<div class="sched-time-cell ${isHour ? 'on-hour' : ''}">${isHour ? timeLabel : ''}</div>`;

            // Day cells
            displayDays.forEach(day => {
                const sessions = scheduleByDay[day] || [];

                // Check if any session starts exactly at this slot
                const startsHere = sessions.filter(sess => {
                    const sm = toMinutes(sess.start_raw || sess.start_time);
                    return slotIndex(sm) === s;
                });

                // Check if a session is ONGOING (started before, spanning this slot)
                const ongoing = sessions.some(sess => {
                    const sm = toMinutes(sess.start_raw || sess.start_time);
                    const em = toMinutes(sess.end_raw   || sess.end_time);
                    const startSlot = slotIndex(sm);
                    const endSlot   = slotIndex(em);
                    return startSlot < s && s < endSlot;
                });

                if (startsHere.length > 0) {
                    // Render session block(s) starting here
                    html += `<div class="sched-cell session-start">`;
                    startsHere.forEach(sess => {
                        const sm     = toMinutes(sess.start_raw || sess.start_time);
                        const em     = toMinutes(sess.end_raw   || sess.end_time);
                        const spanSlots = Math.round((em - sm) / SLOT_MINUTES);
                        const heightPx  = spanSlots * 40; // 40px per slot
                        const color     = colorFor(sess.subject_code);
                        html += `
                            <div class="sched-session"
                                 style="
                                    height:${heightPx}px;
                                    background:${color.bg};
                                    border-left:4px solid ${color.border};
                                    color:${color.text};
                                 "
                                 data-schedule-id="${sess.schedule_id}"
                                 title="${sess.subject_name} | ${sess.section} | ${sess.room_name}">
                                <div class="sess-subj-code">${sess.subject_code}</div>
                                <div class="sess-subj-name">${sess.subject_name}</div>
                                <div class="sess-meta">
                                    <i class="bi bi-clock"></i> ${sess.start_time} – ${sess.end_time}
                                </div>
                                <div class="sess-meta">
                                    <i class="bi bi-building"></i> ${sess.room_name}
                                    ${sess.building ? `· ${sess.building}` : ''}
                                </div>
                                <div class="sess-section">
                                    <i class="bi bi-people"></i> ${sess.section}
                                </div>
                            </div>`;
                    });
                    html += `</div>`;
                } else if (ongoing) {
                    // Spanned by an earlier session — skip (block uses absolute height)
                    html += `<div class="sched-cell spanned"></div>`;
                } else {
                    html += `<div class="sched-cell empty"></div>`;
                }
            });
        }

        html += `</div>`; // .sched-grid
        container.innerHTML = html;
    }

    // ── Day tab filtering ─────────────────────────────────────────────────────
    function bindDayTabs() {
        document.querySelectorAll('.sched-day-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sched-day-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const day = btn.dataset.day || null;
                state.activeDay = day === 'all' ? null : day;
                renderTimetable(state.data.schedule_by_day);
            });
        });
    }

    // ── Print ─────────────────────────────────────────────────────────────────
    function bindPrint() {
        const btn = el.printBtn();
        if (btn) btn.addEventListener('click', () => window.print());
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Main entry point.
     * @param {Object} opts
     * @param {number}  opts.instructorId  - required
     * @param {string}  [opts.semester]    - default '1st Semester'
     * @param {string}  [opts.schoolYear]  - default '2025-2026'
     */
    async function init(opts = {}) {
        state.instructorId = opts.instructorId ?? null;
        state.semester     = opts.semester   ?? state.semester;
        state.schoolYear   = opts.schoolYear ?? state.schoolYear;

        if (!state.instructorId) {
            showError('No instructor ID provided.');
            return;
        }

        showLoader(true);
        hideError();

        try {
            state.data = await fetchSchedule(state.instructorId, state.semester, state.schoolYear);
            renderHeader(state.data.instructor, state.data.semester, state.data.school_year);
            renderStats(state.data.stats);
            renderTimetable(state.data.schedule_by_day);
            bindDayTabs();
            bindPrint();
        } catch (err) {
            console.error('[InstructorSchedule]', err);
            showError(err.message || 'Failed to load schedule.');
        } finally {
            showLoader(false);
        }
    }

    function showLoader(show) {
        const l = el.loader();
        if (l) l.style.display = show ? 'flex' : 'none';
    }

    function showError(msg) {
        const e = el.errorBox();
        if (e) {
            e.textContent = msg;
            e.style.display = 'block';
        }
    }

    function hideError() {
        const e = el.errorBox();
        if (e) e.style.display = 'none';
    }

    return { init };
})();
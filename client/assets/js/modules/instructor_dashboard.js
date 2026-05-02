/**
 * instructor_dashboard.js
 * Handles the teacher-facing dashboard page.
 */

const API = 'https://artisanslms.onrender.com/backend/index.php';

$(document).ready(function () {

    // ── Load Sidebar & Header ─────────────────────────────────────────────────
    // (handled by inline script in HTML, same as courses.html)

    // ── Greeting + Date ──────────────────────────────────────────────────────
    const hour = new Date().getHours();
    $('#greetingText').text(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
    $('#dateText').text(new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }));

    // ── Dashboard Data Fetch ──────────────────────────────────────────────────
    $.ajax({
        url: '/artisansLMS/backend/endpoints/instructor_dashboard.php',
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            if (data.status !== 'success') {
                console.error('Dashboard error:', data.message);
                return;
            }
            renderStats(data.stats);
            renderClasses(data.classes);
            renderPending(data.pending_submissions);
            renderUpcoming(data.upcoming);
            renderQuizResults(data.quiz_results);
            renderActivity(data.activity);
        },
        error: function (xhr) {
            console.error('Instructor dashboard fetch failed:', xhr.responseText);
        }
    });
});

// ── Header (mirrors instructor_courses.js pattern) ────────────────────────────
function initHeader() {
    const PAGE_TITLES = {
        'dashboard.html':              { title: 'Dashboard',              subtitle: 'Overview of your academic progress and activities.' },
        'collaborations.html':         { title: 'Collaboration Spaces',   subtitle: 'Select a class to enter the live chat and video space.' },
        'messages.html':               { title: 'Direct Messages',        subtitle: 'Communicate privately with instructors and peers.' },
        'my_grades.html':              { title: 'My Grades',              subtitle: 'Track your academic performance and feedback.' },
        'my_analytics.html':           { title: 'Achievement Board',      subtitle: 'View your milestones, badges, and learning statistics.' },
        'instructor_dashboard.html':   { title: 'Instructor Dashboard',   subtitle: 'Manage your assigned courses and student spaces.' },
        'courses.html':                { title: 'Course Materials',       subtitle: 'Upload and organize files, lectures, and resources.' },
        'instructor_assignments.html': { title: 'Task Manager',           subtitle: 'Create and manage assignments for your assigned classes.' },
        'students.html':               { title: 'Manage Students',        subtitle: 'Manage student profiles, accounts, and records.' },
        'instructors.html':            { title: 'Master Instructors',     subtitle: 'Manage faculty accounts, profiles, and subject loads.' },
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' },
        'assignments.html':            { title: 'Assignments',            subtitle: 'View and submit your class assignments.' },
        'grades.html':                 { title: 'Grades',                 subtitle: 'View your academic performance and feedback.' },
        'quizzes.html':                { title: 'Quizzes',                subtitle: 'Take and review your quizzes.' },
        'modules.html':                { title: 'Course Materials',       subtitle: 'Browse uploaded files, lectures, and resources.' },
        'todo.html':                   { title: 'Task Manager',           subtitle: 'Manage your personal tasks and to-dos.' },
    };

    const currentPage = window.location.pathname.split('/').pop() || 'instructor_dashboard.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };
    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: API,
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success: function (res) {
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

                // ── Set hero name in the dark banner ──
                $('#heroName').html(esc(u.name) + ' <span class="fs-3">👋</span>');

            } else {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        },
        error: function () {
            window.location.href = '/artisansLMS/client/pages/login.html';
        }
    });

    $(document).on('click', '#logoutBtn', function (e) {
        e.preventDefault();
        $.ajax({
            url: API,
            method: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function () {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        });
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
    return (s || '').toString()
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initials(first, last) {
    return ((first || '')[0] + (last || '')[0]).toUpperCase();
}

function fmtTime(d) {
    return new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

function daysUntil(dateStr) {
    return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ── Render: Stats ─────────────────────────────────────────────────────────────
function renderStats(stats) {
    $('#statClasses').text(stats.total_classes);
    $('#statStudents').text(stats.total_students);
    $('#statPending').text(stats.total_pending);
    $('#statQuizzes').text(stats.total_quizzes);
}

// ── Render: Classes ───────────────────────────────────────────────────────────
function renderClasses(classes) {
    const grid = $('#classGrid');
    if (!classes || classes.length === 0) {
        grid.html('<div class="col-12"><div class="empty-state"><i class="fas fa-chalkboard"></i>No classes assigned yet.</div></div>');
        return;
    }

    const colors = ['#38bdf8', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
    grid.html(classes.map((c, i) => {
        const color      = colors[i % colors.length];
        const studentPct = c.max_enrollment > 0
            ? Math.round((c.student_count / c.max_enrollment) * 100) : 0;
        return `
        <div class="col-sm-6 col-xl-4">
            <a href="collaborations.html?class_id=${c.class_id}" class="class-card shadow-sm">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="course-code">${esc(c.course_code)}</span>
                    <span class="class-meta">${esc(c.semester)} ${c.year}</span>
                </div>
                <div class="course-name">${esc(c.course_name)}</div>
                <div class="class-pills">
                    <span class="class-pill" style="background:#f0fdf4;color:#16a34a;">
                        <i class="fas fa-users me-1" style="font-size:.6rem;"></i>${c.student_count} students
                    </span>
                    <span class="class-pill" style="background:#eff6ff;color:#2563eb;">
                        <i class="fas fa-tasks me-1" style="font-size:.6rem;"></i>${c.task_count} tasks
                    </span>
                    <span class="class-pill" style="background:#faf5ff;color:#7c3aed;">
                        <i class="fas fa-brain me-1" style="font-size:.6rem;"></i>${c.quiz_count} quizzes
                    </span>
                </div>
                <div class="mt-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span style="font-size:.68rem;color:#94a3b8;font-weight:600;">Enrollment</span>
                        <span style="font-size:.68rem;color:#64748b;font-weight:700;">${c.student_count} / ${c.max_enrollment}</span>
                    </div>
                    <div class="progress" style="height:4px;border-radius:99px;">
                        <div class="progress-bar" style="width:${studentPct}%;background:${color};border-radius:99px;"></div>
                    </div>
                </div>
            </a>
        </div>`;
    }).join(''));
}

// ── Render: Pending Submissions ───────────────────────────────────────────────
function renderPending(subs) {
    const el = $('#pendingList');
    if (!subs || subs.length === 0) {
        el.html('<div class="empty-state"><i class="fas fa-check-circle" style="color:#22c55e;opacity:1;"></i>All caught up! No pending submissions.</div>');
        return;
    }
    el.html(subs.map(s => `
    <div class="sub-item">
        <div class="sub-avatar">${initials(s.first_name, s.last_name)}</div>
        <div class="flex-grow-1" style="min-width:0;">
            <div class="sub-name">${esc(s.first_name)} ${esc(s.last_name)}</div>
            <div class="sub-meta text-truncate">
                <span class="badge" style="background:#eff6ff;color:#2563eb;font-size:.65rem;font-family:'JetBrains Mono',monospace;">${esc(s.course_code)}</span>
                &nbsp;${esc(s.task_title)}
            </div>
        </div>
        <div style="flex-shrink:0;text-align:right;">
            <a href="todo.html?class_id=${s.class_id}&tab=tasks"
               class="btn btn-sm fw-bold rounded-pill px-3"
               style="font-size:.7rem;background:#0f172a;color:#fff;border:none;">Grade</a>
            <div class="sub-meta mt-1">${fmtTime(s.submit_date)}</div>
        </div>
    </div>`).join(''));
}

// ── Render: Upcoming Due Dates ────────────────────────────────────────────────
function renderUpcoming(items) {
    const el = $('#upcomingList');
    if (!items || items.length === 0) {
        el.html('<div class="empty-state"><i class="fas fa-calendar-check"></i>No upcoming due dates this week.</div>');
        return;
    }
    el.html(items.map(item => {
        const days      = daysUntil(item.due_date);
        const urgency   = days <= 1 ? 'color:#ef4444;' : days <= 3 ? 'color:#f59e0b;' : 'color:#64748b;';
        const daysLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`;
        return `
        <div class="due-item">
            <div class="due-dot" style="background:#2563eb;"></div>
            <div class="flex-grow-1" style="min-width:0;">
                <div class="due-title text-truncate">${esc(item.title)}</div>
                <div class="due-meta">
                    <span style="font-family:'JetBrains Mono',monospace;font-size:.65rem;">${esc(item.course_code)}</span>
                    · ${item.sub_count}/${item.enroll_count} submitted
                </div>
            </div>
            <div class="due-date" style="${urgency}font-weight:700;">${daysLabel}</div>
        </div>`;
    }).join(''));
}

// ── Render: Quiz Results ──────────────────────────────────────────────────────
function renderQuizResults(quizzes) {
    const body = $('#quizResultsBody');
    if (!quizzes || quizzes.length === 0) {
        body.html('<tr><td colspan="5" class="text-center py-4 text-muted small"><i class="fas fa-brain me-2 opacity-50"></i>No quiz results yet.</td></tr>');
        return;
    }
    body.html(quizzes.map(q => {
        const avg     = q.avg_score    != null ? q.avg_score    : '—';
        const total   = q.total_points != null ? q.total_points : '—';
        const pct     = q.attempt_count > 0 ? Math.round((q.pass_count / q.attempt_count) * 100) : 0;
        const pillCls = pct >= 75
            ? 'background:#dcfce7;color:#166534;'
            : pct >= 50 ? 'background:#fef9c3;color:#854d0e;'
            : 'background:#fee2e2;color:#991b1b;';
        return `
        <tr class="quiz-row">
            <td class="ps-4 fw-semibold text-dark">${esc(q.title)}</td>
            <td><span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;background:#eff6ff;color:#2563eb;border-radius:5px;padding:2px 7px;">${esc(q.course_code)}</span></td>
            <td class="fw-bold" style="font-family:'JetBrains Mono',monospace;">${q.attempt_count}</td>
            <td class="fw-bold" style="font-family:'JetBrains Mono',monospace;">${avg} / ${total}</td>
            <td class="pe-4"><span style="${pillCls}border-radius:20px;padding:2px 10px;font-size:.72rem;font-weight:700;">${pct}%</span></td>
        </tr>`;
    }).join(''));
}

// ── Render: Activity Feed ─────────────────────────────────────────────────────
function renderActivity(activity) {
    const el = $('#activityFeed');
    if (!activity || activity.length === 0) {
        el.html('<div class="empty-state"><i class="fas fa-stream"></i>No recent activity.</div>');
        return;
    }
    el.html(activity.map(a => `
    <div class="act-item">
        <div class="act-dot"></div>
        <div style="min-width:0;">
            <div style="font-size:.8rem;font-weight:600;color:#0f172a;">
                ${esc(a.first_name)} ${esc(a.last_name)}
                <span style="font-weight:400;color:#64748b;">submitted</span>
            </div>
            <div style="font-size:.72rem;color:#94a3b8;margin-top:1px;">
                <span style="font-family:'JetBrains Mono',monospace;font-size:.65rem;background:#eff6ff;color:#2563eb;border-radius:4px;padding:1px 6px;">${esc(a.course_code)}</span>
                &nbsp;${esc(a.task_title)}
                ${a.grade ? `<span style="margin-left:4px;background:#dcfce7;color:#166534;border-radius:4px;padding:1px 6px;font-weight:700;">${esc(a.grade)}</span>` : ''}
            </div>
            <div style="font-size:.68rem;color:#cbd5e1;margin-top:2px;">${fmtTime(a.submit_date)}</div>
        </div>
    </div>`).join(''));
}
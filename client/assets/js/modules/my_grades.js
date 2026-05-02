$(document).ready(function() {

    // ── Load UI Components ──
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    // ── Initialize ──
    fetchGrades();

    // ── Core Functions ──
    function fetchGrades() {
        $.ajax({
            url: '/backend/endpoints/my_grades.php',
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                if (data.status === 'success') {
                    $('#overallAvg').text(data.summary.overall_avg + '%');
                    $('#totalClasses').text(data.summary.total_classes);
                    renderGrid(data.classes);
                } else {
                    $('#gradesGrid').html(`<div class="alert alert-warning">${data.message}</div>`);
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX error:', error);
                $('#gradesGrid').html(`<div class="alert alert-danger">Critical Error: ${error}</div>`);
            }
        });
    }

    function getRingClass(score) {
        if (score === null) return 'ring-none';
        if (score >= 90)   return 'ring-excellent';
        if (score >= 75)   return 'ring-good';
        if (score >= 60)   return 'ring-average';
        return 'ring-poor';
    }

    function renderGrid(classes) {
        const grid = document.getElementById('gradesGrid');
        
        if (classes.length === 0) {
            grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">Not enrolled in any classes yet.</div>';
            return;
        }

        grid.innerHTML = classes.map((c) => {
            const score   = c.averages.combined;
            const ring    = getRingClass(score);
            const jsonStr = JSON.stringify(c).replace(/'/g, "&#39;");
            
            return `
                <div class="col-12 col-xl-6">
                    <div class="grade-card shadow-sm p-4">
                        <div class="d-flex gap-3 align-items-center mb-3">
                            <div class="score-ring ${ring}">
                                <span class="fs-5">${score ?? '—'}</span>
                                ${score ? '<span style="font-size:0.5rem">%</span>' : ''}
                            </div>
                            <div class="overflow-hidden">
                                <span class="badge bg-primary-subtle text-primary mb-1">${c.info.course_code}</span>
                                <h6 class="fw-bold text-dark mb-0 text-truncate">${c.info.course_name}</h6>
                                <small class="text-muted">Prof. ${c.info.last_name}</small>
                            </div>
                        </div>
                        <div class="mt-auto d-flex justify-content-between align-items-center pt-3 border-top">
                            <div class="small text-muted">
                                <i class="fas fa-file-alt me-1 text-info"></i> ${c.assignments.length} Tasks
                                <i class="fas fa-brain ms-2 me-1 text-primary"></i> ${c.quizzes.length} Quizzes
                            </div>
                            <button class="btn btn-sm btn-dark rounded-pill px-3 fw-bold" onclick='viewDetails(${jsonStr})'>Details</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── Helpers ──
    function getScoreColor(score) {
        if (score === null || score === undefined) return { bg: '#f1f5f9', text: '#94a3b8', border: '#e2e8f0' };
        if (score >= 90) return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
        if (score >= 75) return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' };
        if (score >= 60) return { bg: '#fef9c3', text: '#a16207', border: '#fde047' };
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    }

    function getScoreLabel(score) {
        if (score === null || score === undefined) return 'Pending';
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Good';
        if (score >= 60) return 'Average';
        return 'Needs Work';
    }

    function calcAvg(items, key) {
        const graded = items.filter(i => i[key] !== null && i[key] !== undefined);
        if (!graded.length) return null;
        const sum = graded.reduce((acc, i) => acc + parseFloat(i[key]), 0);
        return Math.round(sum / graded.length);
    }

    function buildScoreBar(score) {
        if (score === null) return '';
        const col = getScoreColor(score);
        const width = Math.max(4, score);
        return `
            <div style="height:4px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-top:6px;">
                <div style="height:100%;width:${width}%;background:${col.border};border-radius:99px;transition:width .4s ease;"></div>
            </div>
        `;
    }

    function buildScoreBadge(score, display) {
        const col = getScoreColor(score);
        return `<span style="
            display:inline-flex;align-items:center;justify-content:center;
            min-width:52px;padding:4px 10px;border-radius:99px;font-size:0.75rem;font-weight:700;
            background:${col.bg};color:${col.text};border:1.5px solid ${col.border};
            letter-spacing:0.3px;white-space:nowrap;
        ">${display}</span>`;
    }

    function buildSectionItems(items, scoreKey, labelKey) {
        if (!items.length) {
            return `<div style="padding:16px 0;color:#94a3b8;font-size:0.8rem;text-align:center;">
                        <i class="fas fa-inbox me-2"></i>Nothing here yet.
                    </div>`;
        }

        return items.map((item, idx) => {
            const score   = item[scoreKey] !== undefined ? item[scoreKey] : null;
            const display = score !== null ? score + (labelKey === 'pct' ? '%' : '') : '—';
            const isLast  = idx === items.length - 1;

            return `
                <div style="
                    display:flex;align-items:center;justify-content:space-between;gap:12px;
                    padding:12px 0;
                    ${!isLast ? 'border-bottom:1px solid #f1f5f9;' : ''}
                ">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.85rem;font-weight:600;color:#1e293b;
                                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${item.title}
                        </div>
                        <div style="font-size:0.7rem;color:${score !== null ? '#64748b' : '#94a3b8'};margin-top:2px;">
                            ${score !== null ? getScoreLabel(score) : 'Not yet graded'}
                        </div>
                        ${buildScoreBar(score)}
                    </div>
                    ${buildScoreBadge(score, display)}
                </div>
            `;
        }).join('');
    }

    // ── Global Modal Handler ──
    window.viewDetails = function(c) {

        const assignAvg = calcAvg(c.assignments, 'grade');
        const quizAvg   = calcAvg(c.quizzes, 'pct');
        const combined  = c.averages.combined;
        const combCol   = getScoreColor(combined);

        // ── Modal Header override ──
        const headerEl = document.getElementById('modalTitle');
        headerEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span style="
                    background:#0f172a;color:#fff;
                    font-size:0.7rem;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;
                    padding:3px 10px;border-radius:99px;
                ">${c.info.course_code}</span>
                <span style="font-size:1rem;font-weight:700;color:#0f172a;">${c.info.course_name}</span>
            </div>
            <div style="font-size:0.75rem;color:#64748b;font-weight:400;margin-top:2px;">
                <i class="fas fa-chalkboard-teacher me-1"></i> Prof. ${c.info.last_name}
            </div>
        `;

        // ── Score Summary Strip ──
        const summaryCards = [
            { label: 'Combined Avg', value: combined !== null ? combined + '%' : '—', score: combined },
            { label: 'Assignments', value: assignAvg !== null ? assignAvg + '%' : '—', score: assignAvg },
            { label: 'Quizzes',     value: quizAvg   !== null ? quizAvg   + '%' : '—', score: quizAvg   },
        ].map(card => {
            const col = getScoreColor(card.score);
            return `
                <div style="
                    flex:1;min-width:80px;text-align:center;padding:14px 10px;
                    background:${col.bg};border-radius:12px;border:1.5px solid ${col.border};
                ">
                    <div style="font-size:1.35rem;font-weight:800;color:${col.text};">${card.value}</div>
                    <div style="font-size:0.65rem;font-weight:700;color:${col.text};opacity:0.75;
                                text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">
                        ${card.label}
                    </div>
                </div>
            `;
        }).join('');

        // ── Section Builder ──
        function section(icon, color, title, count, content) {
            return `
                <div style="margin-bottom:24px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div style="
                                width:28px;height:28px;border-radius:8px;background:${color}20;
                                display:flex;align-items:center;justify-content:center;font-size:14px;
                            "><i class="${icon}" style="color:${color};font-size:13px;"></i></div>
                            <span style="font-size:0.9rem;font-weight:700;color:#0f172a;">${title}</span>
                        </div>
                        <span style="
                            font-size:0.7rem;font-weight:600;color:#64748b;
                            background:#f1f5f9;padding:2px 10px;border-radius:99px;
                        ">${count} item${count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style="background:#fff;border:1px solid #f1f5f9;border-radius:12px;padding:0 16px;">
                        ${content}
                    </div>
                </div>
            `;
        }

        const assignSection = section(
            'fas fa-file-alt', '#0ea5e9', 'Assignments',
            c.assignments.length,
            buildSectionItems(c.assignments, 'grade', 'grade')
        );

        const quizSection = section(
            'fas fa-brain', '#8b5cf6', 'Quizzes',
            c.quizzes.length,
            buildSectionItems(c.quizzes, 'pct', 'pct')
        );

        // ── Assemble Modal Body ──
        document.getElementById('modalBody').innerHTML = `
            <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
                ${summaryCards}
            </div>
            <hr style="border-color:#f1f5f9;margin-bottom:20px;">
            ${assignSection}
            ${quizSection}
        `;

        new bootstrap.Modal(document.getElementById('detailsModal')).show();
    };

});

// ─── Header ───────────────────────────────────────────────────────────────────
const API = 'https://artisanslms.onrender.com/backend/index.php';

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

    const currentPage = window.location.pathname.split('/').pop() || 'my_grades.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };
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
                $('#headerUserRole').text(u.role || 'Student');
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'Student');
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
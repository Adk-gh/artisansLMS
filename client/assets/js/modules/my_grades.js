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
            url: '/artisansLMS/backend/endpoints/my_grades.php',
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

    // ── Global Modal Handler ──
    window.viewDetails = function(c) {
        $('#modalTitle').text(c.info.course_name);
        const body = document.getElementById('modalBody');
        
        let html = `<div class="mb-4">
            <h6 class="fw-bold mb-3"><i class="fas fa-file-alt text-info me-2"></i> Assignments</h6>`;
        
        if (c.assignments.length === 0) {
            html += `<p class="text-muted small">No assignments yet.</p>`;
        } else {
            html += c.assignments.map(a => `
                <div class="grade-item">
                    <div>
                        <div class="fw-bold small text-dark">${a.title}</div>
                        <div class="text-muted" style="font-size:0.7rem">${a.grade ? 'Graded' : 'Pending'}</div>
                    </div>
                    <span class="badge ${a.grade ? 'bg-primary' : 'bg-light text-muted border'}">${a.grade ?? '—'}</span>
                </div>
            `).join('');
        }

        html += `</div><div><h6 class="fw-bold mb-3"><i class="fas fa-brain text-primary me-2"></i> Quizzes</h6>`;
        
        if (c.quizzes.length === 0) {
            html += `<p class="text-muted small">No quizzes yet.</p>`;
        } else {
            html += c.quizzes.map(q => `
                <div class="grade-item">
                    <div class="fw-bold small text-dark">${q.title}</div>
                    <span class="badge ${q.pct ? 'bg-success' : 'bg-light text-muted border'}">${q.pct ? q.pct+'%' : '—'}</span>
                </div>
            `).join('');
        }

        body.innerHTML = html + `</div>`;
        new bootstrap.Modal(document.getElementById('detailsModal')).show();
    };

});

// ─── Header ───────────────────────────────────────────────────────────────────
const API = '/artisansLMS/backend/index.php';

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
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        },
        error: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
    });

    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        $.ajax({
            url: API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
        });
    });
}
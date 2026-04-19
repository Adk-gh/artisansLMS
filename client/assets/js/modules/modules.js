$(document).ready(function() {
    // ── 1. Load sidebar & header components via jQuery ──────────────────
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    // ── 2. URL and Routing Setup ────────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('class_id');

    if (!classId) {
        window.location.href = 'collaborations.html';
        return;
    }

    // Update tab links to keep class_id context
    $('#tabChat').attr('href', `collaborations.html?class_id=${classId}`);
    $('#tabModules').attr('href', `modules.html?class_id=${classId}`);
    $('#tabTasks').attr('href', `todo.html?class_id=${classId}`);

    // ── 3. Fetch Modules from API via AJAX ──────────────────────────────
    $.ajax({
        url: '/artisansLMS/backend/endpoints/resources.php',
        method: 'GET',
        data: {
            action: 'get_modules',
            class_id: classId
        },
        dataType: 'json',
        success: function(data) {
            if (data.status === 'success') {
                renderModules(data.resources);
                if (data.course_name) {
                    $('#courseDescription').text(`Resources for ${data.course_name}`);
                }
            } else {
                console.error(data.message);
                showEmptyState();
            }
        },
        error: function(xhr, status, error) {
            console.error('Error fetching modules:', error);
            showEmptyState();
        }
    });

    // ── 4. Core Functions ───────────────────────────────────────────────
    function renderModules(files) {
        const $container = $('#moduleContainer');
        
        if (!files || files.length === 0) {
            showEmptyState();
            return;
        }

        const htmlContent = files.map(file => {
            const ext = file.file_path.split('.').pop().toLowerCase();
            const config = getFileIconConfig(ext);

            return `
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-2">
                    <div class="card-body p-3 d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center gap-3 overflow-hidden">
                            <div class="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" 
                                 style="width: 48px; height: 48px; background-color: ${config.bg}; color: ${config.color};">
                                <i class="fas ${config.icon} fa-lg"></i>
                            </div>
                            <div class="overflow-hidden">
                                <h6 class="mb-0 fw-bold text-dark text-truncate">${file.file_name}</h6>
                                <small class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem; letter-spacing: 0.5px;">
                                    ${file.description || (ext.toUpperCase() + ' File')}
                                </small>
                            </div>
                        </div>
                        <a href="${file.file_path}" target="_blank" class="btn btn-light border text-primary fw-bold btn-sm rounded-3 px-3 py-2">
                            <i class="fas fa-external-link-alt me-1"></i> View
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        $container.html(htmlContent);
    }

    function getFileIconConfig(ext) {
        const map = {
            'pdf':  { icon: 'fa-file-pdf', color: '#ef4444', bg: '#fee2e2' },
            'doc':  { icon: 'fa-file-word', color: '#3b82f6', bg: '#dbeafe' },
            'docx': { icon: 'fa-file-word', color: '#3b82f6', bg: '#dbeafe' },
            'ppt':  { icon: 'fa-file-powerpoint', color: '#f59e0b', bg: '#fef3c7' },
            'pptx': { icon: 'fa-file-powerpoint', color: '#f59e0b', bg: '#fef3c7' },
            'xls':  { icon: 'fa-file-excel', color: '#22c55e', bg: '#dcfce7' },
            'xlsx': { icon: 'fa-file-excel', color: '#22c55e', bg: '#dcfce7' },
            'jpg':  { icon: 'fa-file-image', color: '#8b5cf6', bg: '#f3e8ff' },
            'jpeg': { icon: 'fa-file-image', color: '#8b5cf6', bg: '#f3e8ff' },
            'png':  { icon: 'fa-file-image', color: '#8b5cf6', bg: '#f3e8ff' },
            'mp4':  { icon: 'fa-file-video', color: '#ef4444', bg: '#fee2e2' }
        };
        return map[ext] || { icon: 'fa-file', color: '#64748b', bg: '#f1f5f9' };
    }

    function showEmptyState() {
        $('#moduleContainer').addClass('d-none');
        $('#emptyState').removeClass('d-none');
    }
});

// ─── Header & Session Logic ───────────────────────────────────────────────────
const AUTH_API = '/artisansLMS/backend/index.php';

function initHeader() {
    const PAGE_TITLES = {
        'dashboard.html':              { title: 'Dashboard',              subtitle: 'Overview of your academic progress and activities.' },
        'collaborations.html':         { title: 'Collaboration Spaces',   subtitle: 'Select a class to enter the live chat and video space.' },
        'messages.html':               { title: 'Direct Messages',        subtitle: 'Communicate privately with instructors and peers.' },
        'my_grades.html':              { title: 'My Grades',              subtitle: 'Track your academic performance and feedback.' },
        'my_analytics.html':           { title: 'Achievement Board',      subtitle: 'View your milestones, badges, and learning statistics.' },
        'instructor_dashboard.html':   { title: 'Instructor Dashboard',   subtitle: 'Manage your assigned courses and student spaces.' },
        'instructor_courses.html':     { title: 'Course Materials',       subtitle: 'Upload and organize files, lectures, and resources.' },
        'instructor_assignments.html': { title: 'Task Manager',           subtitle: 'Create and manage assignments for your assigned classes.' },
        'students.html':               { title: 'Manage Students',        subtitle: 'Manage student profiles, accounts, and records.' },
        'instructors.html':            { title: 'Master Instructors',     subtitle: 'Manage faculty accounts, profiles, and subject loads.' },
        'enrollment.html':             { title: 'Student Enrollment',     subtitle: 'Manage and track student class enrollments.' },
        'classes.html':                { title: 'Class Management',       subtitle: 'Create and manage class sections by course.' },
        'courses.html':                { title: 'Course Management',      subtitle: 'Create, edit, and organize system courses and materials.' },
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' },
        'todo.html':                   { title: 'Tasks & Quizzes',        subtitle: 'Manage your assignments, activities, and quizzes.' },
        'modules.html':                { title: 'Course Materials',       subtitle: 'Browse uploaded files, lectures, and resources.' }
    };

    const currentPage = window.location.pathname.split('/').pop() || 'modules.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };
    
    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: AUTH_API,
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
                $('#headerUserRole').text(u.role || 'User'); 
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'User');
                $('#dropdownAvatar').attr({ src: lgAvt, alt: u.name });
                $('#heroName').html(u.name + ' <span class="fs-3">👋</span>');
                
                sessionStorage.setItem('sb_role', (u.role || '').toLowerCase());
            } else {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        },
        error: function() { 
            window.location.href = '/artisansLMS/client/pages/login.html'; 
        }
    });

    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        $.ajax({
            url: AUTH_API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
        });
    });
}
$(document).ready(function() {
    // ── Load UI Components ──
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/archived.php';
    
    // Parse URL for active tab or default to 'classes'
    const urlParams = new URLSearchParams(window.location.search);
    let currentTab = urlParams.get('tab') || 'classes';
    let dateFilter = 'all';

    // ── 1. FUNCTION DEFINITIONS (Must be defined first) ──

    function switchTab(tab, updateUrl = true) {
        currentTab = tab;
        $('.arch-tab').removeClass('active');
        $(`.arch-tab[data-tab="${tab}"]`).addClass('active');
        
        if (updateUrl) {
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?tab=' + tab;
            window.history.pushState({path:newUrl}, '', newUrl);
        }

        fetchArchivedData(tab);
    }

    function setDateFilter(el, val) {
        $('.arch-filter-chip').removeClass('factive');
        $(el).addClass('factive');
        dateFilter = val;
        applyFilters();
    }

    function toggleEnr(idx) {
        const $body = $('#enr-body-' + idx);
        const $chev = $('#enr-chev-' + idx);
        if ($body.length) {
            const isOpen = $body.is(':visible');
            $body.toggle();
            $chev.toggleClass('open', !isOpen);
        }
    }

    function fetchArchivedData(tab) {
        $('#tableContainer').html('<div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm mb-2"></div><br>Loading archives...</div>');
        
        $.ajax({
            url: `${API_URL}?action=get_data&tab=${tab}`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    // Update Counts
                    Object.keys(json.counts).forEach(key => {
                        $(`.arch-tab[data-tab="${key}"] .tab-count`).text(json.counts[key]);
                    });
                    
                    renderTable(tab, json.records);
                } else {
                    showToast(json.message || "Failed to load records.", "error");
                }
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error:", xhr.responseText || error);
                showToast("Server error loading archives.", "error");
            }
        });
    }

    function restoreRecord(id) {
        if (!confirm("Restore this item back to the active system?")) return;
        $.ajax({
            url: `${API_URL}?action=restore`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ archive_id: id }),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    fetchArchivedData(currentTab);
                } else showToast(json.message, "error");
            }
        });
    }

    function purgeRecord(id) {
        if (!confirm("Permanently delete this record? This action cannot be undone.")) return;
        $.ajax({
            url: `${API_URL}?action=purge`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ archive_id: id }),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "deleted");
                    fetchArchivedData(currentTab);
                } else showToast(json.message, "error");
            }
        });
    }

    function applyFilters() {
        const q = ($('#archSearch').val() || '').toLowerCase().trim();
        const now = new Date();
        let visible = 0;

        $('.arch-row').each(function() {
            const $row = $(this);
            const searchStr = ($row.attr('data-search') || '').toLowerCase();
            const dateStr = $row.attr('data-date');
            const d = dateStr ? new Date(dateStr) : null;

            const textOk = !q || searchStr.includes(q);
            let dateOk = true;

            if (d && dateFilter !== 'all') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (dateFilter === 'today') {
                    const rowDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    dateOk = rowDay.getTime() === today.getTime();
                } else if (dateFilter === 'week') {
                    const weekAgo = new Date(today); 
                    weekAgo.setDate(today.getDate() - 7);
                    dateOk = d >= weekAgo;
                } else if (dateFilter === 'month') {
                    dateOk = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                }
            }

            const show = textOk && dateOk;
            if (show) {
                $row.show();
                visible++;
            } else {
                $row.hide();
            }
        });

        $('#archResultCount').text(visible + ' record' + (visible !== 1 ? 's' : ''));
    }

    function formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
               date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function showToast(msg, type) {
        $('#toast').remove();
        const bgClass = type === "error" ? "" : (type === "deleted" ? "toast-deleted" : "toast-restored");
        const icon = type === "error" ? "fa-exclamation-triangle" : (type === "deleted" ? "fa-trash" : "fa-check-circle");
        const customStyle = type === "error" ? 'background:#fee2e2; color:#be123c; border:1px solid #fecdd3;' : '';

        const toastHtml = `
            <div id="toast" class="arch-toast ${bgClass}" style="${customStyle}">
                <i class="fas ${icon}"></i> ${msg}
            </div>`;
        $('body').append(toastHtml);
        setTimeout(() => $('#toast').css('opacity', '0'), 3500);
        setTimeout(() => $('#toast').remove(), 4000);
    }

    // ── 2. DOM RENDERING LOGIC ──

    function renderTable(tab, records) {
        const $container = $('#tableContainer');
        $container.empty();

        if (records.length === 0) {
            $container.html(`
                <div class="tc shadow-sm">
                    <div class="empty-arch"><i class="fas fa-inbox"></i><p>No archived ${tab}.</p></div>
                </div>
            `);
            $('#archResultCount').text('0 records');
            return;
        }

        let html = '';

        if (tab === 'classes') {
            html += `<div class="tc shadow-sm"><div class="table-responsive hide-scroll"><table class="table mb-0 text-nowrap">
                <thead><tr><th>Course Code</th><th>Course Name</th><th>Semester</th><th>Archived By</th><th>Archived At</th><th class="text-end">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.course_code||''} ${d.name||d.course_name||''} ${d.semester||''} ${d.year||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td><span class="ctag">${d.course_code||'—'}</span><span class="arch-badge ms-2"><i class="fas fa-archive"></i> Archived</span></td>
                    <td class="fw-bold" style="color:#0f172a;">${d.name||d.course_name||'—'}</td>
                    <td class="arch-meta">${d.semester||''} ${d.year||''}</td>
                    <td><span class="archiver-pill"><i class="fas fa-user-shield"></i>${r.archiver_name}</span></td>
                    <td class="arch-meta">${formatDate(r.archived_at)}</td>
                    <td class="text-end">
                        <button class="action-btn btn-restore me-1" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                        <button class="action-btn btn-purge" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                    </td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        } 
        else if (tab === 'students') {
            html += `<div class="tc shadow-sm"><div class="table-responsive hide-scroll"><table class="table mb-0 text-nowrap">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Archived By</th><th>Archived At</th><th class="text-end">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.first_name||''} ${d.last_name||''} ${d.email||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:#94a3b8;">STU-${String(d.student_id||0).padStart(4,'0')}</td>
                    <td class="fw-bold" style="color:#0f172a;">${d.first_name||''} ${d.last_name||''} <span class="arch-badge ms-1"><i class="fas fa-archive"></i> Archived</span></td>
                    <td style="font-size:.78rem;color:#64748b;">${d.email||'—'}</td>
                    <td><span class="archiver-pill"><i class="fas fa-user-shield"></i>${r.archiver_name}</span></td>
                    <td class="arch-meta">${formatDate(r.archived_at)}</td>
                    <td class="text-end">
                        <button class="action-btn btn-restore me-1" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                        <button class="action-btn btn-purge" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                    </td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        }
        else if (tab === 'courses') {
            html += `<div class="tc shadow-sm"><div class="table-responsive hide-scroll"><table class="table mb-0 text-nowrap">
                <thead><tr><th>Code</th><th>Course Name</th><th>Units</th><th>Archived By</th><th>Archived At</th><th class="text-end">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.course_code||''} ${d.name||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td><span class="ctag">${d.course_code||'—'}</span><span class="arch-badge ms-2"><i class="fas fa-archive"></i> Archived</span></td>
                    <td class="fw-bold" style="color:#0f172a;">${d.name||'—'}</td>
                    <td style="font-size:.78rem;color:#64748b;">${d.credits||d.units||'—'} units</td>
                    <td><span class="archiver-pill"><i class="fas fa-user-shield"></i>${r.archiver_name}</span></td>
                    <td class="arch-meta">${formatDate(r.archived_at)}</td>
                    <td class="text-end">
                        <button class="action-btn btn-restore me-1" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                        <button class="action-btn btn-purge" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                    </td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        }
        else if (tab === 'instructors') {
            html += `<div class="tc shadow-sm"><div class="table-responsive hide-scroll"><table class="table mb-0 text-nowrap">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Department</th><th>Position</th><th>Archived By</th><th>Archived At</th><th class="text-end">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.first_name||''} ${d.last_name||''} ${d.email||''} ${d.dept_name||''} ${d.pos_title||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:#94a3b8;">EMP-${String(d.employee_id||0).padStart(4,'0')}</td>
                    <td><div class="fw-bold" style="color:#0f172a;">${d.first_name||''} ${d.last_name||''}</div><span class="arch-badge"><i class="fas fa-archive"></i> Archived</span></td>
                    <td style="font-size:.78rem;color:#64748b;">${d.email||'—'}</td>
                    <td style="font-size:.75rem;color:#475569;">${d.dept_name||'—'}</td>
                    <td style="font-size:.75rem;color:#475569;">${d.pos_title||'—'}</td>
                    <td><span class="archiver-pill"><i class="fas fa-user-shield"></i>${r.archiver_name}</span></td>
                    <td class="arch-meta">${formatDate(r.archived_at)}</td>
                    <td class="text-end">
                        <button class="action-btn btn-restore me-1" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                        <button class="action-btn btn-purge" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                    </td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        }
        else if (tab === 'enrollments') {
            const grouped = {};
            records.forEach(r => {
                const d = r.data;
                const sid = d.student_id || 'unknown';
                if (!grouped[sid]) {
                    const fname = d.student_name || '?';
                    const initials = (fname.charAt(0) + (fname.split(' ').pop().charAt(0) || '')).toUpperCase();
                    grouped[sid] = { name: fname, initials: initials, records: [] };
                }
                grouped[sid].records.push(r);
            });

            let gi = 0;
            for (let sid in grouped) {
                gi++;
                const sg = grouped[sid];
                const dropCount = sg.records.length;
                let allSearch = sg.name.toLowerCase();
                sg.records.forEach(sr => {
                    const sd = sr.data;
                    allSearch += ` ${sd.course_code||''} ${sd.course_name||''} ${sd.semester||''} ${sd.year||''}`.toLowerCase();
                });
                const latestDate = sg.records[0].archived_at;

                html += `
                <div class="enr-student-row arch-row" data-search="${allSearch}" data-date="${latestDate}" id="enr-group-${gi}">
                    <div class="enr-student-header" onclick="toggleEnr(${gi})">
                        <div class="d-flex align-items-center gap-3">
                            <div class="enr-student-avatar">${sg.initials}</div>
                            <div>
                                <div class="fw-bold" style="font-size:.85rem;color:#0f172a;">${sg.name}</div>
                                <div style="font-size:.65rem;color:#94a3b8;font-family:'JetBrains Mono',monospace;">STU-${String(sid).padStart(4,'0')}</div>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-3 ms-auto">
                            <span class="enr-drop-count"><i class="fas fa-archive" style="font-size:.6rem;"></i> ${dropCount} dropped class${dropCount!==1?'es':''}</span>
                            <i class="fas fa-chevron-down enr-chevron" id="enr-chev-${gi}"></i>
                        </div>
                    </div>
                    <div class="enr-classes-table" id="enr-body-${gi}" style="display:none;">
                        <div class="table-responsive hide-scroll"><table class="table mb-0 text-nowrap">
                            <thead><tr><th class="ps-4">Course</th><th>Term</th><th>Enroll Date</th><th>Dropped By</th><th>Dropped At</th><th class="text-end pe-4">Actions</th></tr></thead><tbody>`;
                
                sg.records.forEach(r => {
                    const d = r.data;
                    const enrDate = d.enroll_date ? new Date(d.enroll_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
                    html += `<tr>
                        <td class="ps-4">
                            <span class="ctag">${d.course_code||'—'}</span>
                            <div style="font-size:.72rem;color:#475569;margin-top:2px;">${d.course_name||'—'}</div>
                        </td>
                        <td style="font-size:.72rem;color:#64748b;font-family:'JetBrains Mono',monospace;">${d.semester||''} ${d.year||''}</td>
                        <td style="font-size:.75rem;color:#64748b;">${enrDate}</td>
                        <td><span class="archiver-pill"><i class="fas fa-user-shield"></i>${r.archiver_name}</span></td>
                        <td class="arch-meta">${formatDate(r.archived_at)}</td>
                        <td class="text-end pe-4">
                            <button class="action-btn btn-restore me-1" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                            <button class="action-btn btn-purge" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                        </td>
                    </tr>`;
                });
                html += `</tbody></table></div></div></div>`;
            }
        }

        $container.html(html);
        applyFilters();
    }

    // ── 3. ATTACH TO WINDOW (For inline HTML handlers) ──
    window.switchTab = switchTab;
    window.setDateFilter = setDateFilter;
    window.toggleEnr = toggleEnr;
    window.restoreRecord = restoreRecord;
    window.purgeRecord = purgeRecord;

    // ── 4. EVENT LISTENERS & INITIAL LOAD ──
    $('#archSearch').on('input', applyFilters);
    
    // Initial fetch
    switchTab(currentTab, false);
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
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' }
    };

    const currentPage = window.location.pathname.split('/').pop() || 'archived.html';
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
                $('#headerUserRole').text(u.role || 'Admin'); 
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'Admin');
                $('#dropdownAvatar').attr({ src: lgAvt, alt: u.name });
                $('#heroName').html(u.name + ' <span class="fs-3">👋</span>');
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
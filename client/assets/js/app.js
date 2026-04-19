document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('class_id');

    // ==========================================
    // 1. SMART ROUTING LOGIC
    // ==========================================
    if (!classId) {
        // Mode: Achievement Board (from Sidebar)
        initAchievementBoard();
    } else {
        // Mode: Course Modules (from inside a class)
        initClassModules(classId);
    }

    // --- Scenario A: Achievement Board ---
    function initAchievementBoard() {
        // 1. Hide the classroom navigation tabs
        const tabs = document.querySelector('.nav.bg-white.border-bottom');
        if (tabs) tabs.classList.add('d-none');
        
        // 2. Change page text
        const myElement = document.getElementById('someElementId');
        if (myElement) {
            myElement.textContent = "Some text";
        }
        
        // 3. Load Stats 
        // SAFETY FIX: Check if the container actually exists before injecting HTML!
        const container = document.getElementById('moduleContainer');
        if (container) {
            container.innerHTML = `
                <div class="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                    <div class="mb-4">
                        <i class="fas fa-trophy fa-4x text-warning"></i>
                    </div>
                    <h3 class="fw-bold">Your Achievement Board</h3>
                    <p class="text-muted mb-4">View your total XP and earned badges across all courses.</p>
                    <div class="d-flex justify-content-center gap-3">
                        <div class="p-3 border rounded-3 bg-light" style="min-width: 120px;">
                            <div class="fs-2 fw-bold text-dark">0</div>
                            <div class="small fw-bold text-uppercase text-muted">Total XP</div>
                        </div>
                        <div class="p-3 border rounded-3 bg-light" style="min-width: 120px;">
                            <div class="fs-2 fw-bold text-dark">0</div>
                            <div class="small fw-bold text-uppercase text-muted">Badges</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // --- Scenario B: Class Modules ---
    function initClassModules(cid) {
        // 1. Sync tab links so you stay in the right class
        const tabChat = document.getElementById('tabChat');
        const tabModules = document.getElementById('tabModules');
        const tabTasks = document.getElementById('tabTasks');
        
        if(tabChat) tabChat.href = `collaborations.html?class_id=${cid}`;
        if(tabModules) tabModules.href = `modules.html?class_id=${cid}`;
        if(tabTasks) tabTasks.href = `todo.html?class_id=${cid}`;

        // 2. Fetch Modules from API
        fetch(`/artisansLMS/backend/endpoints/resources.php?action=get_modules&class_id=${cid}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    renderModules(data.resources);
                    const courseDesc = document.getElementById('courseDescription');
                    if (data.course_name && courseDesc) {
                        courseDesc.textContent = `Learning resources for ${data.course_name}`;
                    }
                } else {
                    showEmptyState();
                }
            })
            .catch(err => {
                console.error('Error fetching modules:', err);
                showEmptyState();
            });
    }

    // --- Helper Functions ---
    function renderModules(files) {
        const container = document.getElementById('moduleContainer');
        if (!container) return; // Safety check
        
        if (!files || files.length === 0) {
            showEmptyState();
            return;
        }

        container.innerHTML = files.map(file => {
            const ext = file.file_path.split('.').pop().toLowerCase();
            const config = getFileIconConfig(ext);

            return `
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-2 bg-white">
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
        const container = document.getElementById('moduleContainer');
        const emptyState = document.getElementById('emptyState');
        if (container) container.classList.add('d-none');
        if (emptyState) emptyState.classList.remove('d-none');
    }
});
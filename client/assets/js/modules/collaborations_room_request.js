/**
 * collaborations_room_request.js
 * client/assets/js/modules/collaborations_room_request.js
 *
 * ── Plug into collaborations.js ───────────────────────────────────────────────
 * 1. Top of file:
 *      import { initRoomRequest, renderRoomSystemMessage } from './collaborations_room_request.js';
 *
 * 2. Inside initChatView(), after populateRoomInfo(data):
 *      initRoomRequest(classId, currentUser, isTeacher);
 *
 * 3. Inside onChildAdded, BEFORE the existing `if (m.is_system)` block:
 *      if (m.is_system && (m.type === 'room_approved' || m.type === 'room_rejected')) {
 *          renderRoomSystemMessage(m, box);
 *          return;
 *      }
 */

const API = '/artisansLMS/backend/api/submit_schedule_request.php';

// ── Init ──────────────────────────────────────────────────────────────────────
export function initRoomRequest(classId, currentUser, isTeacher) {
    if (!isTeacher) return;

    const btn = document.getElementById('roomRequestBtn');
    if (!btn) return;
    btn.classList.remove('d-none');

    const dateEl = document.getElementById('rrDate');
    if (dateEl) dateEl.min = new Date().toISOString().split('T')[0];

    btn.addEventListener('click', () => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('roomRequestModal')).show();
        loadRooms();
        loadHistory(classId);
    });

    document.getElementById('rrRefreshBtn')
        ?.addEventListener('click', () => loadHistory(classId));

    document.getElementById('rrRoom')?.addEventListener('change', function () {
        const opt  = this.options[this.selectedIndex];
        const hint = document.getElementById('rrRoomHint');
        if (this.value && opt.dataset.location) {
            document.getElementById('rrRoomHintText').textContent =
                `${opt.dataset.location} · Capacity: ${opt.dataset.capacity}`;
            hint.classList.remove('d-none');
        } else {
            hint.classList.add('d-none');
        }
    });

    document.getElementById('rrSubmitBtn')
        ?.addEventListener('click', () => submitRequest(classId));
}

// ── Load rooms ────────────────────────────────────────────────────────────────
async function loadRooms() {
    const sel = document.getElementById('rrRoom');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading…</option>';
    try {
        const data = await apiFetch(`${API}?action=get_rooms`);
        if (data.status === 'success' && data.rooms.length) {
            sel.innerHTML = '<option value="">— Any available room —</option>' +
                data.rooms.map(r =>
                    `<option value="${r.room_id}" data-location="${r.location}" data-capacity="${r.capacity}">
                        ${r.name} (cap. ${r.capacity})
                    </option>`
                ).join('');
        } else {
            sel.innerHTML = '<option value="">No rooms found</option>';
        }
    } catch {
        sel.innerHTML = '<option value="">Failed to load</option>';
    }
}

// ── Load history ──────────────────────────────────────────────────────────────
async function loadHistory(classId) {
    const el = document.getElementById('rrHistoryList');
    if (!el) return;
    el.innerHTML = `<div class="text-center text-muted small py-4">
        <div class="spinner-border spinner-border-sm mb-2" role="status"></div><div>Loading…</div>
    </div>`;

    try {
        const data = await apiFetch(`${API}?action=get_my_requests&class_id=${classId}`);
        if (!data.requests?.length) {
            el.innerHTML = `<div class="text-center text-muted small py-5">
                <i class="fas fa-calendar-times fs-2 opacity-25 d-block mb-2"></i>No requests yet.
            </div>`;
            return;
        }

        el.innerHTML = data.requests.map(r => {
            const cfg = {
                pending:  ['bg-warning text-dark',  'fa-clock'],
                approved: ['bg-success text-white',  'fa-check-circle'],
                rejected: ['bg-danger text-white',   'fa-times-circle'],
            };
            const [cls, icon] = cfg[r.status] ?? ['bg-secondary text-white', 'fa-circle'];
            const dateStr = new Date(r.requested_date + 'T00:00:00')
                .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            return `
            <div class="card border-0 shadow-sm rounded-3 p-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="fw-bold small text-dark">
                        ${r.room_name
                            ? `<i class="fas fa-building me-1 text-muted"></i>${r.room_name}`
                            : '<span class="text-muted fst-italic">Any room</span>'}
                    </div>
                    <span class="badge ${cls} rounded-pill" style="font-size:.65rem;">
                        <i class="fas ${icon} me-1"></i>${r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                </div>
                <div class="text-muted mt-1" style="font-size:.72rem;">
                    <i class="far fa-calendar me-1 text-primary"></i>${dateStr}
                    &nbsp;·&nbsp;${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}
                </div>
                ${r.purpose ? `<div class="text-muted fst-italic mt-1" style="font-size:.7rem;">"${r.purpose}"</div>` : ''}
                ${r.admin_note ? `<div class="small text-muted mt-1"><i class="fas fa-comment-alt me-1"></i>${r.admin_note}</div>` : ''}
                ${r.status === 'pending'
                    ? `<button class="btn btn-link btn-sm p-0 text-danger fw-bold text-decoration-none mt-2 rr-cancel"
                               data-id="${r.request_id}">
                           <i class="fas fa-trash-alt me-1"></i>Cancel
                       </button>` : ''}
            </div>`;
        }).join('');

        el.querySelectorAll('.rr-cancel').forEach(btn => {
            btn.addEventListener('click', async function () {
                if (!confirm('Cancel this request?')) return;
                const res = await postJSON({ action: 'cancel', request_id: +this.dataset.id });
                showAlert(res.status === 'success' ? 'success' : 'danger', res.message);
                if (res.status === 'success') loadHistory(classId);
            });
        });
    } catch {
        el.innerHTML = `<div class="text-danger small text-center py-3">Failed to load.</div>`;
    }
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function submitRequest(classId) {
    const roomId  = document.getElementById('rrRoom')?.value    || null;
    const date    = document.getElementById('rrDate')?.value    || '';
    const start   = document.getElementById('rrStart')?.value   || '';
    const end     = document.getElementById('rrEnd')?.value     || '';
    const purpose = document.getElementById('rrPurpose')?.value?.trim() || '';

    if (!date || !start || !end) return showAlert('warning', 'Date, start and end time are required.');
    if (start >= end)            return showAlert('warning', 'End time must be after start time.');

    const btn = document.getElementById('rrSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting…';

    try {
        const data = await postJSON({ action: 'submit', class_id: classId, room_id: roomId,
            requested_date: date, start_time: start, end_time: end, purpose });

        if (data.status === 'success') {
            showAlert('success', "📨 Submitted! You'll be notified here when the scheduling office responds.");
            ['rrRoom','rrDate','rrStart','rrEnd','rrPurpose'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            document.getElementById('rrRoomHint')?.classList.add('d-none');
            loadHistory(classId);
        } else {
            showAlert('danger', data.message || 'Something went wrong.');
        }
    } catch {
        showAlert('danger', 'Network error. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Submit to Scheduling Office';
    }
}

// ── Chat renderer (called from collaborations.js onChildAdded) ────────────────
export function renderRoomSystemMessage(m, box) {
    let html = '';
    if (m.type === 'room_approved' && m.room) {
        const { name, location, capacity } = m.room;
        const { date, start, end } = m.schedule ?? {};
        html = `
        <div class="d-flex justify-content-center my-3">
            <div class="card border-0 shadow rounded-4 overflow-hidden" style="max-width:340px;width:100%;">
                <div class="px-4 py-2 d-flex align-items-center gap-2 bg-success">
                    <i class="fas fa-check-circle text-white"></i>
                    <span class="fw-bold text-white small">Room Approved</span>
                </div>
                <div class="p-3 bg-white">
                    <div class="fw-bold text-dark mb-1"><i class="fas fa-building me-2 text-success"></i>${name}</div>
                    ${location ? `<div class="text-muted small mb-2"><i class="fas fa-map-pin me-2"></i>${location}${capacity ? ' · Cap: '+capacity : ''}</div>` : ''}
                    <hr class="my-2">
                    <div class="small fw-bold text-dark"><i class="far fa-calendar me-2 text-primary"></i>${date ?? '—'}</div>
                    <div class="small text-muted mt-1"><i class="far fa-clock me-2 text-primary"></i>${start ?? '—'} – ${end ?? '—'}</div>
                    ${m.admin_note ? `<div class="mt-2 small text-muted fst-italic border-top pt-2"><i class="fas fa-comment-alt me-1"></i>${m.admin_note}</div>` : ''}
                </div>
            </div>
        </div>`;
    } else {
        html = `<div class="text-center my-2">
            <span class="badge bg-danger text-white px-3 py-2 rounded-pill shadow-sm" style="font-size:.75rem;">
                <i class="fas fa-times-circle me-1"></i>${m.text || 'Room request declined.'}
            </span>
        </div>`;
    }
    box.insertAdjacentHTML('beforeend', html);
    box.scrollTop = box.scrollHeight;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiFetch(url) { return (await fetch(url)).json(); }
async function postJSON(body) {
    return (await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
}
function showAlert(type, msg) {
    const el = document.getElementById('roomRequestAlert');
    if (!el) return;
    el.className = `alert alert-${type} mb-3 small py-2 px-3 rounded-3`;
    el.textContent = msg;
    el.classList.remove('d-none');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('d-none'), 6000);
}
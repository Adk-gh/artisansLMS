/**
 * collaborations_room_request.js
 * client/assets/js/modules/collaborations_room_request.js
 *
 * Two-tab modal: Room requests | Resource requests
 * Resources use a searchable dropdown → basket UI.
 */

const API = '/artisansLMS/backend/api/submit_schedule_request.php';

// ── Module state ──────────────────────────────────────────────────────────────
let _allResources  = [];   // full list fetched once
let _basket        = [];   // [{resource_id, resource_name, type, quantity}]
let _activeTab     = 'room';

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════
export function initRoomRequest(classId, currentUser, isTeacher) {
    if (!isTeacher) return;

    const btn = document.getElementById('roomRequestBtn');
    if (!btn) return;
    btn.classList.remove('d-none');

    // Set min date on both date inputs
    const today = new Date().toISOString().split('T')[0];
    ['rrDate', 'rrResDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.min = today;
    });

    // Open modal
    btn.addEventListener('click', () => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('roomRequestModal')).show();
        switchTab('room');
        loadRooms();
        loadResources();
        loadHistory(classId);
    });

    // Tab switching
    document.getElementById('tabRoomBtn')?.addEventListener('click',     () => switchTab('room'));
    document.getElementById('tabResourceBtn')?.addEventListener('click', () => switchTab('resource'));

    // Room hint on select change
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

    // Room submit
    document.getElementById('rrSubmitBtn')?.addEventListener('click', () => submitRoomRequest(classId));

    // Resource search
    document.getElementById('rrResSearch')?.addEventListener('input', function () {
        renderDropdown(this.value.trim().toLowerCase());
    });
    document.getElementById('rrResSearch')?.addEventListener('focus', function () {
        if (_allResources.length) renderDropdown(this.value.trim().toLowerCase());
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('#rrResSearch') && !e.target.closest('#rrResDropdown')) {
            document.getElementById('rrResDropdown')?.classList.add('d-none');
        }
    });

    // Resource submit
    document.getElementById('rrResSubmitBtn')?.addEventListener('click', () => submitResourceRequest(classId));

    // Shared refresh
    document.getElementById('rrRefreshBtn')?.addEventListener('click', () => loadHistory(classId));
}

// ── Tab switch ────────────────────────────────────────────────────────────────
function switchTab(tab) {
    _activeTab = tab;
    document.getElementById('rrTabRoom').classList.toggle('d-none',     tab !== 'room');
    document.getElementById('rrTabResource').classList.toggle('d-none', tab !== 'resource');
    document.getElementById('tabRoomBtn').classList.toggle('active',     tab === 'room');
    document.getElementById('tabResourceBtn').classList.toggle('active', tab === 'resource');
    document.getElementById('roomRequestAlert')?.classList.add('d-none');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOM TAB
// ═══════════════════════════════════════════════════════════════════════════════
async function loadRooms() {
    const sel = document.getElementById('rrRoom');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading…</option>';
    try {
        const data = await apiFetch(`${API}?action=get_rooms`);
        if (data.status === 'success' && data.rooms?.length) {
            sel.innerHTML = '<option value="">— Any available room —</option>' +
                data.rooms.map(r =>
                    `<option value="${r.room_id}" data-location="${escAttr(r.location ?? '')}" data-capacity="${escAttr(r.capacity ?? '')}">
                        ${escHtml(r.name)}${r.capacity ? ' (cap. ' + r.capacity + ')' : ''}
                    </option>`
                ).join('');
        } else {
            sel.innerHTML = '<option value="">No rooms found</option>';
        }
    } catch {
        sel.innerHTML = '<option value="">Failed to load</option>';
    }
}

async function submitRoomRequest(classId) {
    const roomId  = document.getElementById('rrRoom')?.value  || null;
    const date    = document.getElementById('rrDate')?.value  || '';
    const start   = document.getElementById('rrStart')?.value || '';
    const end     = document.getElementById('rrEnd')?.value   || '';
    const purpose = document.getElementById('rrPurpose')?.value?.trim() || '';

    if (!date || !start || !end) return showAlert('warning', 'Date, start and end time are required.');
    if (start >= end)            return showAlert('warning', 'End time must be after start time.');

    const btn = document.getElementById('rrSubmitBtn');
    setLoading(btn, true, 'Submitting…');

    try {
        const data = await postJSON({
            action: 'submit', class_id: classId, room_id: roomId,
            requested_date: date, start_time: start, end_time: end,
            purpose, resources: [],
        });
        if (data.status === 'success') {
            showAlert('success', "📨 Submitted! You'll be notified here when the scheduling office responds.");
            resetRoomForm();
            loadHistory(classId);
        } else {
            showAlert('danger', data.message || 'Something went wrong.');
        }
    } catch {
        showAlert('danger', 'Network error. Please try again.');
    } finally {
        setLoading(btn, false, '<i class="fas fa-paper-plane me-2"></i>Submit to Scheduling Office');
    }
}

function resetRoomForm() {
    ['rrRoom','rrDate','rrStart','rrEnd','rrPurpose'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('rrRoomHint')?.classList.add('d-none');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RESOURCE TAB
// ═══════════════════════════════════════════════════════════════════════════════
async function loadResources() {
    if (_allResources.length) return;
    try {
        const data = await apiFetch(`${API}?action=get_resources`);
        if (data.status === 'success' && data.resources?.length) {
            _allResources = data.resources;
        }
    } catch { /* silent */ }
}

function renderDropdown(query) {
    const drop = document.getElementById('rrResDropdown');
    if (!drop) return;

    const basketIds = new Set(_basket.map(b => b.resource_id));
    const filtered  = (_allResources.length && query
        ? _allResources.filter(r =>
            r.name.toLowerCase().includes(query) ||
            (r.type ?? r.category ?? '').toLowerCase().includes(query))
        : _allResources
    ).filter(r => !basketIds.has(+r.resource_id));

    if (!filtered.length) {
        drop.innerHTML = `<div class="text-center text-muted small py-3 fst-italic">${_allResources.length ? 'No matches.' : 'No resources available.'}</div>`;
        drop.classList.remove('d-none');
        return;
    }

    drop.innerHTML = filtered.map(r => `
        <div class="rr-res-item d-flex align-items-center gap-2 px-3 py-2"
             data-id="${r.resource_id}" data-name="${escAttr(r.name)}" data-type="${escAttr(r.type ?? r.category ?? '')}">
            <div class="flex-grow-1">
                <div class="small fw-semibold text-dark">${escHtml(r.name)}</div>
                ${(r.type ?? r.category) ? `<div class="text-muted" style="font-size:.68rem;">${escHtml(r.type ?? r.category)}</div>` : ''}
            </div>
            <i class="fas fa-plus text-primary opacity-50" style="font-size:.75rem;"></i>
        </div>`).join('');

    drop.classList.remove('d-none');

    drop.querySelectorAll('.rr-res-item').forEach(item => {
        item.addEventListener('mousedown', e => {
            e.preventDefault(); // prevent search blur before click fires
            addToBasket({ resource_id: +item.dataset.id, resource_name: item.dataset.name, type: item.dataset.type, quantity: 1 });
            document.getElementById('rrResSearch').value = '';
            drop.classList.add('d-none');
        });
    });
}

function addToBasket(resource) {
    if (_basket.find(b => b.resource_id === resource.resource_id)) return;
    _basket.push(resource);
    renderBasket();
}

function removeFromBasket(resourceId) {
    _basket = _basket.filter(b => b.resource_id !== resourceId);
    renderBasket();
}

function renderBasket() {
    const basket  = document.getElementById('rrResBasket');
    const empty   = document.getElementById('rrResBasketEmpty');
    const counter = document.getElementById('rrResCount');
    if (!basket) return;

    if (counter) counter.textContent = _basket.length;
    basket.querySelectorAll('.rr-basket-item').forEach(el => el.remove());

    if (!_basket.length) {
        empty?.classList.remove('d-none');
        return;
    }
    empty?.classList.add('d-none');

    _basket.forEach(res => {
        const div = document.createElement('div');
        div.className   = 'rr-basket-item d-flex align-items-center gap-2';
        div.dataset.id  = res.resource_id;
        div.innerHTML   = `
            <div class="flex-grow-1 min-w-0">
                <div class="small fw-semibold text-dark text-truncate">${escHtml(res.resource_name)}</div>
                ${res.type ? `<div class="text-muted" style="font-size:.65rem;">${escHtml(res.type)}</div>` : ''}
            </div>
            <div class="d-flex align-items-center gap-1 flex-shrink-0">
                <label class="text-muted mb-0" style="font-size:.7rem;">Qty</label>
                <input type="number" class="form-control form-control-sm border shadow-none text-center rr-basket-qty"
                       data-id="${res.resource_id}" value="${res.quantity}" min="1" style="width:54px;">
            </div>
            <button class="btn btn-link btn-sm p-0 text-danger rr-basket-remove flex-shrink-0" data-id="${res.resource_id}" title="Remove">
                <i class="fas fa-times"></i>
            </button>`;
        basket.appendChild(div);
    });

    basket.querySelectorAll('.rr-basket-qty').forEach(input => {
        input.addEventListener('change', function () {
            const item = _basket.find(b => b.resource_id === +this.dataset.id);
            if (item) item.quantity = Math.max(1, +this.value || 1);
        });
    });
    basket.querySelectorAll('.rr-basket-remove').forEach(btn => {
        btn.addEventListener('click', function () { removeFromBasket(+this.dataset.id); });
    });
}

async function submitResourceRequest(classId) {
    if (!_basket.length) return showAlert('warning', 'Please select at least one resource.');

    const date    = document.getElementById('rrResDate')?.value  || '';
    const start   = document.getElementById('rrResStart')?.value || '';
    const end     = document.getElementById('rrResEnd')?.value   || '';
    const purpose = document.getElementById('rrResPurpose')?.value?.trim() || '';

    if (!date || !start || !end) return showAlert('warning', 'Date, start and end time are required.');
    if (start >= end)            return showAlert('warning', 'End time must be after start time.');

    const btn = document.getElementById('rrResSubmitBtn');
    setLoading(btn, true, 'Submitting…');

    try {
        const data = await postJSON({
            action: 'submit', class_id: classId, room_id: null,
            requested_date: date, start_time: start, end_time: end, purpose,
            resources: _basket.map(b => ({ resource_id: b.resource_id, resource_name: b.resource_name, quantity: b.quantity })),
        });
        if (data.status === 'success') {
            showAlert('success', "📨 Resource request submitted! You'll be notified when it's reviewed.");
            resetResourceForm();
            loadHistory(classId);
        } else {
            showAlert('danger', data.message || 'Something went wrong.');
        }
    } catch {
        showAlert('danger', 'Network error. Please try again.');
    } finally {
        setLoading(btn, false, '<i class="fas fa-paper-plane me-2"></i>Submit Resource Request');
    }
}

function resetResourceForm() {
    _basket = [];
    renderBasket();
    ['rrResDate','rrResStart','rrResEnd','rrResPurpose'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const s = document.getElementById('rrResSearch'); if (s) s.value = '';
    document.getElementById('rrResDropdown')?.classList.add('d-none');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
async function loadHistory(classId) {
    const el = document.getElementById('rrHistoryList');
    if (!el) return;
    el.innerHTML = `<div class="text-center text-muted small py-4">
        <div class="spinner-border spinner-border-sm mb-2" role="status"></div><div>Loading…</div></div>`;

    try {
        const data = await apiFetch(`${API}?action=get_my_requests&class_id=${classId}`);
        if (!data.requests?.length) {
            el.innerHTML = `<div class="text-center text-muted small py-5">
                <i class="fas fa-calendar-times fs-2 opacity-25 d-block mb-2"></i>No requests yet.</div>`;
            return;
        }

        el.innerHTML = data.requests.map(r => {
            const cfg = {
                pending:  ['bg-warning text-dark', 'fa-clock'],
                approved: ['bg-success text-white', 'fa-check-circle'],
                rejected: ['bg-danger text-white',  'fa-times-circle'],
            };
            const [cls, icon] = cfg[r.status] ?? ['bg-secondary text-white', 'fa-circle'];
            const dateStr = new Date(r.requested_date + 'T00:00:00')
                .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            const hasRoom      = !!r.room_name;
            const hasResources = r.resources?.length > 0;
            const typeBadge    = hasRoom && hasResources
                ? `<span class="badge bg-info bg-opacity-10 text-info border border-info-subtle" style="font-size:.6rem;"><i class="fas fa-layer-group me-1"></i>Room + Resources</span>`
                : hasRoom
                    ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle" style="font-size:.6rem;"><i class="fas fa-building me-1"></i>Room</span>`
                    : hasResources
                        ? `<span class="badge bg-warning bg-opacity-10 text-warning border border-warning-subtle" style="font-size:.6rem;"><i class="fas fa-box-open me-1"></i>Resources</span>`
                        : '';

            const resTags = hasResources
                ? `<div class="d-flex flex-wrap gap-1 mt-2">${r.resources.map(res =>
                    `<span class="badge bg-light text-dark border" style="font-size:.62rem;">
                        <i class="fas fa-box-open me-1 text-muted opacity-75"></i>${escHtml(res.resource_name)}${res.quantity > 1 ? ` ×${res.quantity}` : ''}
                    </span>`).join('')}</div>`
                : '';

            return `
            <div class="card border-0 shadow-sm rounded-3 p-3">
                <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        ${typeBadge}
                        ${hasRoom ? `<div class="fw-bold small text-dark"><i class="fas fa-building me-1 text-muted opacity-75"></i>${escHtml(r.room_name)}</div>` : ''}
                    </div>
                    <span class="badge ${cls} rounded-pill flex-shrink-0" style="font-size:.65rem;">
                        <i class="fas ${icon} me-1"></i>${r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                </div>
                <div class="text-muted mt-1" style="font-size:.72rem;">
                    <i class="far fa-calendar me-1 text-primary"></i>${dateStr}
                    &nbsp;·&nbsp;${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}
                </div>
                ${resTags}
                ${r.purpose ? `<div class="text-muted fst-italic mt-2" style="font-size:.7rem;">"${escHtml(r.purpose)}"</div>` : ''}
                ${r.admin_note ? `<div class="small text-muted mt-1"><i class="fas fa-comment-alt me-1"></i>${escHtml(r.admin_note)}</div>` : ''}
                ${r.status === 'pending'
                    ? `<button class="btn btn-link btn-sm p-0 text-danger fw-bold text-decoration-none mt-2 rr-cancel" data-id="${r.request_id}">
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

// ═══════════════════════════════════════════════════════════════════════════════
//  CHAT RENDERER  (exported — called from collaborations.js)
// ═══════════════════════════════════════════════════════════════════════════════
export function renderRoomSystemMessage(m, box) {
    let html = '';
    if (m.type === 'room_approved' && m.room) {
        const { name, location, capacity } = m.room;
        const { date, start, end } = m.schedule ?? {};
        const resourceRows = m.resources?.length
            ? `<div class="mt-2 pt-2 border-top">
                <div class="small fw-bold text-muted mb-1"><i class="fas fa-box-open me-1"></i>Resources</div>
                ${m.resources.map(r => `<div class="small text-dark"><i class="fas fa-check text-success me-1" style="font-size:.6rem;"></i>${escHtml(r.resource_name)}${r.quantity > 1 ? ` <span class="text-muted">×${r.quantity}</span>` : ''}</div>`).join('')}
               </div>`
            : '';

        html = `
        <div class="d-flex justify-content-center my-3">
            <div class="card border-0 shadow rounded-4 overflow-hidden" style="max-width:340px;width:100%;">
                <div class="px-4 py-2 d-flex align-items-center gap-2 bg-success">
                    <i class="fas fa-check-circle text-white"></i>
                    <span class="fw-bold text-white small">Room Approved</span>
                </div>
                <div class="p-3 bg-white">
                    <div class="fw-bold text-dark mb-1"><i class="fas fa-building me-2 text-success"></i>${escHtml(name)}</div>
                    ${location ? `<div class="text-muted small mb-2"><i class="fas fa-map-pin me-2"></i>${escHtml(location)}${capacity ? ' · Cap: ' + capacity : ''}</div>` : ''}
                    <hr class="my-2">
                    <div class="small fw-bold text-dark"><i class="far fa-calendar me-2 text-primary"></i>${date ?? '—'}</div>
                    <div class="small text-muted mt-1"><i class="far fa-clock me-2 text-primary"></i>${start ?? '—'} – ${end ?? '—'}</div>
                    ${resourceRows}
                    ${m.admin_note ? `<div class="mt-2 small text-muted fst-italic border-top pt-2"><i class="fas fa-comment-alt me-1"></i>${escHtml(m.admin_note)}</div>` : ''}
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
async function apiFetch(url)  { return (await fetch(url)).json(); }
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
function setLoading(btn, loading, label) {
    btn.disabled  = loading;
    btn.innerHTML = loading ? '<span class="spinner-border spinner-border-sm me-2"></span>' + label : label;
}
function escHtml(str)  { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(str)  { return escHtml(str); }
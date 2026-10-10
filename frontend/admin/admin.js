/**
 * Quanticus Administration System - Client Application Logic
 * Pure Vanilla JS, accessible, responsive, secure against XSS (uses textContent).
 */

(function () {
  'use strict';

  // State
  const state = {
    user: null,
    currentTab: 'requests', // 'requests' | 'applications' | 'roles' | 'directors'
    contactRequests: [],
    applications: [],
    roles: [],
    directors: [],
    filters: {
      contactStatus: 'all',
      contactSearch: '',
      appStatus: 'all',
      appRole: 'all',
      appSearch: '',
      roleSearch: '',
      directorsStatus: 'all',
      directorsSearch: ''
    }
  };

  // DOM Elements
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const loginForm = document.getElementById('loginForm');
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');

  const adminUserEmailDisplay = document.getElementById('adminUserEmail');
  const logoutBtn = document.getElementById('logoutBtn');

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
  const tabPanes = document.querySelectorAll('.tab-pane[data-pane]');
  const contactBadgeCount = document.getElementById('contactBadgeCount');
  const appsBadgeCount = document.getElementById('appsBadgeCount');
  const rolesBadgeCount = document.getElementById('rolesBadgeCount');
  const directorsBadgeCount = document.getElementById('directorsBadgeCount');

  // Modals
  const detailModal = document.getElementById('detailModal');
  const detailModalTitle = document.getElementById('detailModalTitle');
  const detailModalSubtitle = document.getElementById('detailModalSubtitle');
  const detailModalBody = document.getElementById('detailModalBody');
  const detailModalActions = document.getElementById('detailModalActions');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');

  const roleModal = document.getElementById('roleModal');
  const roleModalTitle = document.getElementById('roleModalTitle');
  const roleForm = document.getElementById('roleForm');
  const roleIdInput = document.getElementById('roleId');
  const roleTitleInput = document.getElementById('roleTitle');
  const roleDeptInput = document.getElementById('roleDept');
  const roleTagInput = document.getElementById('roleTag');
  const roleStatusInput = document.getElementById('roleStatus');
  const roleDescInput = document.getElementById('roleDesc');
  const closeRoleModalBtn = document.getElementById('closeRoleModalBtn');
  const addRoleBtn = document.getElementById('addRoleBtn');

  // Director Elements
  const directorsTableBody = document.getElementById('directorsTableBody');
  const directorsSearchInput = document.getElementById('directorsSearchInput');
  const directorsFilterChips = document.getElementById('directorsFilterChips');
  const addDirectorBtn = document.getElementById('addDirectorBtn');

  const directorModal = document.getElementById('directorModal');
  const directorModalTitle = document.getElementById('directorModalTitle');
  const directorForm = document.getElementById('directorForm');
  const directorIdInput = document.getElementById('directorId');
  const directorNameInput = document.getElementById('directorName');
  const directorRoleInput = document.getElementById('directorRole');
  const directorVisibleInput = document.getElementById('directorVisible');
  const removePhotoFlag = document.getElementById('removePhotoFlag');
  const directorPhotoInput = document.getElementById('directorPhotoInput');
  const choosePhotoBtn = document.getElementById('choosePhotoBtn');
  const choosePhotoBtnText = document.getElementById('choosePhotoBtnText');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const directorPreviewImg = document.getElementById('directorPreviewImg');
  const directorPreviewInitials = document.getElementById('directorPreviewInitials');
  const directorModalError = document.getElementById('directorModalError');
  const closeDirectorModalBtn = document.getElementById('closeDirectorModalBtn');
  const cancelDirectorBtn = document.getElementById('cancelDirectorBtn');
  const saveDirectorBtn = document.getElementById('saveDirectorBtn');

  const confirmModal = document.getElementById('confirmModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalText = document.getElementById('confirmModalText');
  const confirmActionBtn = document.getElementById('confirmActionBtn');
  const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

  const toastContainer = document.getElementById('toastContainer');

  // =========================================================================
  // NOTIFICATIONS / TOASTS
  // =========================================================================
  function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Helper for copyable ref code badge
  function createRefCodeBadge(refCode, fallbackId) {
    const code = refCode || (fallbackId ? `#${fallbackId}` : '—');
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'ref-code-badge';
    badge.textContent = code;
    badge.title = 'Click to copy Reference ID';

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(code).then(() => {
        badge.textContent = 'Copied!';
        badge.classList.add('copied');
        setTimeout(() => {
          badge.textContent = code;
          badge.classList.remove('copied');
        }, 1500);
      }).catch(() => {
        showToast('Reference copied', 'success');
      });
    });

    return badge;
  }

  // Request Sequence Tokens (to prevent stale/out-of-order responses)
  let contactReqSeq = 0;
  let appsReqSeq = 0;
  let rolesReqSeq = 0;
  let directorsReqSeq = 0;

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.admin) {
          state.user = data.admin;
          showDashboard();
          return;
        }
      }
      showLogin();
    } catch {
      showLogin();
    }
  }

  function showLogin() {
    state.user = null;
    state.contactRequests = [];
    state.applications = [];
    state.roles = [];
    state.directors = [];
    if (contactBadgeCount) {
      contactBadgeCount.textContent = '0';
      contactBadgeCount.classList.remove('badge-new');
    }
    if (appsBadgeCount) {
      appsBadgeCount.textContent = '0';
      appsBadgeCount.classList.remove('badge-new');
    }
    if (rolesBadgeCount) rolesBadgeCount.textContent = '0';
    if (directorsBadgeCount) directorsBadgeCount.textContent = '0';
    if (loginSection) loginSection.hidden = false;
    if (dashboardSection) dashboardSection.hidden = true;
    if (loginErrorMsg) loginErrorMsg.hidden = true;
    if (loginPasswordInput) loginPasswordInput.value = '';
  }

  function showDashboard() {
    if (loginSection) loginSection.hidden = true;
    if (dashboardSection) dashboardSection.hidden = false;
    if (adminUserEmailDisplay && state.user) {
      adminUserEmailDisplay.textContent = state.user.email;
    }
    loadAllDashboardData();
  }

  async function loadAllDashboardData() {
    return Promise.allSettled([
      fetchContactRequests(),
      fetchApplications(),
      fetchRoles(),
      fetchDirectors()
    ]);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;

      if (!email || !password) {
        loginErrorMsg.textContent = 'Please enter your email and password.';
        loginErrorMsg.hidden = false;
        return;
      }

      loginSubmitBtn.disabled = true;
      loginSubmitBtn.textContent = 'Signing in...';
      loginErrorMsg.hidden = true;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          state.user = data.admin;
          showToast('Welcome back to Quanticus Admin!', 'success');
          showDashboard();
        } else {
          loginErrorMsg.textContent = data.error || 'Invalid email or password.';
          loginErrorMsg.hidden = false;
        }
      } catch {
        loginErrorMsg.textContent = 'Unable to connect to server. Please try again.';
        loginErrorMsg.hidden = false;
      } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = 'Sign In';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          credentials: 'same-origin'
        });
      } catch {}
      showToast('You have been logged out.', 'success');
      showLogin();
    });
  }

  // =========================================================================
  // TAB CONTROLS
  // =========================================================================
  function switchTab(tabName) {
    state.currentTab = tabName;
    tabButtons.forEach((btn) => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    tabPanes.forEach((pane) => {
      pane.hidden = (pane.getAttribute('data-pane') !== tabName);
    });

    loadCurrentTabData();
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  function loadCurrentTabData() {
    if (state.currentTab === 'requests') {
      fetchContactRequests();
    } else if (state.currentTab === 'applications') {
      fetchApplications();
    } else if (state.currentTab === 'roles') {
      fetchRoles();
    } else if (state.currentTab === 'directors') {
      fetchDirectors();
    }
  }

  // =========================================================================
  // 1. CLIENT REQUESTS TAB
  // =========================================================================
  async function fetchContactRequests() {
    const seq = ++contactReqSeq;
    const tableBody = document.getElementById('contactTableBody');
    if (tableBody && state.currentTab === 'requests') {
      tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading client inquiries...</td></tr>';
    }

    try {
      const params = new URLSearchParams();
      if (state.filters.contactStatus !== 'all') params.append('status', state.filters.contactStatus);
      if (state.filters.contactSearch) params.append('q', state.filters.contactSearch);

      const res = await fetch(`/api/admin/contact?${params.toString()}`, { credentials: 'same-origin' });
      if (res.status === 401) return showLogin();

      const data = await res.json();
      if (seq !== contactReqSeq) return;

      if (data.success) {
        state.contactRequests = data.items || [];
        if (contactBadgeCount) {
          const newCount = typeof data.counts?.new === 'number' ? data.counts.new : 0;
          contactBadgeCount.textContent = newCount;
          if (newCount > 0) {
            contactBadgeCount.classList.add('badge-new');
          } else {
            contactBadgeCount.classList.remove('badge-new');
          }
        }
        renderContactTable(state.contactRequests);
      }
    } catch {
      if (seq !== contactReqSeq) return;
      if (tableBody && state.currentTab === 'requests') {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-state"><div class="empty-title">Failed to load inquiries</div><p>Please check your connection and refresh.</p></td></tr>';
      }
    }
  }

  function renderContactTable(items) {
    const tableBody = document.getElementById('contactTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty-state">
            <div class="empty-title">No client requests found</div>
            <p>New inquiries submitted from the website will appear here.</p>
          </td>
        </tr>
      `;
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.tabIndex = 0;

      // Reference ID (Copyable)
      const tdRef = document.createElement('td');
      tdRef.appendChild(createRefCodeBadge(item.ref_code, item.id));

      // Name & Email
      const tdName = document.createElement('td');
      const nameDiv = document.createElement('div');
      nameDiv.style.fontWeight = '600';
      nameDiv.textContent = item.full_name;
      const emailDiv = document.createElement('div');
      emailDiv.style.fontSize = '0.8125rem';
      emailDiv.style.color = 'var(--color-text-secondary)';
      emailDiv.textContent = item.email;
      tdName.appendChild(nameDiv);
      tdName.appendChild(emailDiv);

      // Requirement Area
      const tdArea = document.createElement('td');
      const areaTag = document.createElement('span');
      areaTag.className = 'tag-badge';
      areaTag.textContent = item.requirement_area;
      tdArea.appendChild(areaTag);

      // Message Preview
      const tdMsg = document.createElement('td');
      tdMsg.style.maxWidth = '260px';
      tdMsg.style.whiteSpace = 'nowrap';
      tdMsg.style.overflow = 'hidden';
      tdMsg.style.textOverflow = 'ellipsis';
      tdMsg.textContent = item.message;

      // Status
      const tdStatus = document.createElement('td');
      const statusPill = document.createElement('span');
      statusPill.className = `status-pill status-${item.status}`;
      statusPill.textContent = item.status.toUpperCase();
      tdStatus.appendChild(statusPill);

      // Date
      const tdDate = document.createElement('td');
      tdDate.style.fontFamily = 'var(--font-mono)';
      tdDate.style.fontSize = '0.8125rem';
      tdDate.style.color = 'var(--color-text-muted)';
      const dt = new Date(item.created_at);
      tdDate.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      row.appendChild(tdRef);
      row.appendChild(tdName);
      row.appendChild(tdArea);
      row.appendChild(tdMsg);
      row.appendChild(tdStatus);
      row.appendChild(tdDate);

      row.addEventListener('click', () => openContactDetail(item));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openContactDetail(item);
        }
      });

      tableBody.appendChild(row);
    });
  }

  function openContactDetail(item) {
    if (!detailModal) return;
    detailModalTitle.textContent = item.ref_code ? `Reference: ${item.ref_code}` : `Inquiry #${item.id}`;
    detailModalSubtitle.textContent = `Received on ${new Date(item.created_at).toLocaleString()}`;
    detailModalBody.innerHTML = '';

    const fields = [
      { label: 'Reference ID', value: item.ref_code || `#${item.id}` },
      { label: 'Full Name', value: item.full_name },
      { label: 'Business Email', value: item.email },
      { label: 'Requirement Area', value: item.requirement_area },
      { label: 'Message / Project Description', value: item.message }
    ];

    fields.forEach((f) => {
      const group = document.createElement('div');
      group.className = 'detail-field-group';
      const lbl = document.createElement('div');
      lbl.className = 'detail-field-label';
      lbl.textContent = f.label;
      const val = document.createElement('div');
      val.className = 'detail-field-value';
      val.textContent = f.value || '—';
      group.appendChild(lbl);
      group.appendChild(val);
      detailModalBody.appendChild(group);
    });

    // Actions
    detailModalActions.innerHTML = '';

    // Status changer
    const statusChanger = document.createElement('div');
    statusChanger.className = 'detail-status-changer';
    const statusLbl = document.createElement('label');
    statusLbl.textContent = 'Status:';
    statusLbl.style.fontSize = '0.875rem';
    statusLbl.style.fontWeight = '600';

    const select = document.createElement('select');
    select.className = 'detail-status-select';
    ['new', 'read', 'handled'].forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.toUpperCase();
      if (item.status === s) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', async () => {
      try {
        const nextStatus = select.value;
        const res = await fetch(`/api/admin/contact/${item.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ status: nextStatus })
        });
        if (res.ok) {
          showToast(`Status updated to ${nextStatus.toUpperCase()}`, 'success');
          item.status = nextStatus;
          fetchContactRequests();
        }
      } catch {
        showToast('Failed to update status', 'error');
      }
    });

    statusChanger.appendChild(statusLbl);
    statusChanger.appendChild(select);

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete-action';
    delBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span>Delete Request</span>
    `;

    delBtn.addEventListener('click', () => {
      openConfirmModal(
        'Delete Client Request',
        `Are you sure you want to delete the request "${item.ref_code || item.full_name}"? This action cannot be undone.`,
        async () => {
          try {
            const res = await fetch(`/api/admin/contact/${item.id}`, {
              method: 'DELETE',
              credentials: 'same-origin'
            });
            if (res.ok) {
              closeModal(detailModal);
              showToast('Client request deleted.', 'success');
              fetchContactRequests();
            } else {
              showToast('Failed to delete request.', 'error');
            }
          } catch {
            showToast('Error deleting request.', 'error');
          }
        }
      );
    });

    detailModalActions.appendChild(statusChanger);
    detailModalActions.appendChild(delBtn);

    openModal(detailModal);
  }

  // Filter chips for Contact
  document.querySelectorAll('#contactFilterChips .filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#contactFilterChips .filter-chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.filters.contactStatus = chip.getAttribute('data-status') || 'all';
      fetchContactRequests();
    });
  });

  const contactSearchInput = document.getElementById('contactSearchInput');
  let contactSearchTimeout = null;
  if (contactSearchInput) {
    contactSearchInput.addEventListener('input', (e) => {
      clearTimeout(contactSearchTimeout);
      contactSearchTimeout = setTimeout(() => {
        state.filters.contactSearch = e.target.value.trim();
        fetchContactRequests();
      }, 250);
    });
  }

  // =========================================================================
  // 2. APPLICATIONS TAB
  // =========================================================================
  async function fetchApplications() {
    const seq = ++appsReqSeq;
    const tableBody = document.getElementById('appsTableBody');
    if (tableBody && state.currentTab === 'applications') {
      tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading job applications...</td></tr>';
    }

    try {
      const params = new URLSearchParams();
      if (state.filters.appStatus !== 'all') params.append('status', state.filters.appStatus);
      if (state.filters.appRole !== 'all') params.append('role_id', state.filters.appRole);
      if (state.filters.appSearch) params.append('q', state.filters.appSearch);

      const res = await fetch(`/api/admin/applications?${params.toString()}`, { credentials: 'same-origin' });
      if (res.status === 401) return showLogin();

      const data = await res.json();
      if (seq !== appsReqSeq) return;

      if (data.success) {
        state.applications = data.items || [];
        if (appsBadgeCount) {
          const newCount = typeof data.counts?.new === 'number' ? data.counts.new : 0;
          appsBadgeCount.textContent = newCount;
          if (newCount > 0) {
            appsBadgeCount.classList.add('badge-new');
          } else {
            appsBadgeCount.classList.remove('badge-new');
          }
        }
        renderApplicationsTable(state.applications);
      }
    } catch {
      if (seq !== appsReqSeq) return;
      if (tableBody && state.currentTab === 'applications') {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-state"><div class="empty-title">Failed to load applications</div><p>Please check your connection and refresh.</p></td></tr>';
      }
    }
  }

  function renderApplicationsTable(items) {
    const tableBody = document.getElementById('appsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty-state">
            <div class="empty-title">No applications found</div>
            <p>Applications submitted through the Careers section will appear here.</p>
          </td>
        </tr>
      `;
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.tabIndex = 0;

      // Reference ID (Copyable)
      const tdRef = document.createElement('td');
      tdRef.appendChild(createRefCodeBadge(item.ref_code, item.id));

      // Candidate (Name & Contact)
      const tdCandidate = document.createElement('td');
      const nameDiv = document.createElement('div');
      nameDiv.style.fontWeight = '600';
      nameDiv.textContent = item.full_name;
      const metaDiv = document.createElement('div');
      metaDiv.style.fontSize = '0.8125rem';
      metaDiv.style.color = 'var(--color-text-secondary)';
      metaDiv.textContent = `${item.email} • ${item.phone}`;
      tdCandidate.appendChild(nameDiv);
      tdCandidate.appendChild(metaDiv);

      // Role Applied For
      const tdRole = document.createElement('td');
      const roleTag = document.createElement('span');
      roleTag.className = 'tag-badge';
      roleTag.textContent = item.role_title;
      tdRole.appendChild(roleTag);

      // Resume Preview / Download
      const tdResume = document.createElement('td');
      const resumeLink = document.createElement('a');
      resumeLink.href = `/api/admin/applications/${item.id}/resume`;
      resumeLink.className = 'btn-csv';
      resumeLink.style.padding = '0.25rem 0.65rem';
      resumeLink.style.fontSize = '0.75rem';
      resumeLink.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download</span>
      `;
      resumeLink.addEventListener('click', (e) => e.stopPropagation());
      tdResume.appendChild(resumeLink);

      // Status
      const tdStatus = document.createElement('td');
      const statusPill = document.createElement('span');
      statusPill.className = `status-pill status-${item.status}`;
      statusPill.textContent = item.status.toUpperCase();
      tdStatus.appendChild(statusPill);

      // Date
      const tdDate = document.createElement('td');
      tdDate.style.fontFamily = 'var(--font-mono)';
      tdDate.style.fontSize = '0.8125rem';
      tdDate.style.color = 'var(--color-text-muted)';
      const dt = new Date(item.created_at);
      tdDate.textContent = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      row.appendChild(tdRef);
      row.appendChild(tdCandidate);
      row.appendChild(tdRole);
      row.appendChild(tdResume);
      row.appendChild(tdStatus);
      row.appendChild(tdDate);

      row.addEventListener('click', () => openApplicationDetail(item));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openApplicationDetail(item);
        }
      });

      tableBody.appendChild(row);
    });
  }

  function openApplicationDetail(item) {
    if (!detailModal) return;
    detailModalTitle.textContent = item.ref_code ? `Reference: ${item.ref_code}` : `Application: ${item.full_name}`;
    detailModalSubtitle.textContent = `Applied for ${item.role_title} on ${new Date(item.created_at).toLocaleString()}`;
    detailModalBody.innerHTML = '';

    const fields = [
      { label: 'Reference ID', value: item.ref_code || `#${item.id}` },
      { label: 'Role Applied For', value: item.role_title },
      { label: 'Candidate Name', value: item.full_name },
      { label: 'Email Address', value: item.email },
      { label: 'Phone Number', value: item.phone },
      { label: 'Resume File', value: item.resume_original_name },
      { label: 'Cover Message', value: item.cover_message || 'None provided' }
    ];

    fields.forEach((f) => {
      const group = document.createElement('div');
      group.className = 'detail-field-group';
      const lbl = document.createElement('div');
      lbl.className = 'detail-field-label';
      lbl.textContent = f.label;
      const val = document.createElement('div');
      val.className = 'detail-field-value';
      val.textContent = f.value || '—';
      group.appendChild(lbl);
      group.appendChild(val);
      detailModalBody.appendChild(group);
    });

    // Actions
    detailModalActions.innerHTML = '';

    // Status changer & resume download
    const leftActions = document.createElement('div');
    leftActions.style.display = 'flex';
    leftActions.style.alignItems = 'center';
    leftActions.style.gap = '0.75rem';
    leftActions.style.flexWrap = 'wrap';

    const statusChanger = document.createElement('div');
    statusChanger.className = 'detail-status-changer';
    const statusLbl = document.createElement('label');
    statusLbl.textContent = 'Status:';
    statusLbl.style.fontSize = '0.875rem';
    statusLbl.style.fontWeight = '600';

    const select = document.createElement('select');
    select.className = 'detail-status-select';
    ['new', 'reviewed', 'shortlisted', 'rejected'].forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.toUpperCase();
      if (item.status === s) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', async () => {
      try {
        const nextStatus = select.value;
        const res = await fetch(`/api/admin/applications/${item.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ status: nextStatus })
        });
        if (res.ok) {
          showToast(`Status updated to ${nextStatus.toUpperCase()}`, 'success');
          item.status = nextStatus;
          fetchApplications();
        }
      } catch {
        showToast('Failed to update status', 'error');
      }
    });

    statusChanger.appendChild(statusLbl);
    statusChanger.appendChild(select);

    const downloadBtn = document.createElement('a');
    downloadBtn.href = `/api/admin/applications/${item.id}/resume`;
    downloadBtn.className = 'btn btn-primary';
    downloadBtn.style.fontSize = '0.8125rem';
    downloadBtn.style.padding = '0.45rem 1rem';
    downloadBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Download Resume</span>
    `;

    leftActions.appendChild(statusChanger);
    leftActions.appendChild(downloadBtn);

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete-action';
    delBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span>Delete Application</span>
    `;

    delBtn.addEventListener('click', () => {
      openConfirmModal(
        'Delete Job Application',
        `Are you sure you want to delete the application "${item.ref_code || item.full_name}"? The uploaded resume will also be deleted from storage.`,
        async () => {
          try {
            const res = await fetch(`/api/admin/applications/${item.id}`, {
              method: 'DELETE',
              credentials: 'same-origin'
            });
            if (res.ok) {
              closeModal(detailModal);
              showToast('Application deleted successfully.', 'success');
              fetchApplications();
              fetchRoles();
            } else {
              showToast('Failed to delete application.', 'error');
            }
          } catch {
            showToast('Error deleting application.', 'error');
          }
        }
      );
    });

    detailModalActions.appendChild(leftActions);
    detailModalActions.appendChild(delBtn);

    openModal(detailModal);
  }

  // Filter chips for Applications
  document.querySelectorAll('#appsFilterChips .filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#appsFilterChips .filter-chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.filters.appStatus = chip.getAttribute('data-status') || 'all';
      fetchApplications();
    });
  });

  const appsSearchInput = document.getElementById('appsSearchInput');
  let appsSearchTimeout = null;
  if (appsSearchInput) {
    appsSearchInput.addEventListener('input', (e) => {
      clearTimeout(appsSearchTimeout);
      appsSearchTimeout = setTimeout(() => {
        state.filters.appSearch = e.target.value.trim();
        fetchApplications();
      }, 250);
    });
  }

  // =========================================================================
  // 3. ROLES MANAGEMENT TAB
  // =========================================================================
  async function fetchRoles() {
    const seq = ++rolesReqSeq;
    const tableBody = document.getElementById('rolesTableBody');
    if (tableBody && state.currentTab === 'roles') {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading roles...</td></tr>';
    }

    try {
      const res = await fetch('/api/admin/roles', { credentials: 'same-origin' });
      if (res.status === 401) return showLogin();

      const data = await res.json();
      if (seq !== rolesReqSeq) return;

      if (data.success) {
        state.roles = data.items || [];
        if (rolesBadgeCount) {
          rolesBadgeCount.textContent = state.roles.length;
        }
        renderRolesTable(state.roles);
        populateRoleFilterDropdown(state.roles);
      }
    } catch {
      if (seq !== rolesReqSeq) return;
      if (tableBody && state.currentTab === 'roles') {
        tableBody.innerHTML = '<tr><td colspan="7" class="table-empty-state"><div class="empty-title">Failed to load roles</div><p>Please check your connection and refresh.</p></td></tr>';
      }
    }
  }

  function populateRoleFilterDropdown(roles) {
    const roleSelect = document.getElementById('appsRoleFilterSelect');
    if (!roleSelect) return;
    roleSelect.innerHTML = '<option value="all">All Roles</option>';
    roles.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.title} (${r.ref_code || r.id})`;
      roleSelect.appendChild(opt);
    });

    roleSelect.addEventListener('change', () => {
      state.filters.appRole = roleSelect.value;
      fetchApplications();
    });
  }

  function renderRolesTable(roles) {
    const tableBody = document.getElementById('rolesTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (roles.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty-state">
            <div class="empty-title">No roles created yet</div>
            <p>Click "Add New Role" above to create your first career listing.</p>
          </td>
        </tr>
      `;
      return;
    }

    roles.forEach((role) => {
      const row = document.createElement('tr');

      // Reference ID (Copyable)
      const tdRef = document.createElement('td');
      tdRef.appendChild(createRefCodeBadge(role.ref_code, role.id));

      // Title & Department
      const tdTitle = document.createElement('td');
      const titleDiv = document.createElement('div');
      titleDiv.style.fontWeight = '700';
      titleDiv.textContent = role.title;
      const deptDiv = document.createElement('div');
      deptDiv.style.fontSize = '0.8125rem';
      deptDiv.style.color = 'var(--color-text-secondary)';
      deptDiv.textContent = role.department;
      tdTitle.appendChild(titleDiv);
      tdTitle.appendChild(deptDiv);

      // Tag
      const tdTag = document.createElement('td');
      const tagBadge = document.createElement('span');
      tagBadge.className = 'tag-badge';
      tagBadge.textContent = role.tag;
      tdTag.appendChild(tagBadge);

      // Description Preview
      const tdDesc = document.createElement('td');
      tdDesc.style.maxWidth = '240px';
      tdDesc.style.whiteSpace = 'nowrap';
      tdDesc.style.overflow = 'hidden';
      tdDesc.style.textOverflow = 'ellipsis';
      tdDesc.textContent = role.description;

      // Status Toggle Switch
      const tdStatus = document.createElement('td');
      const switchBtn = document.createElement('button');
      switchBtn.type = 'button';
      switchBtn.className = `switch-btn ${role.status}`;
      switchBtn.innerHTML = `
        <span class="status-dot"></span>
        <span>${role.status === 'open' ? 'OPEN' : 'CLOSED'}</span>
      `;
      switchBtn.title = `Click to ${role.status === 'open' ? 'close' : 'open'} this role`;

      switchBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(`/api/admin/roles/${role.id}/toggle-status`, {
            method: 'PATCH',
            credentials: 'same-origin'
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast(`Role is now ${data.item.status.toUpperCase()}`, 'success');
            fetchRoles();
          }
        } catch {
          showToast('Failed to toggle status.', 'error');
        }
      });
      tdStatus.appendChild(switchBtn);

      // Applications Count
      const tdAppsCount = document.createElement('td');
      tdAppsCount.style.fontFamily = 'var(--font-mono)';
      tdAppsCount.style.fontWeight = '600';
      tdAppsCount.textContent = role.applications_count || 0;

      // Actions (Edit, Delete)
      const tdActions = document.createElement('td');
      const actionGroup = document.createElement('div');
      actionGroup.style.display = 'flex';
      actionGroup.style.alignItems = 'center';
      actionGroup.style.gap = '0.5rem';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-csv';
      editBtn.style.padding = '0.3rem 0.65rem';
      editBtn.style.fontSize = '0.75rem';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditRoleModal(role);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete-action';
      delBtn.style.padding = '0.3rem 0.65rem';
      delBtn.style.fontSize = '0.75rem';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openConfirmModal(
          'Delete Role',
          `Are you sure you want to delete the role "${role.ref_code || role.title}"? Any existing job applications for this role will remain preserved in the database.`,
          async () => {
            try {
              const res = await fetch(`/api/admin/roles/${role.id}`, {
                method: 'DELETE',
                credentials: 'same-origin'
              });
              if (res.ok) {
                showToast('Role deleted successfully.', 'success');
                fetchRoles();
              } else {
                showToast('Failed to delete role.', 'error');
              }
            } catch {
              showToast('Error deleting role.', 'error');
            }
          }
        );
      });

      actionGroup.appendChild(editBtn);
      actionGroup.appendChild(delBtn);
      tdActions.appendChild(actionGroup);

      row.appendChild(tdRef);
      row.appendChild(tdTitle);
      row.appendChild(tdTag);
      row.appendChild(tdDesc);
      row.appendChild(tdStatus);
      row.appendChild(tdAppsCount);
      row.appendChild(tdActions);

      tableBody.appendChild(row);
    });
  }

  // Add / Edit Role Modal
  if (addRoleBtn) {
    addRoleBtn.addEventListener('click', () => {
      openCreateRoleModal();
    });
  }

  function openCreateRoleModal() {
    if (!roleModal || !roleForm) return;
    roleModalTitle.textContent = 'Add New Role';
    roleIdInput.value = '';
    roleForm.reset();
    roleStatusInput.value = 'open';
    openModal(roleModal);
  }

  function openEditRoleModal(role) {
    if (!roleModal || !roleForm) return;
    roleModalTitle.textContent = `Edit Role: ${role.ref_code || role.title}`;
    roleIdInput.value = role.id;
    roleTitleInput.value = role.title;
    roleDeptInput.value = role.department;
    roleTagInput.value = role.tag;
    roleStatusInput.value = role.status;
    roleDescInput.value = role.description;
    openModal(roleModal);
  }

  if (roleForm) {
    roleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = roleIdInput.value;
      const title = roleTitleInput.value.trim();
      const department = roleDeptInput.value.trim();
      const tag = roleTagInput.value.trim();
      const status = roleStatusInput.value;
      const description = roleDescInput.value.trim();

      if (!title || !department || !tag || !description) {
        showToast('Please fill out all role fields.', 'error');
        return;
      }

      const isEdit = !!id;
      const url = isEdit ? `/api/admin/roles/${id}` : '/api/admin/roles';
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ title, department, tag, status, description })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          closeModal(roleModal);
          showToast(isEdit ? 'Role updated successfully.' : `New role created: ${data.item.ref_code || ''}`, 'success');
          fetchRoles();
        } else {
          showToast(data.error || 'Failed to save role.', 'error');
        }
      } catch {
        showToast('Server error saving role.', 'error');
      }
    });
  }

  // =========================================================================
  // 4. DIRECTORS MANAGEMENT TAB
  // =========================================================================
  function getInitials(name) {
    if (!name) return 'DK';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  async function fetchDirectors() {
    const seq = ++directorsReqSeq;
    if (directorsTableBody && state.currentTab === 'directors') {
      directorsTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading directors...</td></tr>';
    }

    try {
      const res = await fetch('/api/admin/directors', { credentials: 'same-origin' });
      if (res.status === 401) return showLogin();

      const data = await res.json();
      if (seq !== directorsReqSeq) return;

      if (data.success) {
        state.directors = data.items || [];
        if (directorsBadgeCount) {
          directorsBadgeCount.textContent = state.directors.length;
        }
        applyDirectorsFilter();
      }
    } catch {
      if (seq !== directorsReqSeq) return;
      if (directorsTableBody && state.currentTab === 'directors') {
        directorsTableBody.innerHTML = '<tr><td colspan="6" class="table-empty-state"><div class="empty-title">Failed to load directors</div><p>Please check your connection and refresh.</p></td></tr>';
      }
    }
  }

  function applyDirectorsFilter() {
    let filtered = [...state.directors];

    if (state.filters.directorsStatus === 'visible') {
      filtered = filtered.filter((d) => d.is_visible);
    } else if (state.filters.directorsStatus === 'hidden') {
      filtered = filtered.filter((d) => !d.is_visible);
    }

    if (state.filters.directorsSearch) {
      const q = state.filters.directorsSearch.toLowerCase();
      filtered = filtered.filter((d) =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.role && d.role.toLowerCase().includes(q)) ||
        (d.ref_code && d.ref_code.toLowerCase().includes(q))
      );
    }

    renderDirectorsTable(filtered);
  }

  function renderDirectorsTable(items) {
    if (!directorsTableBody) return;
    directorsTableBody.innerHTML = '';

    if (items.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyTd = document.createElement('td');
      emptyTd.colSpan = 6;
      emptyTd.className = 'table-empty-state';

      const emptyTitle = document.createElement('div');
      emptyTitle.className = 'empty-title';
      emptyTitle.textContent = 'No directors found';

      const emptySub = document.createElement('p');
      emptySub.textContent = 'Add a director profile to showcase executive leadership on the public website.';

      emptyTd.appendChild(emptyTitle);
      emptyTd.appendChild(emptySub);
      emptyRow.appendChild(emptyTd);
      directorsTableBody.appendChild(emptyRow);
      return;
    }

    items.forEach((director, index) => {
      const row = document.createElement('tr');

      // 1. Order Column (Up / Down buttons)
      const tdOrder = document.createElement('td');
      tdOrder.style.textAlign = 'center';

      const reorderGroup = document.createElement('div');
      reorderGroup.className = 'reorder-btn-group';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'btn-reorder';
      upBtn.title = 'Move up';
      upBtn.disabled = index === 0;
      upBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      `;
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveDirectorOrder(director.id, -1);
      });

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'btn-reorder';
      downBtn.title = 'Move down';
      downBtn.disabled = index === items.length - 1;
      downBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveDirectorOrder(director.id, 1);
      });

      reorderGroup.appendChild(upBtn);
      reorderGroup.appendChild(downBtn);
      tdOrder.appendChild(reorderGroup);

      // 2. Photo Column (Thumbnail or Initials Avatar)
      const tdPhoto = document.createElement('td');
      const thumbBox = document.createElement('div');
      thumbBox.className = 'director-thumb-container';

      if (director.photo_url) {
        const img = document.createElement('img');
        img.src = director.photo_url;
        img.alt = director.name;
        img.className = 'director-thumb-img';
        img.loading = 'lazy';
        thumbBox.appendChild(img);
      } else {
        const initials = document.createElement('div');
        initials.className = 'director-thumb-initials';
        initials.textContent = getInitials(director.name);
        thumbBox.appendChild(initials);
      }
      tdPhoto.appendChild(thumbBox);

      // 3. Name & Role Column (Using textContent for security)
      const tdName = document.createElement('td');
      const nameDiv = document.createElement('div');
      nameDiv.style.fontWeight = '600';
      nameDiv.style.color = 'var(--color-text-primary)';
      nameDiv.textContent = director.name;

      const roleDiv = document.createElement('div');
      roleDiv.style.fontSize = '0.8125rem';
      roleDiv.style.color = 'var(--color-text-secondary)';
      roleDiv.textContent = director.role;

      tdName.appendChild(nameDiv);
      tdName.appendChild(roleDiv);

      // 4. Reference ID Column
      const tdRef = document.createElement('td');
      tdRef.appendChild(createRefCodeBadge(director.ref_code, director.id));

      // 5. Visibility Column (Toggle button)
      const tdVis = document.createElement('td');
      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = `btn-visibility-toggle ${director.is_visible ? 'visible' : 'hidden'}`;
      visBtn.title = `Click to ${director.is_visible ? 'hide from' : 'show on'} website`;

      const dot = document.createElement('span');
      dot.className = 'status-dot';
      const label = document.createElement('span');
      label.textContent = director.is_visible ? 'Visible' : 'Hidden';

      visBtn.appendChild(dot);
      visBtn.appendChild(label);

      visBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(`/api/admin/directors/${director.id}/toggle-visibility`, {
            method: 'PATCH',
            credentials: 'same-origin'
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast(`${director.name} is now ${data.item.is_visible ? 'Visible' : 'Hidden'} on website.`, 'success');
            fetchDirectors();
          } else {
            showToast(data.error || 'Failed to toggle visibility.', 'error');
          }
        } catch {
          showToast('Failed to toggle visibility.', 'error');
        }
      });
      tdVis.appendChild(visBtn);

      // 6. Actions Column (Edit, Delete)
      const tdActions = document.createElement('td');
      tdActions.style.textAlign = 'right';
      const actionGroup = document.createElement('div');
      actionGroup.style.display = 'inline-flex';
      actionGroup.style.alignItems = 'center';
      actionGroup.style.gap = '0.5rem';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-csv';
      editBtn.style.padding = '0.3rem 0.65rem';
      editBtn.style.fontSize = '0.75rem';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditDirectorModal(director);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete-action';
      delBtn.style.padding = '0.3rem 0.65rem';
      delBtn.style.fontSize = '0.75rem';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openConfirmModal(
          'Delete Director',
          `Delete this director? This can't be undone.`,
          async () => {
            try {
              const res = await fetch(`/api/admin/directors/${director.id}`, {
                method: 'DELETE',
                credentials: 'same-origin'
              });
              const data = await res.json();
              if (res.ok && data.success) {
                showToast('Director deleted successfully.', 'success');
                fetchDirectors();
              } else {
                showToast(data.error || 'Failed to delete director.', 'error');
              }
            } catch {
              showToast('Error deleting director.', 'error');
            }
          }
        );
      });

      actionGroup.appendChild(editBtn);
      actionGroup.appendChild(delBtn);
      tdActions.appendChild(actionGroup);

      row.appendChild(tdOrder);
      row.appendChild(tdPhoto);
      row.appendChild(tdName);
      row.appendChild(tdRef);
      row.appendChild(tdVis);
      row.appendChild(tdActions);

      directorsTableBody.appendChild(row);
    });
  }

  // Move Director Order in table and persist to API
  async function moveDirectorOrder(directorId, delta) {
    const list = [...state.directors];
    const currentIndex = list.findIndex((d) => d.id === directorId);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap elements
    const temp = list[currentIndex];
    list[currentIndex] = list[targetIndex];
    list[targetIndex] = temp;

    const orderIds = list.map((d) => d.id);

    try {
      const res = await fetch('/api/admin/directors/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ order: orderIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Directors reordered.', 'success');
        fetchDirectors();
      } else {
        showToast(data.error || 'Failed to reorder.', 'error');
      }
    } catch {
      showToast('Error updating order.', 'error');
    }
  }

  // Directors Filter Chips & Search Listener
  if (directorsFilterChips) {
    directorsFilterChips.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        directorsFilterChips.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        state.filters.directorsStatus = chip.getAttribute('data-status') || 'all';
        applyDirectorsFilter();
      });
    });
  }

  if (directorsSearchInput) {
    directorsSearchInput.addEventListener('input', (e) => {
      state.filters.directorsSearch = e.target.value.trim();
      applyDirectorsFilter();
    });
  }

  // Add Director Button
  if (addDirectorBtn) {
    addDirectorBtn.addEventListener('click', () => {
      openCreateDirectorModal();
    });
  }

  function openCreateDirectorModal() {
    if (!directorModal || !directorForm) return;
    directorModalTitle.textContent = 'Add New Director';
    directorIdInput.value = '';
    removePhotoFlag.value = 'false';
    directorForm.reset();
    directorVisibleInput.checked = true;
    directorRoleInput.value = 'Director';

    // Reset preview
    directorPreviewImg.hidden = true;
    directorPreviewImg.src = '';
    directorPreviewInitials.hidden = false;
    directorPreviewInitials.textContent = 'DK';
    removePhotoBtn.hidden = true;
    choosePhotoBtnText.textContent = 'Upload Photo';

    if (directorModalError) directorModalError.hidden = true;
    openModal(directorModal);
  }

  function openEditDirectorModal(director) {
    if (!directorModal || !directorForm) return;
    directorModalTitle.textContent = `Edit Director: ${director.name}`;
    directorIdInput.value = director.id;
    removePhotoFlag.value = 'false';
    directorNameInput.value = director.name;
    directorRoleInput.value = director.role;
    directorVisibleInput.checked = director.is_visible;
    directorPhotoInput.value = '';

    // Photo preview setup
    if (director.photo_url) {
      directorPreviewImg.src = director.photo_url;
      directorPreviewImg.hidden = false;
      directorPreviewInitials.hidden = true;
      removePhotoBtn.hidden = false;
      choosePhotoBtnText.textContent = 'Replace Photo';
    } else {
      directorPreviewImg.hidden = true;
      directorPreviewImg.src = '';
      directorPreviewInitials.hidden = false;
      directorPreviewInitials.textContent = getInitials(director.name);
      removePhotoBtn.hidden = true;
      choosePhotoBtnText.textContent = 'Upload Photo';
    }

    if (directorModalError) directorModalError.hidden = true;
    openModal(directorModal);
  }

  // Photo picker button triggers hidden file input
  if (choosePhotoBtn && directorPhotoInput) {
    choosePhotoBtn.addEventListener('click', () => {
      directorPhotoInput.click();
    });
  }

  // Instant photo preview & validation on file selection
  if (directorPhotoInput) {
    directorPhotoInput.addEventListener('change', () => {
      if (directorModalError) directorModalError.hidden = true;
      const file = directorPhotoInput.files && directorPhotoInput.files[0];
      if (!file) return;

      // File size validation (3MB)
      if (file.size > 3 * 1024 * 1024) {
        if (directorModalError) {
          directorModalError.textContent = 'Photo exceeds 3MB limit. Please choose a smaller image.';
          directorModalError.hidden = false;
        }
        directorPhotoInput.value = '';
        return;
      }

      // Extension / MIME validation
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();

      if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
        if (directorModalError) {
          directorModalError.textContent = 'Invalid file type. Only JPG, PNG, and WebP images are accepted.';
          directorModalError.hidden = false;
        }
        directorPhotoInput.value = '';
        return;
      }

      // Display preview
      const objectUrl = URL.createObjectURL(file);
      directorPreviewImg.src = objectUrl;
      directorPreviewImg.hidden = false;
      directorPreviewInitials.hidden = true;
      removePhotoBtn.hidden = false;
      removePhotoFlag.value = 'false';
      choosePhotoBtnText.textContent = 'Replace Photo';
    });
  }

  // Remove photo button in modal
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      if (directorPhotoInput) directorPhotoInput.value = '';
      removePhotoFlag.value = 'true';
      directorPreviewImg.hidden = true;
      directorPreviewImg.src = '';
      directorPreviewInitials.hidden = false;
      directorPreviewInitials.textContent = getInitials(directorNameInput.value);
      removePhotoBtn.hidden = true;
      choosePhotoBtnText.textContent = 'Upload Photo';
    });
  }

  // Update initials preview dynamically when name changes if no photo
  if (directorNameInput) {
    directorNameInput.addEventListener('input', () => {
      if (directorPreviewImg.hidden) {
        directorPreviewInitials.textContent = getInitials(directorNameInput.value);
      }
    });
  }

  // Close director modal buttons
  if (closeDirectorModalBtn) closeDirectorModalBtn.addEventListener('click', () => closeModal(directorModal));
  if (cancelDirectorBtn) cancelDirectorBtn.addEventListener('click', () => closeModal(directorModal));

  // Director Form Submit Handler
  if (directorForm) {
    directorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (directorModalError) directorModalError.hidden = true;

      const id = directorIdInput.value;
      const name = directorNameInput.value.trim();
      const role = directorRoleInput.value.trim();
      const isVisible = directorVisibleInput.checked;
      const removePhoto = removePhotoFlag.value === 'true';

      if (!name || name.length < 2) {
        if (directorModalError) {
          directorModalError.textContent = 'Please provide director full name (min 2 characters).';
          directorModalError.hidden = false;
        }
        return;
      }

      if (!role || role.length < 2) {
        if (directorModalError) {
          directorModalError.textContent = 'Please provide director role (min 2 characters).';
          directorModalError.hidden = false;
        }
        return;
      }

      const isEdit = !!id;
      const url = isEdit ? `/api/admin/directors/${id}` : '/api/admin/directors';
      const method = isEdit ? 'PUT' : 'POST';

      const formData = new FormData();
      formData.append('name', name);
      formData.append('role', role);
      formData.append('is_visible', isVisible ? 'true' : 'false');
      if (isEdit) {
        formData.append('remove_photo', removePhoto ? 'true' : 'false');
      }

      if (directorPhotoInput.files && directorPhotoInput.files[0]) {
        formData.append('photo', directorPhotoInput.files[0]);
      }

      if (saveDirectorBtn) {
        saveDirectorBtn.disabled = true;
        saveDirectorBtn.textContent = 'Saving...';
      }

      try {
        const res = await fetch(url, {
          method,
          credentials: 'same-origin',
          body: formData
        });

        const data = await res.json();
        if (res.ok && data.success) {
          closeModal(directorModal);
          showToast(isEdit ? 'Director updated successfully.' : `New director added: ${data.item.name}`, 'success');
          fetchDirectors();
        } else {
          if (directorModalError) {
            directorModalError.textContent = data.error || 'Failed to save director.';
            directorModalError.hidden = false;
          }
        }
      } catch {
        if (directorModalError) {
          directorModalError.textContent = 'Network error saving director. Please try again.';
          directorModalError.hidden = false;
        }
      } finally {
        if (saveDirectorBtn) {
          saveDirectorBtn.disabled = false;
          saveDirectorBtn.textContent = 'Save Director';
        }
      }
    });
  }

  // =========================================================================
  // MODAL UTILITIES
  // =========================================================================
  function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    const activeModals = document.querySelectorAll('.admin-modal-backdrop:not([hidden])');
    if (activeModals.length === 0) {
      document.body.style.overflow = '';
    }
  }

  // Close buttons
  if (closeDetailModalBtn) closeDetailModalBtn.addEventListener('click', () => closeModal(detailModal));
  if (closeRoleModalBtn) closeRoleModalBtn.addEventListener('click', () => closeModal(roleModal));
  if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', () => closeModal(confirmModal));

  // Backdrop click
  document.querySelectorAll('.admin-modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-backdrop:not([hidden])').forEach(closeModal);
    }
  });

  // Confirmation Modal helper
  let currentConfirmCallback = null;
  function openConfirmModal(title, text, onConfirm) {
    if (!confirmModal) return;
    confirmModalTitle.textContent = title;
    confirmModalText.textContent = text;
    currentConfirmCallback = onConfirm;
    openModal(confirmModal);
  }

  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', async () => {
      if (typeof currentConfirmCallback === 'function') {
        const cb = currentConfirmCallback;
        currentConfirmCallback = null;
        closeModal(confirmModal);
        await cb();
      }
    });
  }

  // Initialize
  checkAuth();

})();



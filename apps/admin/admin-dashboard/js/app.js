/**
 * EcoWoods Admin Dashboard - Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM References =====
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const navItems = document.querySelectorAll('.nav-item');
    const pageTitle = document.getElementById('page-title');
    const usernameDisplay = document.getElementById('username-display');

    // ===== Toast System =====
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
        toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ===== Auth State =====
    async function checkAuth() {
        if (!API.getToken()) {
            showLogin();
            return;
        }
        try {
            const user = await API.getMe();
            if (!user.is_admin) {
                API.logout();
                showLogin();
                showToast('Admin access required', 'error');
                return;
            }
            usernameDisplay.textContent = user.full_name || user.username;
            showDashboard();
            loadOverview();
        } catch (e) {
            API.logout();
            showLogin();
        }
    }

    function showLogin() {
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }

    function showDashboard() {
        loginScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');
    }

    // ===== Login =====
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        try {
            const data = await API.login(username, password);
            if (!data.user.is_admin) {
                API.logout();
                loginError.textContent = 'Admin access required';
                loginError.classList.remove('hidden');
                return;
            }
            usernameDisplay.textContent = data.user.full_name || data.user.username;
            showDashboard();
            loadOverview();
            showToast('Welcome back!');
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => {
        API.logout();
        showLogin();
    });

    // ===== Sidebar Navigation =====
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
            document.getElementById(`section-${section}`).classList.remove('hidden');
            pageTitle.textContent = item.querySelector('span').textContent;
            sidebar.classList.remove('open');
            loadSection(section);
        });
    });

    function loadSection(section) {
        switch (section) {
            case 'overview': loadOverview(); break;
            case 'job-requests': loadJobRequests(); break;
            case 'bids': loadBids(); break;
            case 'calendar': loadCalendar(); break;
            case 'users': loadUsers(); break;
        }
    }

    // ===== Utility: Build Table =====
    function buildTable(headers, rows) {
        if (!rows || rows.length === 0) {
            return '<p style="color:#999;padding:20px;text-align:center;">No data available</p>';
        }
        let html = '<table><thead><tr>';
        headers.forEach(h => html += `<th>${h.label}</th>`);
        html += '</tr></thead><tbody>';
        rows.forEach(row => {
            html += '<tr>';
            headers.forEach(h => html += `<td>${h.render ? h.render(row) : (row[h.key] ?? '-')}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function statusBadge(status) {
        return `<span class="badge badge-${status || 'pending'}">${(status || 'pending').replace('_', ' ')}</span>`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-CA');
    }

    // ===== Overview =====
    async function loadOverview() {
        try {
            const [jobs, bids, events, users] = await Promise.all([
                API.listJobRequests(),
                API.listBids(),
                API.listEvents(),
                API.listUsers(),
            ]);
            document.getElementById('stat-jobs').textContent = jobs.length;
            document.getElementById('stat-bids').textContent = bids.length;
            document.getElementById('stat-events').textContent = events.length;
            document.getElementById('stat-users').textContent = users.length;

            const recentJobs = jobs.slice(0, 5);
            document.getElementById('recent-jobs-table').innerHTML = buildTable([
                { label: 'ID', key: 'id' },
                { label: 'User', key: 'user_id' },
                { label: 'Status', render: r => statusBadge(r.status) },
                { label: 'Services', render: r => (r.services || []).join(', ') || '-' },
                { label: 'Created', render: r => formatDate(r.created_at) },
            ], recentJobs);
        } catch (err) {
            showToast('Failed to load overview: ' + err.message, 'error');
        }
    }

    // ===== Job Requests =====
    const jobStatusFilter = document.getElementById('job-status-filter');
    jobStatusFilter.addEventListener('change', () => loadJobRequests());

    async function loadJobRequests() {
        try {
            const filter = jobStatusFilter.value;
            const jobs = await API.listJobRequests(filter);
            document.getElementById('jobs-table').innerHTML = buildTable([
                { label: 'ID', key: 'id' },
                { label: 'User ID', key: 'user_id' },
                { label: 'Status', render: r => statusBadge(r.status) },
                { label: 'Services', render: r => (r.services || []).slice(0, 2).join(', ') + ((r.services || []).length > 2 ? '...' : '') || '-' },
                { label: 'Wood Type', key: 'wood_type' },
                { label: 'Size', key: 'size' },
                { label: 'Timeframe', key: 'timeframe' },
                { label: 'Created', render: r => formatDate(r.created_at) },
                { label: 'Actions', render: r => `
                    <div class="action-btns">
                        <select class="form-select" style="width:auto;padding:4px 8px;font-size:12px;"
                            onchange="window.updateJobStatus(${r.id}, this.value)">
                            <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="estimated" ${r.status === 'estimated' ? 'selected' : ''}>Estimated</option>
                            <option value="in_progress" ${r.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${r.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteJob(${r.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` },
            ], jobs);
        } catch (err) {
            showToast('Failed to load job requests: ' + err.message, 'error');
        }
    }

    window.updateJobStatus = async (id, status) => {
        try {
            await API.updateJobRequest(id, { status });
            showToast('Job status updated');
            loadJobRequests();
            loadOverview();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    window.deleteJob = async (id) => {
        if (!confirm('Delete this job request?')) return;
        try {
            await API.deleteJobRequest(id);
            showToast('Job request deleted');
            loadJobRequests();
            loadOverview();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    // ===== Bids =====
    const bidModal = document.getElementById('bid-modal');
    const bidForm = document.getElementById('bid-form');
    document.getElementById('new-bid-btn').addEventListener('click', () => bidModal.classList.remove('hidden'));
    document.getElementById('bid-modal-close').addEventListener('click', () => bidModal.classList.add('hidden'));
    document.getElementById('bid-cancel').addEventListener('click', () => bidModal.classList.add('hidden'));

    bidForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await API.createBid({
                job_request_id: parseInt(document.getElementById('bid-job-id').value),
                amount: parseFloat(document.getElementById('bid-amount').value),
                timeframe: document.getElementById('bid-timeframe').value || null,
                pickup_date: document.getElementById('bid-pickup-date').value || null,
                notes: document.getElementById('bid-notes').value || null,
            });
            bidModal.classList.add('hidden');
            bidForm.reset();
            showToast('Bid created successfully');
            loadBids();
            loadOverview();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    });

    async function loadBids() {
        try {
            const bids = await API.listBids();
            document.getElementById('bids-table').innerHTML = buildTable([
                { label: 'ID', key: 'id' },
                { label: 'Job #', key: 'job_request_id' },
                { label: 'Bidder', key: 'bidder_id' },
                { label: 'Amount', render: r => `$${parseFloat(r.amount).toLocaleString()} ${r.currency}` },
                { label: 'Timeframe', key: 'timeframe' },
                { label: 'Pickup', key: 'pickup_date' },
                { label: 'Status', render: r => statusBadge(r.status) },
                { label: 'Created', render: r => formatDate(r.created_at) },
                { label: 'Actions', render: r => `
                    <div class="action-btns">
                        <select class="form-select" style="width:auto;padding:4px 8px;font-size:12px;"
                            onchange="window.updateBidStatus(${r.id}, this.value)">
                            <option value="submitted" ${r.status === 'submitted' ? 'selected' : ''}>Submitted</option>
                            <option value="accepted" ${r.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="rejected" ${r.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteBidItem(${r.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` },
            ], bids);
        } catch (err) {
            showToast('Failed to load bids: ' + err.message, 'error');
        }
    }

    window.updateBidStatus = async (id, status) => {
        try {
            await API.updateBid(id, { status });
            showToast('Bid status updated');
            loadBids();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    window.deleteBidItem = async (id) => {
        if (!confirm('Delete this bid?')) return;
        try {
            await API.deleteBid(id);
            showToast('Bid deleted');
            loadBids();
            loadOverview();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    // ===== Calendar =====
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let calendarEvents = [];

    const eventModal = document.getElementById('event-modal');
    const eventForm = document.getElementById('event-form');
    document.getElementById('new-event-btn').addEventListener('click', () => eventModal.classList.remove('hidden'));
    document.getElementById('event-modal-close').addEventListener('click', () => eventModal.classList.add('hidden'));
    document.getElementById('event-cancel').addEventListener('click', () => eventModal.classList.add('hidden'));

    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await API.createEvent({
                title: document.getElementById('event-title').value,
                description: document.getElementById('event-description').value || null,
                start_date: document.getElementById('event-start').value,
                end_date: document.getElementById('event-end').value || null,
                event_type: document.getElementById('event-type').value,
                job_request_id: document.getElementById('event-job-id').value ? parseInt(document.getElementById('event-job-id').value) : null,
            });
            eventModal.classList.add('hidden');
            eventForm.reset();
            showToast('Event created');
            loadCalendar();
            loadOverview();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    });

    async function loadCalendar() {
        try {
            calendarEvents = await API.listEvents();
            renderCalendarGrid();
            renderEventsTable();
        } catch (err) {
            showToast('Failed to load calendar: ' + err.message, 'error');
        }
    }

    function renderCalendarGrid() {
        const grid = document.getElementById('calendar-grid');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = '';

        // Navigation
        html += `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--primary);color:white;">
            <button onclick="window.calNav(-1)" style="background:none;color:white;font-size:18px;border:none;cursor:pointer;"><i class="fas fa-chevron-left"></i></button>
            <strong>${new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button onclick="window.calNav(1)" style="background:none;color:white;font-size:18px;border:none;cursor:pointer;"><i class="fas fa-chevron-right"></i></button>
        </div>`;

        days.forEach(d => html += `<div class="calendar-header-cell">${d}</div>`);

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date();

        // Previous month padding
        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            html += `<div class="calendar-cell other-month"><div class="calendar-day">${prevMonthDays - i}</div></div>`;
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === d;
            const dayEvents = calendarEvents.filter(ev => ev.start_date === dateStr);

            html += `<div class="calendar-cell ${isToday ? 'today' : ''}">`;
            html += `<div class="calendar-day">${d}</div>`;
            dayEvents.forEach(ev => {
                html += `<div class="calendar-event type-${ev.event_type}" title="${ev.title}">${ev.title}</div>`;
            });
            html += '</div>';
        }

        // Next month padding
        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-cell other-month"><div class="calendar-day">${i}</div></div>`;
        }

        grid.innerHTML = html;
    }

    window.calNav = (dir) => {
        currentMonth += dir;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendarGrid();
    };

    function renderEventsTable() {
        const sorted = [...calendarEvents].sort((a, b) => a.start_date.localeCompare(b.start_date));
        document.getElementById('events-table').innerHTML = buildTable([
            { label: 'ID', key: 'id' },
            { label: 'Title', key: 'title' },
            { label: 'Type', render: r => `<span class="badge badge-${r.event_type === 'job' ? 'in_progress' : 'estimated'}">${r.event_type}</span>` },
            { label: 'Start', key: 'start_date' },
            { label: 'End', key: 'end_date' },
            { label: 'Job #', key: 'job_request_id' },
            { label: 'Actions', render: r => `
                <button class="btn btn-danger btn-sm" onclick="window.deleteEventItem(${r.id})">
                    <i class="fas fa-trash"></i>
                </button>
            ` },
        ], sorted);
    }

    window.deleteEventItem = async (id) => {
        if (!confirm('Delete this event?')) return;
        try {
            await API.deleteEvent(id);
            showToast('Event deleted');
            loadCalendar();
            loadOverview();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    // ===== Users =====
    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    document.getElementById('user-modal-close').addEventListener('click', () => userModal.classList.add('hidden'));
    document.getElementById('user-cancel').addEventListener('click', () => userModal.classList.add('hidden'));

    async function loadUsers() {
        try {
            const users = await API.listUsers();
            document.getElementById('users-table').innerHTML = buildTable([
                { label: 'ID', key: 'id' },
                { label: 'Username', key: 'username' },
                { label: 'Full Name', key: 'full_name' },
                { label: 'Email', key: 'email' },
                { label: 'Phone', key: 'phone' },
                { label: 'Active', render: r => r.is_active ? '<i class="fas fa-check" style="color:green"></i>' : '<i class="fas fa-times" style="color:red"></i>' },
                { label: 'Admin', render: r => r.is_admin ? '<i class="fas fa-shield-alt" style="color:var(--blue)"></i>' : '-' },
                { label: 'Joined', render: r => formatDate(r.created_at) },
                { label: 'Actions', render: r => `
                    <div class="action-btns">
                        <button class="btn btn-primary btn-sm" onclick="window.editUser(${r.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteUserItem(${r.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` },
            ], users);
        } catch (err) {
            showToast('Failed to load users: ' + err.message, 'error');
        }
    }

    window.editUser = async (id) => {
        try {
            const user = await API.getUser(id);
            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('edit-full-name').value = user.full_name || '';
            document.getElementById('edit-email').value = user.email || '';
            document.getElementById('edit-phone').value = user.phone || '';
            document.getElementById('edit-address').value = user.address || '';
            document.getElementById('edit-is-active').checked = user.is_active;
            document.getElementById('edit-is-admin').checked = user.is_admin;
            userModal.classList.remove('hidden');
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        try {
            await API.updateUser(id, {
                full_name: document.getElementById('edit-full-name').value || null,
                email: document.getElementById('edit-email').value || null,
                phone: document.getElementById('edit-phone').value || null,
                address: document.getElementById('edit-address').value || null,
                is_active: document.getElementById('edit-is-active').checked,
                is_admin: document.getElementById('edit-is-admin').checked,
            });
            userModal.classList.add('hidden');
            showToast('User updated');
            loadUsers();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    });

    window.deleteUserItem = async (id) => {
        if (!confirm('Delete this user? This will also delete their job requests and bids.')) return;
        try {
            await API.deleteUser(id);
            showToast('User deleted');
            loadUsers();
            loadOverview();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    };

    // ===== Init =====
    checkAuth();
});

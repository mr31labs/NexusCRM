import db from './db.js';

/**
 * UI Manipulation Service
 * Handles rendering data to the DOM and managing Modals/Toasts.
 */
class UI {
    // --- Modals ---
    openModal(modalId) {
        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById(modalId).classList.add('active');
    }

    closeModals() {
        document.getElementById('modal-overlay').classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }

    // --- Toasts ---
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';

        toast.innerHTML = `<i class="ph ${icon}" style="font-size:1.25rem;"></i><span>${message}</span>`;
        container.appendChild(toast);

        // Trigger reflow to animate
        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Contacts Rendering ---
    renderContacts(contacts) {
        const container = document.querySelector('.contacts-list');
        if (contacts.length === 0) {
            container.innerHTML = '<div class="panel" style="text-align:center; padding: 3rem;"><i class="ph ph-users" style="font-size:3rem; color:var(--text-muted);"></i><p class="mt-4">No contacts found.</p></div>';
            return;
        }

        let html = `
            <table class="contacts-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Contact Info</th>
                        <th>Company</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        contacts.forEach(c => {
            const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            html += `
                <tr>
                    <td>
                        <div class="contact-name-cell">
                            <div class="avatar">${initials}</div>
                            <div>
                                <div>${c.name}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-size:0.9rem;">
                            <div><i class="ph ph-envelope-simple mr-1"></i> ${c.email || '-'}</div>
                            <div style="color:var(--text-secondary)"><i class="ph ph-phone mr-1"></i> ${c.phone || '-'}</div>
                            <div style="color:var(--text-secondary)"><i class="ph ph-device-mobile mr-1"></i> ${c.mobile || '-'}</div>
                            <div style="color:var(--text-secondary); font-size: 0.8rem; margin-top: 4px;">Pref: <span style="text-transform: capitalize;">${c.preferredContact || 'email'}</span></div>
                        </div>
                    </td>
                    <td>${c.company || '-'}</td>
                    <td class="td-actions">
                        <button class="btn-icon" onclick="app.handlers.draftEmail('${c.id}')" title="AI Draft Email"><i class="ph-fill ph-magic-wand text-gradient"></i></button>
                        <button class="btn-icon" onclick="app.handlers.openContactModal('${c.id}')" title="Edit Contact"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-icon" onclick="app.handlers.deleteContact('${c.id}')" title="Delete"><i class="ph ph-trash text-danger"></i></button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
        this.populateContactSelects(); // Update deal form
    }

    populateContactSelects() {
        const select = document.getElementById('deal-contact');
        if (!select) return;
        const contacts = db.getContacts();
        select.innerHTML = '<option value="">Select a contact...</option>' +
            contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // --- Pipeline / Kanban Rendering ---
    renderPipeline() {
        const container = document.querySelector('.kanban-board');
        const stages = [
            { id: 'lead', title: 'Lead' },
            { id: 'contacted', title: 'Contacted' },
            { id: 'negotiating', title: 'Negotiating' },
            { id: 'won', title: 'Won' },
            { id: 'lost', title: 'Lost' }
        ];

        let html = '';
        stages.forEach(stage => {
            const dealsInStage = db.getDealsByStage(stage.id);
            const totalValue = dealsInStage.reduce((sum, d) => sum + Number(d.value), 0);

            html += `
                <div class="kanban-col" data-stage="${stage.id}" ondragover="app.handlers.allowDrop(event)" ondrop="app.handlers.dropDeal(event, '${stage.id}')">
                    <div class="kanban-col-header">
                        <div class="col-title"><span class="dot dot-${stage.id}"></span>${stage.title}</div>
                        <div class="col-count">${dealsInStage.length} &middot; $${totalValue.toLocaleString()}</div>
                    </div>
                    <div class="kanban-cards">
                        ${dealsInStage.map(d => this.generateDealCardTemplate(d)).join('')}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        this.renderChart(); // Draw forecast graph
    }

    generateDealCardTemplate(deal) {
        const contact = db.getContact(deal.contactId);
        const contactName = contact ? contact.name : 'Unknown Contact';
        return `
            <div class="deal-card" id="${deal.id}" draggable="true" ondragstart="app.handlers.dragDeal(event)">
                <div class="deal-title">${deal.title}</div>
                <div class="deal-contact"><i class="ph ph-user"></i> ${contactName}</div>
                <div class="deal-footer">
                    <div class="deal-value">$${Number(deal.value).toLocaleString()}</div>
                    <div class="deal-actions">
                         <button class="btn-icon" onclick="app.handlers.dealInsights('${deal.id}')" title="AI Insights"><i class="ph-fill ph-magic-wand text-gradient"></i></button>
                         <button class="btn-icon" onclick="app.handlers.openDealModal('${deal.id}')" title="Edit Deal"><i class="ph ph-pencil-simple"></i></button>
                         <button class="btn-icon" onclick="app.handlers.deleteDeal('${deal.id}')" title="Delete"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Chart Rendering (Chart.js) ---
    renderChart() {
        if (!window.Chart) return;

        const ctx = document.getElementById('forecast-chart');
        if (!ctx) return;

        // Ensure responsive bounds
        ctx.style.width = '100%';
        ctx.style.height = '100%';

        // Aggregate deal values by stage
        const stages = ['lead', 'contacted', 'negotiating', 'won', 'lost'];
        const values = stages.map(stage => {
            return db.getDealsByStage(stage).reduce((sum, d) => sum + Number(d.value), 0);
        });

        // Destroy existing chart instance to prevent overlaps on re-render
        if (this.currentChart) {
            this.currentChart.destroy();
        }

        // Setup minimalist styling
        Chart.defaults.color = '#6b7280'; // gray-500
        Chart.defaults.font.family = "'Inter', sans-serif";

        this.currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Lead', 'Contacted', 'Negotiating', 'Won', 'Lost'],
                datasets: [{
                    label: 'Pipeline Value',
                    data: values,
                    backgroundColor: [
                        'rgba(14, 165, 233, 0.7)',  // sky-500
                        'rgba(37, 99, 235, 0.7)',   // blue-600
                        'rgba(245, 158, 11, 0.7)',  // amber-500
                        'rgba(16, 185, 129, 0.7)',  // emerald-500
                        'rgba(239, 68, 68, 0.7)'    // red-500
                    ],
                    borderColor: [
                        '#0ea5e9',
                        '#2563eb',
                        '#f59e0b',
                        '#10b981',
                        '#ef4444'
                    ],
                    borderWidth: 1,
                    borderRadius: 4, // Professional rounded bar corners
                    hoverBackgroundColor: [
                        'rgba(14, 165, 233, 0.9)',
                        'rgba(37, 99, 235, 0.9)',
                        'rgba(245, 158, 11, 0.9)',
                        'rgba(16, 185, 129, 0.9)'
                    ],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937', // gray-800
                        titleColor: '#f9fafb',
                        bodyColor: '#f3f4f6',
                        borderColor: '#374151',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 6,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: {
                            color: '#e5e7eb', // gray-200
                        },
                        ticks: {
                            callback: function (value, index, values) {
                                if (value >= 1000) return '$' + value / 1000 + 'k';
                                return '$' + value;
                            }
                        }
                    }
                },
                animation: {
                    duration: 500,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
}

const ui = new UI();
export default ui;

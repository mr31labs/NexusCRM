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
                        </div>
                    </td>
                    <td>${c.company || '-'}</td>
                    <td class="td-actions">
                        <button class="btn-icon" onclick="app.handlers.draftEmail('${c.id}')" title="AI Draft Email"><i class="ph-fill ph-magic-wand text-gradient"></i></button>
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
                         <button class="btn-icon" onclick="app.handlers.deleteDeal('${deal.id}')" title="Delete"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }
}

const ui = new UI();
export default ui;

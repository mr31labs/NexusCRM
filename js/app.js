import db from './db.js';
import ui from './ui.js';
import ai from './ai.js';

class App {
    constructor() {
        this.init();
    }

    init() {
        this.bindNavigation();
        this.bindForms();
        this.bindDataActions();
        this.bindGlobalActions();

        // Expose handlers globally for inline HTML event handlers (ondrag, onclick)
        window.app = {
            handlers: {
                openContactModal: this.openContactModal.bind(this),
                openDealModal: this.openDealModal.bind(this),
                deleteContact: this.deleteContact.bind(this),
                deleteDeal: this.deleteDeal.bind(this),
                dragDeal: this.dragDeal.bind(this),
                allowDrop: this.allowDrop.bind(this),
                dropDeal: this.dropDeal.bind(this),
                draftEmail: this.draftEmail.bind(this),
                dealInsights: this.dealInsights.bind(this)
            }
        };

        this.loadSettings();
        this.refreshViews();

        ui.showToast('CRM Initialized', 'success');
    }

    refreshViews() {
        ui.renderContacts(db.getContacts());
        ui.renderPipeline();
    }

    // --- Navigation ---
    bindNavigation() {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Hide all views
                document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

                // Show target view
                const targetId = link.getAttribute('data-target');
                document.getElementById(targetId).classList.add('active');

                if (targetId === 'contacts-view') {
                    document.getElementById('contact-search').focus();
                }
            });
        });
    }

    // --- Global Actions ---
    bindGlobalActions() {
        document.getElementById('add-btn-global').addEventListener('click', () => {
            // Context aware add button
            const activeView = document.querySelector('.view-section.active').id;
            if (activeView === 'contacts-view') this.openContactModal();
            else this.openDealModal();
        });

        // Search
        document.getElementById('contact-search').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = db.getContacts().filter(c =>
                c.name.toLowerCase().includes(query) ||
                (c.email && c.email.toLowerCase().includes(query)) ||
                (c.company && c.company.toLowerCase().includes(query))
            );
            ui.renderContacts(filtered);
        });

        // Close Modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => ui.closeModals());
        });
        document.getElementById('modal-overlay').addEventListener('click', () => ui.closeModals());

        // Deal Insights global button
        document.getElementById('deal-insights-btn').addEventListener('click', () => {
            const deals = db.getDeals();
            if (deals.length === 0) {
                ui.showToast('No active deals to analyze.', 'error');
                return;
            }
            // Quick summary of entire pipeline
            const val = deals.reduce((sum, d) => sum + Number(d.value), 0);
            this.showAIResult("Pipeline Health", `You have **${deals.length}** active deals worth **$${val.toLocaleString()}**.\n\nGreat job maintaining the pipeline! Check individual deals for specific insights.`);
        });
    }

    // --- Data Export/Import ---
    bindDataActions() {
        document.getElementById('export-btn').addEventListener('click', () => {
            db.exportJSON();
            ui.showToast('Database exported successfully.');
        });

        const fileInput = document.getElementById('import-file');
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                if (db.importJSON(content)) {
                    this.refreshViews();
                    ui.showToast('Database imported successfully.');
                } else {
                    ui.showToast('Failed to import database. Invalid format.', 'error');
                }
                fileInput.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    // --- Forms ---
    bindForms() {
        // Settings Form
        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('setting-api-key').value;
            db.updateSettings({ geminiApiKey: apiKey });
            ui.showToast('Settings saved successfully.');
        });

        // Contact Form
        document.getElementById('contact-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const contact = {
                name: document.getElementById('contact-name').value,
                email: document.getElementById('contact-email').value,
                company: document.getElementById('contact-company').value,
                phone: document.getElementById('contact-phone').value,
                notes: document.getElementById('contact-notes').value
            };

            const id = document.getElementById('contact-id').value;
            if (id) {
                db.updateContact(id, contact);
                ui.showToast('Contact updated.');
            } else {
                db.addContact(contact);
                ui.showToast('Contact added.');
            }

            ui.closeModals();
            this.refreshViews();
        });

        // Deal Form
        document.getElementById('deal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const deal = {
                title: document.getElementById('deal-title').value,
                value: Number(document.getElementById('deal-value').value),
                contactId: document.getElementById('deal-contact').value,
                stage: document.getElementById('deal-stage').value
            };

            const id = document.getElementById('deal-id').value;
            if (id) {
                db.updateDeal(id, deal);
                ui.showToast('Deal updated.');
            } else {
                db.addDeal(deal);
                ui.showToast('Deal added.');
            }

            ui.closeModals();
            this.refreshViews();
        });
    }

    loadSettings() {
        const settings = db.getSettings();
        if (settings.geminiApiKey) {
            document.getElementById('setting-api-key').value = settings.geminiApiKey;
        }
    }

    // --- Modal Handlers ---
    openContactModal(id = null) {
        document.getElementById('contact-form').reset();
        document.getElementById('contact-id').value = '';
        document.getElementById('contact-modal-title').textContent = 'Add Contact';

        if (id) {
            const c = db.getContact(id);
            if (c) {
                document.getElementById('contact-id').value = c.id;
                document.getElementById('contact-name').value = c.name;
                document.getElementById('contact-email').value = c.email || '';
                document.getElementById('contact-company').value = c.company || '';
                document.getElementById('contact-phone').value = c.phone || '';
                document.getElementById('contact-notes').value = c.notes || '';
                document.getElementById('contact-modal-title').textContent = 'Edit Contact';
            }
        }
        ui.openModal('contact-modal');
    }

    openDealModal(id = null) {
        document.getElementById('deal-form').reset();
        document.getElementById('deal-id').value = '';
        document.getElementById('deal-modal-title').textContent = 'Add Deal';

        // Ensure contacts are loaded
        ui.populateContactSelects();

        if (id) {
            const d = db.getDeal(id); // NOTE: Requires getDeal in db.js if we want edit deal, currently only add/update implemented loosely. We'll skip edit for MVP deals specifically or add it.
        }
        ui.openModal('deal-modal');
    }

    // --- Deletion Handlers ---
    deleteContact(id) {
        if (confirm('Are you sure you want to delete this contact? Related deals will also be removed.')) {
            db.deleteContact(id);
            this.refreshViews();
            ui.showToast('Contact deleted.');
        }
    }

    deleteDeal(id) {
        if (confirm('Are you sure you want to delete this deal?')) {
            db.deleteDeal(id);
            this.refreshViews();
            ui.showToast('Deal deleted.');
        }
    }

    // --- Drag and Drop Handlers (Kanban) ---
    dragDeal(e) {
        e.dataTransfer.setData('text/plain', e.target.id);
        e.target.classList.add('dragging');
    }

    allowDrop(e) {
        e.preventDefault();
        // Highlight logic could go here
    }

    dropDeal(e, stageId) {
        e.preventDefault();
        const dealId = e.dataTransfer.getData('text/plain');
        const dealCard = document.getElementById(dealId);

        if (dealCard) {
            dealCard.classList.remove('dragging');
            // Update DB
            db.updateDeal(dealId, { stage: stageId });
            // Re-render
            this.refreshViews();
        }
    }

    // --- AI Handlers ---

    // Markdown parser helper for simple rendering
    parseMarkdown(text) {
        let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n- (.*?)/g, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>'); // basic wrap
        return '<p>' + html + '</p>';
    }

    showAIResult(title, content) {
        document.getElementById('ai-modal-title').innerHTML = `<i class="ph-fill ph-magic-wand text-gradient"></i> ${title}`;
        document.getElementById('ai-result').style.display = 'block';
        document.getElementById('ai-loader').style.display = 'none';
        document.getElementById('ai-result').innerHTML = this.parseMarkdown(content);
        document.getElementById('ai-copy-btn').style.display = 'inline-flex';

        document.getElementById('ai-copy-btn').onclick = () => {
            navigator.clipboard.writeText(content).then(() => ui.showToast('Copied to clipboard.'));
        };

        ui.openModal('ai-modal');
    }

    async draftEmail(contactId) {
        const contact = db.getContact(contactId);
        if (!contact) return;

        ui.openModal('ai-modal');
        document.getElementById('ai-modal-title').innerHTML = `<i class="ph-fill ph-magic-wand text-gradient"></i> Drafting Email...`;
        document.getElementById('ai-result').style.display = 'none';
        document.getElementById('ai-loader').style.display = 'flex';
        document.getElementById('ai-copy-btn').style.display = 'none';

        try {
            const draft = await ai.draftEmail(contact);
            this.showAIResult(`Draft to ${contact.name}`, draft);
        } catch (e) {
            ui.showToast(e.message, 'error');
            ui.closeModals();
        }
    }

    async dealInsights(dealId) {
        const deal = db.getDeals().find(d => d.id === dealId);
        if (!deal) return;
        const contact = db.getContact(deal.contactId);

        ui.openModal('ai-modal');
        document.getElementById('ai-modal-title').innerHTML = `<i class="ph-fill ph-magic-wand text-gradient"></i> Analyzing Deal...`;
        document.getElementById('ai-result').style.display = 'none';
        document.getElementById('ai-loader').style.display = 'flex';
        document.getElementById('ai-copy-btn').style.display = 'none';

        try {
            const insights = await ai.getDealInsights(deal, contact);
            this.showAIResult(`Insights: ${deal.title}`, insights);
        } catch (e) {
            ui.showToast(e.message, 'error');
            ui.closeModals();
        }
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

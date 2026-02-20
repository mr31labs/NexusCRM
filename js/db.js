/**
 * Data Management Service
 * Handles all local storage operations representing our JSON database.
 */

const DB_KEY = 'simple_crm_data';

const defaultData = {
    settings: {
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        theme: 'dark'
    },
    contacts: [
        { id: 'c1', name: 'Alice Cooper', email: 'alice@example.com', company: 'Acme Corp', phone: '555-0101', mobile: '555-0201', preferredContact: 'email', notes: 'Interested in premium tier.' },
        { id: 'c2', name: 'Bob Dylan', email: 'bob@example.com', company: 'Bob Inc', phone: '555-0102', mobile: '555-0202', preferredContact: 'phone', notes: 'Requires custom integration.' },
        { id: 'c3', name: 'Charlie Brown', email: 'charlie@example.com', company: 'Peanuts LLC', phone: '555-0103', mobile: '555-0203', preferredContact: 'mobile', notes: 'Follow up next week.' }
    ],
    deals: [
        { id: 'd1', title: 'Acme Premium Upgrade', value: 5000, stage: 'negotiating', contactId: 'c1', createdAt: new Date().toISOString(), notes: 'Alice is very interested in the premium support package.' },
        { id: 'd2', title: 'Bob Custom Build', value: 12000, stage: 'contacted', contactId: 'c2', createdAt: new Date().toISOString(), notes: 'Sent over the initial SOW. Waiting on technical review.' },
        { id: 'd3', title: 'Peanuts Initial Retainer', value: 2000, stage: 'lead', contactId: 'c3', createdAt: new Date().toISOString(), notes: 'Met at the conference. Needs a simple retainer setup.' }
    ]
};

class Database {
    constructor() {
        this.data = this.loadData();
    }

    loadData() {
        const stored = localStorage.getItem(DB_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse local database. Resetting to default.", e);
                return { ...defaultData };
            }
        }
        // Initialize if empty
        this.saveData(defaultData);
        return { ...defaultData };
    }

    saveData(data = this.data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
        this.data = data;
        // Optionally dispatch an event that data changed
        window.dispatchEvent(new CustomEvent('db-update'));
    }

    // --- Settings ---
    getSettings() {
        return this.data.settings || {};
    }

    updateSettings(newSettings) {
        this.data.settings = { ...this.data.settings, ...newSettings };
        this.saveData();
    }

    // --- Contacts ---
    getContacts() {
        return this.data.contacts || [];
    }

    getContact(id) {
        return this.getContacts().find(c => c.id === id);
    }

    addContact(contact) {
        contact.id = 'c' + Date.now();
        this.data.contacts.push(contact);
        this.saveData();
        return contact;
    }

    updateContact(id, updates) {
        const index = this.data.contacts.findIndex(c => c.id === id);
        if (index !== -1) {
            this.data.contacts[index] = { ...this.data.contacts[index], ...updates };
            this.saveData();
            return this.data.contacts[index];
        }
        return null;
    }

    deleteContact(id) {
        this.data.contacts = this.data.contacts.filter(c => c.id !== id);
        // Also remove associated deals
        this.data.deals = this.data.deals.filter(d => d.contactId !== id);
        this.saveData();
    }

    // --- Deals ---
    getDeals() {
        return this.data.deals || [];
    }

    getDeal(id) {
        return this.getDeals().find(d => d.id === id);
    }

    getDealsByStage(stage) {
        return this.getDeals().filter(d => d.stage === stage);
    }

    addDeal(deal) {
        deal.id = 'd' + Date.now();
        if (!deal.createdAt) deal.createdAt = new Date().toISOString();
        this.data.deals.push(deal);
        this.saveData();
        return deal;
    }

    updateDeal(id, updates) {
        const index = this.data.deals.findIndex(d => d.id === id);
        if (index !== -1) {
            this.data.deals[index] = { ...this.data.deals[index], ...updates };
            this.saveData();
            return this.data.deals[index];
        }
        return null;
    }

    deleteDeal(id) {
        this.data.deals = this.data.deals.filter(d => d.id !== id);
        this.saveData();
    }

    // --- Export / Import ---
    exportJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "crm_backup_" + new Date().toISOString().slice(0, 10) + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed.contacts && parsed.deals && parsed.settings) {
                this.saveData(parsed);
                return true;
            } else {
                console.error("Invalid JSON format. Missing required top-level keys.");
                return false;
            }
        } catch (e) {
            console.error("Invalid JSON.", e);
            return false;
        }
    }
}

// Singleton instance
const db = new Database();
export default db;

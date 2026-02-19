import db from './db.js';

/**
 * AI Integration Service
 * Uses the Gemini REST API to provide generative features.
 */
class AI {
    constructor() {
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/';
    }

    async generateContent(prompt) {
        const settings = db.getSettings();
        const apiKey = settings.geminiApiKey;
        const model = settings.geminiModel || 'gemini-2.5-flash';

        if (!apiKey) {
            throw new Error("Gemini API Key is missing. Please configure it in Settings.");
        }

        const url = `${this.baseUrl}${model}:generateContent?key=${apiKey}`;

        // Structure the request according to Gemini REST API specs
        const body = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Gemini API Error:", errorData);
                throw new Error(errorData.error?.message || `API Error: ${response.status}`);
            }

            const data = await response.json();

            // Extract the text content from the response
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error("Unexpected response format from Gemini API.");
            }

        } catch (error) {
            console.error("AI Request Failed:", error);
            throw error;
        }
    }

    // --- Specific AI Use Cases ---

    async draftEmail(contact) {
        const prompt = `
            You are an expert sales representative writing a brief, professional, and engaging introductory email to a potential client.
            
            Context about the contact:
            Name: ${contact.name}
            Company: ${contact.company || 'Unknown'}
            Notes: ${contact.notes || 'None'}
            
            Write the subject line and the body of the email. Keep it concise, friendly, and focused on building a relationship based on the notes provided.
            Do not include placeholders like "[Your Name]". Write it as a ready-to-send draft.
        `;

        return await this.generateContent(prompt);
    }

    async getDealInsights(deal, contact) {
        const prompt = `
            You are a seasoned sales manager providing quick insights on an active deal.
            
            Deal Title: ${deal.title}
            Value: $${deal.value}
            Stage: ${deal.stage}
            Contact: ${contact ? contact.name + ' from ' + contact.company : 'Unknown'}
            Notes on Contact: ${contact ? contact.notes : 'None'}
            
            Provide a very brief summary (2-3 sentences) of the deal status based on its stage.
            Then, suggest the "Next Best Action" the sales rep should take to move this deal forward.
            Use Markdown formatting (bolding, bullet points).
        `;

        return this.generateContent(prompt);
    }
}

const ai = new AI();
export default ai;

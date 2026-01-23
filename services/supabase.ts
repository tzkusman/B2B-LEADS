
export class SupabaseService {
  private url: string;
  private key: string;

  constructor() {
    // Hardcoded project credentials provided by user
    const PROJECT_URL = 'https://dbppxzkkgdtnmikkviyt.supabase.co';
    // Using the publishable key as requested to avoid the "Forbidden use of secret API key in browser" error
    const PROJECT_KEY = 'sb_publishable_EK1SAhvQC5RvjagfJR7NLA_TaqRCpnx';

    // Prioritize localStorage if the user has manually overridden them, 
    // but check if the stored key is the old secret one that caused errors.
    const storedUrl = localStorage.getItem('sb_url');
    const storedKey = localStorage.getItem('sb_key');

    if (!storedUrl || !storedKey || storedKey.startsWith('sb_secret_') || storedUrl.includes('localhost')) {
      localStorage.setItem('sb_url', PROJECT_URL);
      localStorage.setItem('sb_key', PROJECT_KEY);
      this.url = PROJECT_URL;
      this.key = PROJECT_KEY;
    } else {
      this.url = storedUrl;
      this.key = storedKey;
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    };

    const response = await fetch(`${this.url}/rest/v1/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    if (options.method === 'DELETE') return null;
    return response.json();
  }

  async getLeads(): Promise<any[]> {
    return this.request('leads?select=*,enrichment:lead_enrichment(*)&order=created_at.desc');
  }

  async addLeads(leads: any[]) {
    return this.request('leads', {
      method: 'POST',
      body: JSON.stringify(leads),
    });
  }

  async addLead(lead: any) {
    return this.request('leads', {
      method: 'POST',
      body: JSON.stringify(lead),
    });
  }

  async saveEnrichment(data: any) {
    // Upsert using lead_id as reference (requires unique constraint on lead_id in DB)
    return this.request('lead_enrichment', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(data),
    });
  }
}

export const supabase = new SupabaseService();

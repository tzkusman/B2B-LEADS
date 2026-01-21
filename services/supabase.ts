
export class SupabaseService {
  private url: string;
  private key: string;

  constructor() {
    this.url = localStorage.getItem('sb_url') || 'http://localhost:54321';
    this.key = localStorage.getItem('sb_key') || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
    
    if (!localStorage.getItem('sb_url')) {
      localStorage.setItem('sb_url', this.url);
      localStorage.setItem('sb_key', this.key);
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
    // Upsert using lead_id as reference (requires unique constraint or manual check)
    return this.request('lead_enrichment', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(data),
    });
  }
}

export const supabase = new SupabaseService();

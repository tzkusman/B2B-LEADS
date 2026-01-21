
export interface Lead {
  id: string;
  source: string;
  company_name: string;
  website?: string;
  email?: string;
  phone?: string;
  location?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialProfiles {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
}

export interface LeadEnrichment {
  id: string;
  lead_id: string;
  enriched_email?: string;
  social_profiles?: SocialProfiles;
  ai_score: number;
  validated: boolean;
  industry_category?: string;
  last_checked?: string;
  readiness_explanation?: string;
}

export interface LeadWithEnrichment extends Lead {
  enrichment?: LeadEnrichment;
}

export type AppView = 'dashboard' | 'prospector' | 'pipeline' | 'sources' | 'settings';

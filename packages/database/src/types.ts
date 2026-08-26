export interface Organization {
  id: string
  slug: string
  name: string
  custom_domain: string | null
  custom_domain_verified: boolean
  subscription_tier: 'starter' | 'growth' | 'pro'
  billing_cycle: 'monthly' | 'annual'
  subscribed_modules: string[]
  trial_ends_at: string | null
  subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
  suspended_at: string | null
  suspension_months: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  preferred_language: 'en' | 'zh' | 'ms' | 'ta'
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  roles: string[]
  status: 'active' | 'inactive' | 'pending'
  joined_at: string
}

export type ModuleName = 'people' | 'journey' | 'pages'
export type Role = 'admin' | 'member' | 'mentor' | 'volunteer'

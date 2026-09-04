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
  subscription_status: 'inactive' | 'active' | 'suspended' | 'cancelled'
  is_demo: boolean
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

export interface Member {
  id: string
  organization_id: string
  user_id: string | null
  member_number: string | null
  full_name: string
  email: string | null
  phone: string | null
  gender: string | null
  marital_status: string | null
  date_of_birth: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  baptism_date: string | null
  membership_date: string | null
  member_status: string
  created_at: string
  updated_at: string
}

export interface Track {
  id: string
  organization_id: string
  title_en: string
  title_zh: string | null
  description: string | null
  prerequisite_track_id: string | null
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: string
  organization_id: string
  track_id: string
  mentee_id: string
  mentor_id: string | null
  status: 'active' | 'completed' | 'dropped'
  enrolled_at: string
  completed_at: string | null
}

export interface Page {
  id: string
  organization_id: string
  slug: string
  title_en: string
  title_zh: string | null
  title_ms: string | null
  title_ta: string | null
  published: boolean
  created_at: string
  updated_at: string
}

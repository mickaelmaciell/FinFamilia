export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string; avatar_url: string | null; phone: string | null; currency: string; created_at: string; updated_at: string }
        Insert: { id: string; full_name?: string; avatar_url?: string | null; phone?: string | null; currency?: string }
        Update: { full_name?: string; avatar_url?: string | null; phone?: string | null; currency?: string; updated_at?: string }
        Relationships: []
      }
      households: {
        Row: { id: string; name: string; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; created_by?: string | null }
        Update: { name?: string; updated_at?: string }
        Relationships: []
      }
      household_members: {
        Row: { id: string; household_id: string; user_id: string; role: 'owner' | 'admin' | 'member'; joined_at: string }
        Insert: { id?: string; household_id: string; user_id: string; role?: 'owner' | 'admin' | 'member' }
        Update: { role?: 'owner' | 'admin' | 'member' }
        Relationships: []
      }
      household_invitations: {
        Row: { id: string; household_id: string; invited_by: string; email: string; token: string; status: 'pending' | 'accepted' | 'rejected' | 'expired'; expires_at: string; created_at: string }
        Insert: { id?: string; household_id: string; invited_by: string; email: string; status?: 'pending' | 'accepted' | 'rejected' | 'expired' }
        Update: { status?: 'pending' | 'accepted' | 'rejected' | 'expired' }
        Relationships: []
      }
      fin_accounts: {
        Row: { id: string; household_id: string; user_id: string; name: string; type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'other'; balance: number; credit_limit: number | null; color: string; icon: string; is_shared: boolean; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; household_id: string; user_id: string; name: string; type?: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'other'; balance?: number; credit_limit?: number | null; color?: string; icon?: string; is_shared?: boolean; is_active?: boolean }
        Update: { name?: string; type?: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'other'; balance?: number; credit_limit?: number | null; color?: string; icon?: string; is_shared?: boolean; is_active?: boolean; updated_at?: string }
        Relationships: []
      }
      fin_categories: {
        Row: { id: string; household_id: string | null; name: string; type: 'income' | 'expense'; color: string; icon: string; is_default: boolean; sort_order: number; created_at: string }
        Insert: { id?: string; household_id?: string | null; name: string; type: 'income' | 'expense'; color?: string; icon?: string; is_default?: boolean; sort_order?: number }
        Update: { name?: string; type?: 'income' | 'expense'; color?: string; icon?: string; sort_order?: number }
        Relationships: []
      }
      fin_transactions: {
        Row: { id: string; household_id: string; user_id: string; account_id: string; category_id: string | null; to_account_id: string | null; type: 'income' | 'expense' | 'transfer'; amount: number; description: string; notes: string | null; date: string; tags: string[]; is_recurring: boolean; recurring_id: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; household_id: string; user_id: string; account_id: string; category_id?: string | null; to_account_id?: string | null; type: 'income' | 'expense' | 'transfer'; amount: number; description: string; notes?: string | null; date?: string; tags?: string[]; is_recurring?: boolean; recurring_id?: string | null }
        Update: { account_id?: string; category_id?: string | null; to_account_id?: string | null; type?: 'income' | 'expense' | 'transfer'; amount?: number; description?: string; notes?: string | null; date?: string; tags?: string[]; updated_at?: string }
        Relationships: []
      }
      fin_budgets: {
        Row: { id: string; household_id: string; category_id: string; amount: number; month: number; year: number; created_at: string; updated_at: string }
        Insert: { id?: string; household_id: string; category_id: string; amount: number; month: number; year: number }
        Update: { amount?: number; updated_at?: string }
        Relationships: []
      }
      fin_goals: {
        Row: { id: string; household_id: string; user_id: string; name: string; description: string | null; target_amount: number; current_amount: number; deadline: string | null; color: string; icon: string; status: 'active' | 'completed' | 'cancelled'; created_at: string; updated_at: string }
        Insert: { id?: string; household_id: string; user_id: string; name: string; description?: string | null; target_amount: number; current_amount?: number; deadline?: string | null; color?: string; icon?: string; status?: 'active' | 'completed' | 'cancelled' }
        Update: { name?: string; description?: string | null; target_amount?: number; current_amount?: number; deadline?: string | null; color?: string; icon?: string; status?: 'active' | 'completed' | 'cancelled'; updated_at?: string }
        Relationships: []
      }
      fin_recurring: {
        Row: { id: string; household_id: string; user_id: string; account_id: string; category_id: string | null; type: 'income' | 'expense'; amount: number; description: string; frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; next_date: string; end_date: string | null; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; household_id: string; user_id: string; account_id: string; category_id?: string | null; type: 'income' | 'expense'; amount: number; description: string; frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; next_date: string; end_date?: string | null; is_active?: boolean }
        Update: { account_id?: string; category_id?: string | null; type?: 'income' | 'expense'; amount?: number; description?: string; frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'; next_date?: string; end_date?: string | null; is_active?: boolean; updated_at?: string }
        Relationships: []
      }
      fin_installments: {
        Row: { id: string; household_id: string; user_id: string; name: string; type: 'installment' | 'consortium'; installment_amount: number; total_installments: number; paid_installments: number; start_date: string; due_day: number; account_id: string | null; category_id: string | null; color: string; notes: string | null; status: 'active' | 'completed' | 'cancelled'; created_at: string; updated_at: string }
        Insert: { id?: string; household_id: string; user_id: string; name: string; type?: 'installment' | 'consortium'; installment_amount: number; total_installments: number; paid_installments?: number; start_date: string; due_day?: number; account_id?: string | null; category_id?: string | null; color?: string; notes?: string | null; status?: 'active' | 'completed' | 'cancelled' }
        Update: { name?: string; type?: 'installment' | 'consortium'; installment_amount?: number; total_installments?: number; paid_installments?: number; start_date?: string; due_day?: number; account_id?: string | null; category_id?: string | null; color?: string; notes?: string | null; status?: 'active' | 'completed' | 'cancelled'; updated_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Household = Database['public']['Tables']['households']['Row']
export type HouseholdMember = Database['public']['Tables']['household_members']['Row']
export type HouseholdInvitation = Database['public']['Tables']['household_invitations']['Row']
export type FinAccount = Database['public']['Tables']['fin_accounts']['Row']
export type FinCategory = Database['public']['Tables']['fin_categories']['Row']
export type FinTransaction = Database['public']['Tables']['fin_transactions']['Row']
export type FinBudget = Database['public']['Tables']['fin_budgets']['Row']
export type FinGoal = Database['public']['Tables']['fin_goals']['Row']
export type FinRecurring = Database['public']['Tables']['fin_recurring']['Row']
export type FinInstallment = Database['public']['Tables']['fin_installments']['Row']

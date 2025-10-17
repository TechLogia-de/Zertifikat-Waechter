// TypeScript Types für Supabase Schema
// Auto-generiert mit: supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      memberships: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          role: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          tenant_id: string
          connector_id: string | null
          host: string
          port: number
          proto: string
          labels: Json
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          connector_id?: string | null
          host: string
          port?: number
          proto?: string
          labels?: Json
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          connector_id?: string | null
          host?: string
          port?: number
          proto?: string
          labels?: Json
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      certificates: {
        Row: {
          id: string
          tenant_id: string
          asset_id: string | null
          fingerprint: string
          subject_cn: string
          san: Json | null
          issuer: string | null
          not_before: string
          not_after: string
          key_alg: string | null
          key_size: number | null
          serial: string | null
          is_trusted: boolean
          is_self_signed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          asset_id?: string | null
          fingerprint: string
          subject_cn: string
          san?: Json | null
          issuer?: string | null
          not_before: string
          not_after: string
          key_alg?: string | null
          key_size?: number | null
          serial?: string | null
          is_trusted?: boolean
          is_self_signed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          asset_id?: string | null
          fingerprint?: string
          subject_cn?: string
          san?: Json | null
          issuer?: string | null
          not_before?: string
          not_after?: string
          key_alg?: string | null
          key_size?: number | null
          serial?: string | null
          is_trusted?: boolean
          is_self_signed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      checks: {
        Row: {
          id: string
          certificate_id: string
          ran_at: string
          status: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          certificate_id: string
          ran_at?: string
          status: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          certificate_id?: string
          ran_at?: string
          status?: string
          details?: Json | null
          created_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          certificate_id: string
          tenant_id: string
          level: string
          message: string
          first_triggered_at: string
          last_notified_at: string | null
          acknowledged_by: string | null
          acknowledged_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          certificate_id: string
          tenant_id: string
          level: string
          message: string
          first_triggered_at?: string
          last_notified_at?: string | null
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          certificate_id?: string
          tenant_id?: string
          level?: string
          message?: string
          first_triggered_at?: string
          last_notified_at?: string | null
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          created_at?: string
        }
      }
      policies: {
        Row: {
          id: string
          tenant_id: string
          warn_days: number[]
          channels: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          warn_days?: number[]
          channels?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          warn_days?: number[]
          channels?: Json
          created_at?: string
          updated_at?: string
        }
      }
      integrations: {
        Row: {
          id: string
          tenant_id: string
          type: string
          name: string
          config: Json
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          type: string
          name: string
          config?: Json
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          type?: string
          name?: string
          config?: Json
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

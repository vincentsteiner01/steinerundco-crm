export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  crm: {
    Tables: {
      activities: {
        Row: {
          call_id: string | null
          channel: Database['crm']['Enums']['channel']
          created_at: string
          email_id: string | null
          enrollment_id: string | null
          id: number
          kpi_relevant: boolean
          lead_id: string
          meeting_id: string | null
          member_id: string | null
          metadata: Json
          note: string | null
          occurred_at: string
          outcome: string | null
          reply_label: Database['crm']['Enums']['reply_label'] | null
          source: Database['crm']['Enums']['record_source']
          step_id: string | null
          task_id: string | null
          template_id: string | null
          type: Database['crm']['Enums']['activity_type']
        }
        Insert: {
          call_id?: string | null
          channel?: Database['crm']['Enums']['channel']
          created_at?: string
          email_id?: string | null
          enrollment_id?: string | null
          id?: never
          kpi_relevant?: boolean
          lead_id: string
          meeting_id?: string | null
          member_id?: string | null
          metadata?: Json
          note?: string | null
          occurred_at?: string
          outcome?: string | null
          reply_label?: Database['crm']['Enums']['reply_label'] | null
          source?: Database['crm']['Enums']['record_source']
          step_id?: string | null
          task_id?: string | null
          template_id?: string | null
          type: Database['crm']['Enums']['activity_type']
        }
        Update: {
          call_id?: string | null
          channel?: Database['crm']['Enums']['channel']
          created_at?: string
          email_id?: string | null
          enrollment_id?: string | null
          id?: never
          kpi_relevant?: boolean
          lead_id?: string
          meeting_id?: string | null
          member_id?: string | null
          metadata?: Json
          note?: string | null
          occurred_at?: string
          outcome?: string | null
          reply_label?: Database['crm']['Enums']['reply_label'] | null
          source?: Database['crm']['Enums']['record_source']
          step_id?: string | null
          task_id?: string | null
          template_id?: string | null
          type?: Database['crm']['Enums']['activity_type']
        }
        Relationships: [
          {
            foreignKeyName: 'activities_call_id_fkey'
            columns: ['call_id']
            isOneToOne: false
            referencedRelation: 'calls'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_email_id_fkey'
            columns: ['email_id']
            isOneToOne: false
            referencedRelation: 'emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_enrollment_id_fkey'
            columns: ['enrollment_id']
            isOneToOne: false
            referencedRelation: 'enrollments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'activities_meeting_id_fkey'
            columns: ['meeting_id']
            isOneToOne: false
            referencedRelation: 'meetings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_step_id_fkey'
            columns: ['step_id']
            isOneToOne: false
            referencedRelation: 'sequence_steps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'v_template_performance'
            referencedColumns: ['template_id']
          },
        ]
      }
      call_outcome_defs: {
        Row: {
          counts_attempt: boolean
          default_next_action: string | null
          group_label: string
          hotkey: string | null
          is_connect: boolean
          is_dm: boolean
          label: string
          outcome: Database['crm']['Enums']['call_outcome']
          sort_order: number
        }
        Insert: {
          counts_attempt?: boolean
          default_next_action?: string | null
          group_label: string
          hotkey?: string | null
          is_connect?: boolean
          is_dm?: boolean
          label: string
          outcome: Database['crm']['Enums']['call_outcome']
          sort_order?: number
        }
        Update: {
          counts_attempt?: boolean
          default_next_action?: string | null
          group_label?: string
          hotkey?: string | null
          is_connect?: boolean
          is_dm?: boolean
          label?: string
          outcome?: Database['crm']['Enums']['call_outcome']
          sort_order?: number
        }
        Relationships: []
      }
      calls: {
        Row: {
          answered_at: string | null
          attempt_no: number | null
          corrected: boolean
          created_at: string
          direction: Database['crm']['Enums']['call_direction']
          duration_sec: number | null
          ended_at: string | null
          enrollment_id: string | null
          external_call_id: string | null
          from_number: string | null
          id: string
          kpi_relevant: boolean
          lead_id: string
          member_id: string | null
          note: string | null
          outcome: Database['crm']['Enums']['call_outcome']
          provider: Database['crm']['Enums']['call_provider']
          raw_outcome: string | null
          reached_name: string | null
          reached_person: Database['crm']['Enums']['reached_person'] | null
          recording_url: string | null
          source: Database['crm']['Enums']['record_source']
          started_at: string
          talk_sec: number | null
          template_id: string | null
          to_number: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          attempt_no?: number | null
          corrected?: boolean
          created_at?: string
          direction?: Database['crm']['Enums']['call_direction']
          duration_sec?: number | null
          ended_at?: string | null
          enrollment_id?: string | null
          external_call_id?: string | null
          from_number?: string | null
          id?: string
          kpi_relevant?: boolean
          lead_id: string
          member_id?: string | null
          note?: string | null
          outcome: Database['crm']['Enums']['call_outcome']
          provider?: Database['crm']['Enums']['call_provider']
          raw_outcome?: string | null
          reached_name?: string | null
          reached_person?: Database['crm']['Enums']['reached_person'] | null
          recording_url?: string | null
          source?: Database['crm']['Enums']['record_source']
          started_at?: string
          talk_sec?: number | null
          template_id?: string | null
          to_number?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          attempt_no?: number | null
          corrected?: boolean
          created_at?: string
          direction?: Database['crm']['Enums']['call_direction']
          duration_sec?: number | null
          ended_at?: string | null
          enrollment_id?: string | null
          external_call_id?: string | null
          from_number?: string | null
          id?: string
          kpi_relevant?: boolean
          lead_id?: string
          member_id?: string | null
          note?: string | null
          outcome?: Database['crm']['Enums']['call_outcome']
          provider?: Database['crm']['Enums']['call_provider']
          raw_outcome?: string | null
          reached_name?: string | null
          reached_person?: Database['crm']['Enums']['reached_person'] | null
          recording_url?: string | null
          source?: Database['crm']['Enums']['record_source']
          started_at?: string
          talk_sec?: number | null
          template_id?: string | null
          to_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'calls_enrollment_id_fkey'
            columns: ['enrollment_id']
            isOneToOne: false
            referencedRelation: 'enrollments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calls_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calls_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'calls_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calls_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calls_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'v_template_performance'
            referencedColumns: ['template_id']
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          created_at: string
          do_not_contact: boolean
          domain: string | null
          employees: number | null
          id: string
          linkedin_url: string | null
          name: string
          name_norm: string | null
          notes: string | null
          phone_e164: string | null
          segment: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          do_not_contact?: boolean
          domain?: string | null
          employees?: number | null
          id?: string
          linkedin_url?: string | null
          name: string
          name_norm?: string | null
          notes?: string | null
          phone_e164?: string | null
          segment?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          do_not_contact?: boolean
          domain?: string | null
          employees?: number | null
          id?: string
          linkedin_url?: string | null
          name?: string
          name_norm?: string | null
          notes?: string | null
          phone_e164?: string | null
          segment?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          customer: string
          frequency: string
          id: string
          lead_id: string | null
          notes: string | null
          product: string | null
          recurring_amount: number
          setup_amount: number
          start_date: string
          term_months: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer: string
          frequency?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          product?: string | null
          recurring_amount?: number
          setup_amount?: number
          start_date: string
          term_months?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string
          frequency?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          product?: string | null
          recurring_amount?: number
          setup_amount?: number
          start_date?: string
          term_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contracts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
        ]
      }
      daily_counters: {
        Row: {
          date: string
          member_id: string
          metric: Database['crm']['Enums']['metric']
          note: string | null
          period: Database['crm']['Enums']['counter_period']
          source: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          date: string
          member_id: string
          metric: Database['crm']['Enums']['metric']
          note?: string | null
          period?: Database['crm']['Enums']['counter_period']
          source?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Update: {
          date?: string
          member_id?: string
          metric?: Database['crm']['Enums']['metric']
          note?: string | null
          period?: Database['crm']['Enums']['counter_period']
          source?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'daily_counters_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'daily_counters_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      eingang: {
        Row: {
          absender_name: string | null
          activity_id: number | null
          art: string
          created_at: string
          empfangen_at: string
          ergebnis: string | null
          external_id: string
          id: string
          lead_id: string | null
          linkedin_slug: string | null
          member_id: string
          quelle: string
          roh: Json
          status: string
          text: string | null
          verarbeitet_at: string | null
        }
        Insert: {
          absender_name?: string | null
          activity_id?: number | null
          art?: string
          created_at?: string
          empfangen_at?: string
          ergebnis?: string | null
          external_id: string
          id?: string
          lead_id?: string | null
          linkedin_slug?: string | null
          member_id: string
          quelle: string
          roh?: Json
          status?: string
          text?: string | null
          verarbeitet_at?: string | null
        }
        Update: {
          absender_name?: string | null
          activity_id?: number | null
          art?: string
          created_at?: string
          empfangen_at?: string
          ergebnis?: string | null
          external_id?: string
          id?: string
          lead_id?: string | null
          linkedin_slug?: string | null
          member_id?: string
          quelle?: string
          roh?: Json
          status?: string
          text?: string | null
          verarbeitet_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'eingang_activity_id_fkey'
            columns: ['activity_id']
            isOneToOne: false
            referencedRelation: 'activities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'eingang_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'eingang_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'eingang_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      eingang_tokens: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_used_at: string | null
          member_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          member_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          member_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: 'eingang_tokens_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          bounce_reason: string | null
          channel: Database['crm']['Enums']['email_channel']
          consent_at_snapshot: string | null
          consent_basis_snapshot: Database['crm']['Enums']['email_consent_basis'] | null
          consent_note_snapshot: string | null
          created_at: string
          direction: Database['crm']['Enums']['email_direction']
          einordnung: string | null
          empfaenger_id: string | null
          enrollment_id: string | null
          erledigt_at: string | null
          from_address: string | null
          gelesen_at: string | null
          hinweis: string | null
          id: string
          in_reply_to: string | null
          kampagne_id: string | null
          label: Database['crm']['Enums']['reply_label'] | null
          lead_id: string
          member_id: string | null
          message_id_header: string | null
          postfach_id: string | null
          provider_message_id: string | null
          provider_thread_id: string | null
          references_header: string | null
          replied_at: string | null
          schritt_id: string | null
          sent_at: string | null
          sofort: boolean
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['email_status']
          status_at: string
          step_id: string | null
          subject: string | null
          template_id: string | null
          to_address: string | null
          updated_at: string
          variante_id: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          bounce_reason?: string | null
          channel?: Database['crm']['Enums']['email_channel']
          consent_at_snapshot?: string | null
          consent_basis_snapshot?: Database['crm']['Enums']['email_consent_basis'] | null
          consent_note_snapshot?: string | null
          created_at?: string
          direction?: Database['crm']['Enums']['email_direction']
          einordnung?: string | null
          empfaenger_id?: string | null
          enrollment_id?: string | null
          erledigt_at?: string | null
          from_address?: string | null
          gelesen_at?: string | null
          hinweis?: string | null
          id?: string
          in_reply_to?: string | null
          kampagne_id?: string | null
          label?: Database['crm']['Enums']['reply_label'] | null
          lead_id: string
          member_id?: string | null
          message_id_header?: string | null
          postfach_id?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          references_header?: string | null
          replied_at?: string | null
          schritt_id?: string | null
          sent_at?: string | null
          sofort?: boolean
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['email_status']
          status_at?: string
          step_id?: string | null
          subject?: string | null
          template_id?: string | null
          to_address?: string | null
          updated_at?: string
          variante_id?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          bounce_reason?: string | null
          channel?: Database['crm']['Enums']['email_channel']
          consent_at_snapshot?: string | null
          consent_basis_snapshot?: Database['crm']['Enums']['email_consent_basis'] | null
          consent_note_snapshot?: string | null
          created_at?: string
          direction?: Database['crm']['Enums']['email_direction']
          einordnung?: string | null
          empfaenger_id?: string | null
          enrollment_id?: string | null
          erledigt_at?: string | null
          from_address?: string | null
          gelesen_at?: string | null
          hinweis?: string | null
          id?: string
          in_reply_to?: string | null
          kampagne_id?: string | null
          label?: Database['crm']['Enums']['reply_label'] | null
          lead_id?: string
          member_id?: string | null
          message_id_header?: string | null
          postfach_id?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          references_header?: string | null
          replied_at?: string | null
          schritt_id?: string | null
          sent_at?: string | null
          sofort?: boolean
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['email_status']
          status_at?: string
          step_id?: string | null
          subject?: string | null
          template_id?: string | null
          to_address?: string | null
          updated_at?: string
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'emails_empfaenger_id_fkey'
            columns: ['empfaenger_id']
            isOneToOne: false
            referencedRelation: 'mail_empfaenger'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_enrollment_id_fkey'
            columns: ['enrollment_id']
            isOneToOne: false
            referencedRelation: 'enrollments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'v_mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'emails_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_postfach_id_fkey'
            columns: ['postfach_id']
            isOneToOne: false
            referencedRelation: 'mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_postfach_id_fkey'
            columns: ['postfach_id']
            isOneToOne: false
            referencedRelation: 'v_mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_schritt_id_fkey'
            columns: ['schritt_id']
            isOneToOne: false
            referencedRelation: 'mail_schritte'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_step_id_fkey'
            columns: ['step_id']
            isOneToOne: false
            referencedRelation: 'sequence_steps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'v_template_performance'
            referencedColumns: ['template_id']
          },
          {
            foreignKeyName: 'emails_variante_id_fkey'
            columns: ['variante_id']
            isOneToOne: false
            referencedRelation: 'mail_varianten'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'emails_variante_id_fkey'
            columns: ['variante_id']
            isOneToOne: false
            referencedRelation: 'v_mail_varianten'
            referencedColumns: ['variante_id']
          },
        ]
      }
      enrollments: {
        Row: {
          channel: Database['crm']['Enums']['channel']
          completed_at: string | null
          created_at: string
          current_position: number | null
          current_step_id: string | null
          id: string
          last_step_at: string | null
          lead_id: string
          member_id: string | null
          next_due_at: string | null
          note: string | null
          sequence_id: string
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          started_at: string
          status: Database['crm']['Enums']['enrollment_status']
          stopped_at: string | null
          stopped_reason: Database['crm']['Enums']['stop_reason'] | null
          updated_at: string
        }
        Insert: {
          channel: Database['crm']['Enums']['channel']
          completed_at?: string | null
          created_at?: string
          current_position?: number | null
          current_step_id?: string | null
          id?: string
          last_step_at?: string | null
          lead_id: string
          member_id?: string | null
          next_due_at?: string | null
          note?: string | null
          sequence_id: string
          snooze_count?: number
          source?: Database['crm']['Enums']['record_source']
          started_at?: string
          status?: Database['crm']['Enums']['enrollment_status']
          stopped_at?: string | null
          stopped_reason?: Database['crm']['Enums']['stop_reason'] | null
          updated_at?: string
        }
        Update: {
          channel?: Database['crm']['Enums']['channel']
          completed_at?: string | null
          created_at?: string
          current_position?: number | null
          current_step_id?: string | null
          id?: string
          last_step_at?: string | null
          lead_id?: string
          member_id?: string | null
          next_due_at?: string | null
          note?: string | null
          sequence_id?: string
          snooze_count?: number
          source?: Database['crm']['Enums']['record_source']
          started_at?: string
          status?: Database['crm']['Enums']['enrollment_status']
          stopped_at?: string | null
          stopped_reason?: Database['crm']['Enums']['stop_reason'] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enrollments_current_step_id_fkey'
            columns: ['current_step_id']
            isOneToOne: false
            referencedRelation: 'sequence_steps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enrollments_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enrollments_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'enrollments_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enrollments_sequence_id_fkey'
            columns: ['sequence_id']
            isOneToOne: false
            referencedRelation: 'sequences'
            referencedColumns: ['id']
          },
        ]
      }
      feedback: {
        Row: {
          antwort: string | null
          antwort_at: string | null
          app_version: string | null
          art: string
          beschreibung: string
          created_at: string
          id: string
          konsole: Json
          member_id: string | null
          notiz: string | null
          notiz_at: string | null
          notiz_von: string | null
          route: string | null
          screenshot_path: string | null
          status: string
          titel: string | null
          updated_at: string
          url: string | null
          user_agent: string | null
          viewport: string | null
        }
        Insert: {
          antwort?: string | null
          antwort_at?: string | null
          app_version?: string | null
          art?: string
          beschreibung: string
          created_at?: string
          id?: string
          konsole?: Json
          member_id?: string | null
          notiz?: string | null
          notiz_at?: string | null
          notiz_von?: string | null
          route?: string | null
          screenshot_path?: string | null
          status?: string
          titel?: string | null
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          viewport?: string | null
        }
        Update: {
          antwort?: string | null
          antwort_at?: string | null
          app_version?: string | null
          art?: string
          beschreibung?: string
          created_at?: string
          id?: string
          konsole?: Json
          member_id?: string | null
          notiz?: string | null
          notiz_at?: string | null
          notiz_von?: string | null
          route?: string | null
          screenshot_path?: string | null
          status?: string
          titel?: string | null
          updated_at?: string
          url?: string | null
          user_agent?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          blocked: number
          created_at: string
          file_name: string | null
          id: string
          inserted: number
          label: string | null
          member_id: string | null
          payload: Json | null
          preset: string | null
          row_count: number
          skipped: number
          source: Database['crm']['Enums']['record_source']
          summary: Json | null
          undone_at: string | null
          updated: number
        }
        Insert: {
          blocked?: number
          created_at?: string
          file_name?: string | null
          id?: string
          inserted?: number
          label?: string | null
          member_id?: string | null
          payload?: Json | null
          preset?: string | null
          row_count?: number
          skipped?: number
          source: Database['crm']['Enums']['record_source']
          summary?: Json | null
          undone_at?: string | null
          updated?: number
        }
        Update: {
          blocked?: number
          created_at?: string
          file_name?: string | null
          id?: string
          inserted?: number
          label?: string | null
          member_id?: string | null
          payload?: Json | null
          preset?: string | null
          row_count?: number
          skipped?: number
          source?: Database['crm']['Enums']['record_source']
          summary?: Json | null
          undone_at?: string | null
          updated?: number
        }
        Relationships: [
          {
            foreignKeyName: 'import_batches_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      lead_tags: {
        Row: {
          lead_id: string
          tag_id: string
        }
        Insert: {
          lead_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_tags_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_tags_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'lead_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      leads: {
        Row: {
          call_basis: Database['crm']['Enums']['call_basis'] | null
          call_basis_note: string | null
          call_basis_url: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          custom: Json
          deleted_at: string | null
          do_not_contact: boolean
          do_not_contact_channels: Database['crm']['Enums']['channel'][] | null
          email: string | null
          email_consent_at: string | null
          email_consent_basis: Database['crm']['Enums']['email_consent_basis']
          email_consent_note: string | null
          email_consent_ref: Json | null
          ended_at: string | null
          ended_note: string | null
          ended_reason: Database['crm']['Enums']['ended_reason'] | null
          first_name: string | null
          follow_up_count: number
          full_name: string | null
          id: string
          inbound_unanswered_since: string | null
          last_activity_at: string | null
          last_activity_type: Database['crm']['Enums']['activity_type'] | null
          last_inbound_at: string | null
          last_inbound_channel: Database['crm']['Enums']['channel'] | null
          last_name: string | null
          last_outbound_at: string | null
          legacy_id: number | null
          legacy_system_id: string | null
          legacy_system_id_2: string | null
          linkedin_url: string | null
          linkedin_url_norm: string | null
          next_action_at: string | null
          next_action_kind: Database['crm']['Enums']['next_action_kind'] | null
          next_action_label: string | null
          next_action_ref: string | null
          notes: string | null
          objection_at: string | null
          objection_note: string | null
          opened_by_id: string | null
          owner_id: string | null
          phone_collected_at: string | null
          phone_e164: string | null
          phone_numbers: Json
          phone_source: Database['crm']['Enums']['phone_source']
          phone_source_url: string | null
          phone_type: Database['crm']['Enums']['phone_type']
          priority: number
          privacy_notice_sent_at: string | null
          privacy_notice_version: string | null
          qualification: Json
          released: boolean
          released_at: string | null
          released_reason: string | null
          role: Database['crm']['Enums']['lead_role']
          role_title: string | null
          sales_nav_url: string | null
          sales_owner_id: string | null
          salutation: Database['crm']['Enums']['salutation']
          search: unknown
          source: Database['crm']['Enums']['record_source']
          source_batch_id: string | null
          stage: Database['crm']['Enums']['lead_stage']
          stage_changed_at: string
          title: string | null
          updated_at: string
          url_verified: boolean
          website: string | null
        }
        Insert: {
          call_basis?: Database['crm']['Enums']['call_basis'] | null
          call_basis_note?: string | null
          call_basis_url?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          deleted_at?: string | null
          do_not_contact?: boolean
          do_not_contact_channels?: Database['crm']['Enums']['channel'][] | null
          email?: string | null
          email_consent_at?: string | null
          email_consent_basis?: Database['crm']['Enums']['email_consent_basis']
          email_consent_note?: string | null
          email_consent_ref?: Json | null
          ended_at?: string | null
          ended_note?: string | null
          ended_reason?: Database['crm']['Enums']['ended_reason'] | null
          first_name?: string | null
          follow_up_count?: number
          full_name?: string | null
          id?: string
          inbound_unanswered_since?: string | null
          last_activity_at?: string | null
          last_activity_type?: Database['crm']['Enums']['activity_type'] | null
          last_inbound_at?: string | null
          last_inbound_channel?: Database['crm']['Enums']['channel'] | null
          last_name?: string | null
          last_outbound_at?: string | null
          legacy_id?: number | null
          legacy_system_id?: string | null
          legacy_system_id_2?: string | null
          linkedin_url?: string | null
          linkedin_url_norm?: string | null
          next_action_at?: string | null
          next_action_kind?: Database['crm']['Enums']['next_action_kind'] | null
          next_action_label?: string | null
          next_action_ref?: string | null
          notes?: string | null
          objection_at?: string | null
          objection_note?: string | null
          opened_by_id?: string | null
          owner_id?: string | null
          phone_collected_at?: string | null
          phone_e164?: string | null
          phone_numbers?: Json
          phone_source?: Database['crm']['Enums']['phone_source']
          phone_source_url?: string | null
          phone_type?: Database['crm']['Enums']['phone_type']
          priority?: number
          privacy_notice_sent_at?: string | null
          privacy_notice_version?: string | null
          qualification?: Json
          released?: boolean
          released_at?: string | null
          released_reason?: string | null
          role?: Database['crm']['Enums']['lead_role']
          role_title?: string | null
          sales_nav_url?: string | null
          sales_owner_id?: string | null
          salutation?: Database['crm']['Enums']['salutation']
          search?: unknown
          source?: Database['crm']['Enums']['record_source']
          source_batch_id?: string | null
          stage?: Database['crm']['Enums']['lead_stage']
          stage_changed_at?: string
          title?: string | null
          updated_at?: string
          url_verified?: boolean
          website?: string | null
        }
        Update: {
          call_basis?: Database['crm']['Enums']['call_basis'] | null
          call_basis_note?: string | null
          call_basis_url?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          deleted_at?: string | null
          do_not_contact?: boolean
          do_not_contact_channels?: Database['crm']['Enums']['channel'][] | null
          email?: string | null
          email_consent_at?: string | null
          email_consent_basis?: Database['crm']['Enums']['email_consent_basis']
          email_consent_note?: string | null
          email_consent_ref?: Json | null
          ended_at?: string | null
          ended_note?: string | null
          ended_reason?: Database['crm']['Enums']['ended_reason'] | null
          first_name?: string | null
          follow_up_count?: number
          full_name?: string | null
          id?: string
          inbound_unanswered_since?: string | null
          last_activity_at?: string | null
          last_activity_type?: Database['crm']['Enums']['activity_type'] | null
          last_inbound_at?: string | null
          last_inbound_channel?: Database['crm']['Enums']['channel'] | null
          last_name?: string | null
          last_outbound_at?: string | null
          legacy_id?: number | null
          legacy_system_id?: string | null
          legacy_system_id_2?: string | null
          linkedin_url?: string | null
          linkedin_url_norm?: string | null
          next_action_at?: string | null
          next_action_kind?: Database['crm']['Enums']['next_action_kind'] | null
          next_action_label?: string | null
          next_action_ref?: string | null
          notes?: string | null
          objection_at?: string | null
          objection_note?: string | null
          opened_by_id?: string | null
          owner_id?: string | null
          phone_collected_at?: string | null
          phone_e164?: string | null
          phone_numbers?: Json
          phone_source?: Database['crm']['Enums']['phone_source']
          phone_source_url?: string | null
          phone_type?: Database['crm']['Enums']['phone_type']
          priority?: number
          privacy_notice_sent_at?: string | null
          privacy_notice_version?: string | null
          qualification?: Json
          released?: boolean
          released_at?: string | null
          released_reason?: string | null
          role?: Database['crm']['Enums']['lead_role']
          role_title?: string | null
          sales_nav_url?: string | null
          sales_owner_id?: string | null
          salutation?: Database['crm']['Enums']['salutation']
          search?: unknown
          source?: Database['crm']['Enums']['record_source']
          source_batch_id?: string | null
          stage?: Database['crm']['Enums']['lead_stage']
          stage_changed_at?: string
          title?: string | null
          updated_at?: string
          url_verified?: boolean
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'leads_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_opened_by_id_fkey'
            columns: ['opened_by_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_sales_owner_id_fkey'
            columns: ['sales_owner_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_source_batch_id_fkey'
            columns: ['source_batch_id']
            isOneToOne: false
            referencedRelation: 'import_batches'
            referencedColumns: ['id']
          },
        ]
      }
      linkedin_connections: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          kpi_relevant: boolean
          lead_id: string
          member_id: string
          note: string | null
          note_variant: Database['crm']['Enums']['note_variant']
          requested_at: string | null
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['connection_status']
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          kpi_relevant?: boolean
          lead_id: string
          member_id: string
          note?: string | null
          note_variant?: Database['crm']['Enums']['note_variant']
          requested_at?: string | null
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['connection_status']
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          kpi_relevant?: boolean
          lead_id?: string
          member_id?: string
          note?: string | null
          note_variant?: Database['crm']['Enums']['note_variant']
          requested_at?: string | null
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['connection_status']
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'linkedin_connections_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'linkedin_connections_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'linkedin_connections_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      mail_domains: {
        Row: {
          anbieter: string
          created_at: string
          created_by: string | null
          dns: Json
          dns_geprueft_at: string | null
          domain: string
          id: string
          notiz: string | null
          registriert_am: string | null
          updated_at: string
          website: string | null
          zweck: string
        }
        Insert: {
          anbieter?: string
          created_at?: string
          created_by?: string | null
          dns?: Json
          dns_geprueft_at?: string | null
          domain: string
          id?: string
          notiz?: string | null
          registriert_am?: string | null
          updated_at?: string
          website?: string | null
          zweck?: string
        }
        Update: {
          anbieter?: string
          created_at?: string
          created_by?: string | null
          dns?: Json
          dns_geprueft_at?: string | null
          domain?: string
          id?: string
          notiz?: string | null
          registriert_am?: string | null
          updated_at?: string
          website?: string | null
          zweck?: string
        }
        Relationships: []
      }
      mail_empfaenger: {
        Row: {
          abmelde_token: string
          beantwortet_at: string | null
          betreff_start: string | null
          created_at: string
          email: string
          gestartet_at: string | null
          hinzugefuegt_von: string | null
          id: string
          in_arbeit: string | null
          in_arbeit_seit: string | null
          kampagne_id: string
          lead_id: string
          letzte_message_id: string | null
          letzter_versand_at: string | null
          naechster_versand_at: string | null
          nr: number
          postfach_id: string | null
          referenzen: string | null
          schritt: number
          status: string
          stopp_grund: string | null
          updated_at: string
          variablen: Json
          versuche: number
        }
        Insert: {
          abmelde_token?: string
          beantwortet_at?: string | null
          betreff_start?: string | null
          created_at?: string
          email: string
          gestartet_at?: string | null
          hinzugefuegt_von?: string | null
          id?: string
          in_arbeit?: string | null
          in_arbeit_seit?: string | null
          kampagne_id: string
          lead_id: string
          letzte_message_id?: string | null
          letzter_versand_at?: string | null
          naechster_versand_at?: string | null
          nr?: never
          postfach_id?: string | null
          referenzen?: string | null
          schritt?: number
          status?: string
          stopp_grund?: string | null
          updated_at?: string
          variablen?: Json
          versuche?: number
        }
        Update: {
          abmelde_token?: string
          beantwortet_at?: string | null
          betreff_start?: string | null
          created_at?: string
          email?: string
          gestartet_at?: string | null
          hinzugefuegt_von?: string | null
          id?: string
          in_arbeit?: string | null
          in_arbeit_seit?: string | null
          kampagne_id?: string
          lead_id?: string
          letzte_message_id?: string | null
          letzter_versand_at?: string | null
          naechster_versand_at?: string | null
          nr?: never
          postfach_id?: string | null
          referenzen?: string | null
          schritt?: number
          status?: string
          stopp_grund?: string | null
          updated_at?: string
          variablen?: Json
          versuche?: number
        }
        Relationships: [
          {
            foreignKeyName: 'mail_empfaenger_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_empfaenger_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'v_mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_empfaenger_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_empfaenger_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'mail_empfaenger_postfach_id_fkey'
            columns: ['postfach_id']
            isOneToOne: false
            referencedRelation: 'mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_empfaenger_postfach_id_fkey'
            columns: ['postfach_id']
            isOneToOne: false
            referencedRelation: 'v_mail_postfaecher'
            referencedColumns: ['id']
          },
        ]
      }
      mail_kampagne_postfaecher: {
        Row: {
          kampagne_id: string
          postfach_id: string
        }
        Insert: {
          kampagne_id: string
          postfach_id: string
        }
        Update: {
          kampagne_id?: string
          postfach_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mail_kampagne_postfaecher_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_kampagne_postfaecher_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'v_mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_kampagne_postfaecher_postfach_id_fkey'
            columns: ['postfach_id']
            isOneToOne: false
            referencedRelation: 'mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_kampagne_postfaecher_postfach_id_fkey'
            columns: ['postfach_id']
            isOneToOne: false
            referencedRelation: 'v_mail_postfaecher'
            referencedColumns: ['id']
          },
        ]
      }
      mail_kampagnen: {
        Row: {
          abmelde_kopf: boolean
          abmelde_satz: boolean
          beendet_at: string | null
          bounce_schutz: boolean
          created_at: string
          datenschutz_satz: boolean
          gestartet_at: string | null
          id: string
          member_id: string
          name: string
          neue_pro_tag: number
          notiz: string | null
          status: string
          status_text: string | null
          stopp_firma: boolean
          tageslimit: number
          updated_at: string
          zeitplan: Json
        }
        Insert: {
          abmelde_kopf?: boolean
          abmelde_satz?: boolean
          beendet_at?: string | null
          bounce_schutz?: boolean
          created_at?: string
          datenschutz_satz?: boolean
          gestartet_at?: string | null
          id?: string
          member_id?: string
          name: string
          neue_pro_tag?: number
          notiz?: string | null
          status?: string
          status_text?: string | null
          stopp_firma?: boolean
          tageslimit?: number
          updated_at?: string
          zeitplan?: Json
        }
        Update: {
          abmelde_kopf?: boolean
          abmelde_satz?: boolean
          beendet_at?: string | null
          bounce_schutz?: boolean
          created_at?: string
          datenschutz_satz?: boolean
          gestartet_at?: string | null
          id?: string
          member_id?: string
          name?: string
          neue_pro_tag?: number
          notiz?: string | null
          status?: string
          status_text?: string | null
          stopp_firma?: boolean
          tageslimit?: number
          updated_at?: string
          zeitplan?: Json
        }
        Relationships: []
      }
      mail_mx: {
        Row: {
          domain: string
          geprueft_at: string
          hosts: string[]
          klasse: string
        }
        Insert: {
          domain: string
          geprueft_at?: string
          hosts?: string[]
          klasse: string
        }
        Update: {
          domain?: string
          geprueft_at?: string
          hosts?: string[]
          klasse?: string
        }
        Relationships: []
      }
      mail_platzierung: {
        Row: {
          betreff: string
          created_at: string
          created_by: string | null
          fehler: string | null
          geprueft_at: string | null
          gesendet_at: string | null
          id: string
          message_id: string
          ordner: string | null
          saat_id: string
          status: string
          test: string
          text: string
          von_id: string
        }
        Insert: {
          betreff: string
          created_at?: string
          created_by?: string | null
          fehler?: string | null
          geprueft_at?: string | null
          gesendet_at?: string | null
          id?: string
          message_id: string
          ordner?: string | null
          saat_id: string
          status?: string
          test: string
          text: string
          von_id: string
        }
        Update: {
          betreff?: string
          created_at?: string
          created_by?: string | null
          fehler?: string | null
          geprueft_at?: string | null
          gesendet_at?: string | null
          id?: string
          message_id?: string
          ordner?: string | null
          saat_id?: string
          status?: string
          test?: string
          text?: string
          von_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mail_platzierung_saat_id_fkey'
            columns: ['saat_id']
            isOneToOne: false
            referencedRelation: 'mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_platzierung_saat_id_fkey'
            columns: ['saat_id']
            isOneToOne: false
            referencedRelation: 'v_mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_platzierung_von_id_fkey'
            columns: ['von_id']
            isOneToOne: false
            referencedRelation: 'mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_platzierung_von_id_fkey'
            columns: ['von_id']
            isOneToOne: false
            referencedRelation: 'v_mail_postfaecher'
            referencedColumns: ['id']
          },
        ]
      }
      mail_postfaecher: {
        Row: {
          abruf_at: string | null
          abruf_ok_at: string | null
          abruf_stand: Json
          absender_name: string
          adresse: string
          anbieter: string
          benutzer: string
          created_at: string
          created_by: string | null
          domain: string | null
          fehler_folge: number
          geheimnis_id: string | null
          gesperrt_bis: string | null
          hochlauf: boolean
          hochlauf_start: string | null
          id: string
          imap_host: string
          imap_port: number
          member_id: string | null
          mindestabstand_min: number
          naechster_versand_at: string | null
          rolle: string
          signatur: string | null
          smtp_host: string | null
          smtp_port: number | null
          smtp_sicherheit: string | null
          status: string
          status_at: string
          status_text: string | null
          tageslimit: number
          test_ergebnis: Json | null
          updated_at: string
        }
        Insert: {
          abruf_at?: string | null
          abruf_ok_at?: string | null
          abruf_stand?: Json
          absender_name: string
          adresse: string
          anbieter?: string
          benutzer: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          fehler_folge?: number
          geheimnis_id?: string | null
          gesperrt_bis?: string | null
          hochlauf?: boolean
          hochlauf_start?: string | null
          id?: string
          imap_host: string
          imap_port?: number
          member_id?: string | null
          mindestabstand_min?: number
          naechster_versand_at?: string | null
          rolle?: string
          signatur?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_sicherheit?: string | null
          status?: string
          status_at?: string
          status_text?: string | null
          tageslimit?: number
          test_ergebnis?: Json | null
          updated_at?: string
        }
        Update: {
          abruf_at?: string | null
          abruf_ok_at?: string | null
          abruf_stand?: Json
          absender_name?: string
          adresse?: string
          anbieter?: string
          benutzer?: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          fehler_folge?: number
          geheimnis_id?: string | null
          gesperrt_bis?: string | null
          hochlauf?: boolean
          hochlauf_start?: string | null
          id?: string
          imap_host?: string
          imap_port?: number
          member_id?: string | null
          mindestabstand_min?: number
          naechster_versand_at?: string | null
          rolle?: string
          signatur?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_sicherheit?: string | null
          status?: string
          status_at?: string
          status_text?: string | null
          tageslimit?: number
          test_ergebnis?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      mail_schritte: {
        Row: {
          created_at: string
          id: string
          im_thread: boolean
          kampagne_id: string
          position: number
          updated_at: string
          wartetage: number
        }
        Insert: {
          created_at?: string
          id?: string
          im_thread?: boolean
          kampagne_id: string
          position: number
          updated_at?: string
          wartetage?: number
        }
        Update: {
          created_at?: string
          id?: string
          im_thread?: boolean
          kampagne_id?: string
          position?: number
          updated_at?: string
          wartetage?: number
        }
        Relationships: [
          {
            foreignKeyName: 'mail_schritte_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_schritte_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'v_mail_kampagnen'
            referencedColumns: ['id']
          },
        ]
      }
      mail_sperrdomains: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          grund: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          grund?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          grund?: string | null
        }
        Relationships: []
      }
      mail_varianten: {
        Row: {
          aktiv: boolean
          betreff: string
          created_at: string
          id: string
          kennung: string
          schritt_id: string
          text: string
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          betreff?: string
          created_at?: string
          id?: string
          kennung: string
          schritt_id: string
          text?: string
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          betreff?: string
          created_at?: string
          id?: string
          kennung?: string
          schritt_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mail_varianten_schritt_id_fkey'
            columns: ['schritt_id']
            isOneToOne: false
            referencedRelation: 'mail_schritte'
            referencedColumns: ['id']
          },
        ]
      }
      meetings: {
        Row: {
          booked_at: string
          calendly_invitee_uri: string | null
          calendly_uri: string | null
          created_at: string
          duration_min: number
          id: string
          lead_id: string
          location: string | null
          member_id: string | null
          outcome_note: string | null
          rescheduled_from_id: string | null
          scheduled_at: string
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['meeting_status']
          type: Database['crm']['Enums']['meeting_type']
          updated_at: string
        }
        Insert: {
          booked_at?: string
          calendly_invitee_uri?: string | null
          calendly_uri?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          lead_id: string
          location?: string | null
          member_id?: string | null
          outcome_note?: string | null
          rescheduled_from_id?: string | null
          scheduled_at: string
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['meeting_status']
          type?: Database['crm']['Enums']['meeting_type']
          updated_at?: string
        }
        Update: {
          booked_at?: string
          calendly_invitee_uri?: string | null
          calendly_uri?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          lead_id?: string
          location?: string | null
          member_id?: string | null
          outcome_note?: string | null
          rescheduled_from_id?: string | null
          scheduled_at?: string
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['meeting_status']
          type?: Database['crm']['Enums']['meeting_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'meetings_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'meetings_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'meetings_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'meetings_rescheduled_from_id_fkey'
            columns: ['rescheduled_from_id']
            isOneToOne: false
            referencedRelation: 'meetings'
            referencedColumns: ['id']
          },
        ]
      }
      member_profiles: {
        Row: {
          calendly_url: string | null
          caller_number_e164: string | null
          created_at: string
          daily_target: number
          email_address: string | null
          linkedin_plan: Database['crm']['Enums']['linkedin_plan']
          linkedin_url: string | null
          member_id: string
          preferences: Json
          short_name: string | null
          signature: string | null
          updated_at: string
          weekly_budget: number
        }
        Insert: {
          calendly_url?: string | null
          caller_number_e164?: string | null
          created_at?: string
          daily_target?: number
          email_address?: string | null
          linkedin_plan?: Database['crm']['Enums']['linkedin_plan']
          linkedin_url?: string | null
          member_id: string
          preferences?: Json
          short_name?: string | null
          signature?: string | null
          updated_at?: string
          weekly_budget?: number
        }
        Update: {
          calendly_url?: string | null
          caller_number_e164?: string | null
          created_at?: string
          daily_target?: number
          email_address?: string | null
          linkedin_plan?: Database['crm']['Enums']['linkedin_plan']
          linkedin_url?: string | null
          member_id?: string
          preferences?: Json
          short_name?: string | null
          signature?: string | null
          updated_at?: string
          weekly_budget?: number
        }
        Relationships: [
          {
            foreignKeyName: 'member_profiles_member_id_fkey'
            columns: ['member_id']
            isOneToOne: true
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_contract_id_fkey'
            columns: ['contract_id']
            isOneToOne: false
            referencedRelation: 'contracts'
            referencedColumns: ['id']
          },
        ]
      }
      recherche_dienste: {
        Row: {
          anbieter: string
          claude: string | null
          claude_ersatz: boolean
          created_at: string
          id: string
          member_id: string
          rechner: string | null
          schluessel_hash: string
          version: string | null
          zuletzt_gesehen: string | null
        }
        Insert: {
          anbieter?: string
          claude?: string | null
          claude_ersatz?: boolean
          created_at?: string
          id?: string
          member_id?: string
          rechner?: string | null
          schluessel_hash: string
          version?: string | null
          zuletzt_gesehen?: string | null
        }
        Update: {
          anbieter?: string
          claude?: string | null
          claude_ersatz?: boolean
          created_at?: string
          id?: string
          member_id?: string
          rechner?: string | null
          schluessel_hash?: string
          version?: string | null
          zuletzt_gesehen?: string | null
        }
        Relationships: []
      }
      recherche_laeufe: {
        Row: {
          abgelehnt: number
          agent_anbieter: string
          agent_angefordert: string | null
          agent_antwort: string | null
          agent_auftrag: string | null
          agent_frage: string | null
          agent_heartbeat: string | null
          agent_meldung: string | null
          agent_rechner: string | null
          agent_sitzung: string | null
          agent_starts: number
          agent_status: string
          aktuelles_profil: string | null
          batch_id: string | null
          dubletten: number
          fehler: number
          finished_at: string | null
          geprueft: number
          gesendet: number
          id: string
          kontrollen: number
          meldung: string | null
          member_id: string
          qualifiziert: number
          started_at: string
          status: string
          unklar: number
          updated_at: string
          ziel: number
        }
        Insert: {
          abgelehnt?: number
          agent_anbieter?: string
          agent_angefordert?: string | null
          agent_antwort?: string | null
          agent_auftrag?: string | null
          agent_frage?: string | null
          agent_heartbeat?: string | null
          agent_meldung?: string | null
          agent_rechner?: string | null
          agent_sitzung?: string | null
          agent_starts?: number
          agent_status?: string
          aktuelles_profil?: string | null
          batch_id?: string | null
          dubletten?: number
          fehler?: number
          finished_at?: string | null
          geprueft?: number
          gesendet?: number
          id?: string
          kontrollen?: number
          meldung?: string | null
          member_id?: string
          qualifiziert?: number
          started_at?: string
          status?: string
          unklar?: number
          updated_at?: string
          ziel?: number
        }
        Update: {
          abgelehnt?: number
          agent_anbieter?: string
          agent_angefordert?: string | null
          agent_antwort?: string | null
          agent_auftrag?: string | null
          agent_frage?: string | null
          agent_heartbeat?: string | null
          agent_meldung?: string | null
          agent_rechner?: string | null
          agent_sitzung?: string | null
          agent_starts?: number
          agent_status?: string
          aktuelles_profil?: string | null
          batch_id?: string | null
          dubletten?: number
          fehler?: number
          finished_at?: string | null
          geprueft?: number
          gesendet?: number
          id?: string
          kontrollen?: number
          meldung?: string | null
          member_id?: string
          qualifiziert?: number
          started_at?: string
          status?: string
          unklar?: number
          updated_at?: string
          ziel?: number
        }
        Relationships: [
          {
            foreignKeyName: 'recherche_laeufe_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'import_batches'
            referencedColumns: ['id']
          },
        ]
      }
      recherche_profile: {
        Row: {
          ausgangspunkt: string | null
          created_at: string
          ergebnis: string
          firma: string | null
          firma_website: string | null
          grund: string | null
          id: string
          kategorie: string | null
          lauf_id: string
          lead_id: string | null
          linkedin_url: string
          linkedin_url_norm: string | null
          member_id: string
          nachname: string | null
          position: string | null
          vorname: string | null
        }
        Insert: {
          ausgangspunkt?: string | null
          created_at?: string
          ergebnis: string
          firma?: string | null
          firma_website?: string | null
          grund?: string | null
          id?: string
          kategorie?: string | null
          lauf_id: string
          lead_id?: string | null
          linkedin_url: string
          linkedin_url_norm?: string | null
          member_id?: string
          nachname?: string | null
          position?: string | null
          vorname?: string | null
        }
        Update: {
          ausgangspunkt?: string | null
          created_at?: string
          ergebnis?: string
          firma?: string | null
          firma_website?: string | null
          grund?: string | null
          id?: string
          kategorie?: string | null
          lauf_id?: string
          lead_id?: string | null
          linkedin_url?: string
          linkedin_url_norm?: string | null
          member_id?: string
          nachname?: string | null
          position?: string | null
          vorname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'recherche_profile_lauf_id_fkey'
            columns: ['lauf_id']
            isOneToOne: false
            referencedRelation: 'recherche_laeufe'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recherche_profile_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recherche_profile_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
        ]
      }
      saved_views: {
        Row: {
          columns: Json
          created_at: string
          entity: string
          filters: Json
          id: string
          is_default: boolean
          member_id: string | null
          name: string
          sort: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          entity: string
          filters?: Json
          id?: string
          is_default?: boolean
          member_id?: string | null
          name: string
          sort?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          entity?: string
          filters?: Json
          id?: string
          is_default?: boolean
          member_id?: string | null
          name?: string
          sort?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'saved_views_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      sequence_steps: {
        Row: {
          channel: Database['crm']['Enums']['channel'] | null
          created_at: string
          delay_days: number
          id: string
          instructions: string | null
          is_opener: boolean
          kind: Database['crm']['Enums']['step_kind']
          name: string
          position: number
          sequence_id: string
          sets_stage: Database['crm']['Enums']['lead_stage'] | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          channel?: Database['crm']['Enums']['channel'] | null
          created_at?: string
          delay_days?: number
          id?: string
          instructions?: string | null
          is_opener?: boolean
          kind?: Database['crm']['Enums']['step_kind']
          name: string
          position: number
          sequence_id: string
          sets_stage?: Database['crm']['Enums']['lead_stage'] | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database['crm']['Enums']['channel'] | null
          created_at?: string
          delay_days?: number
          id?: string
          instructions?: string | null
          is_opener?: boolean
          kind?: Database['crm']['Enums']['step_kind']
          name?: string
          position?: number
          sequence_id?: string
          sets_stage?: Database['crm']['Enums']['lead_stage'] | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sequence_steps_sequence_id_fkey'
            columns: ['sequence_id']
            isOneToOne: false
            referencedRelation: 'sequences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sequence_steps_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sequence_steps_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'v_template_performance'
            referencedColumns: ['template_id']
          },
        ]
      }
      sequences: {
        Row: {
          active: boolean
          channel: Database['crm']['Enums']['channel']
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          stop_on_meeting: boolean
          stop_on_reply: boolean
          trigger_kind: Database['crm']['Enums']['sequence_trigger']
          updated_at: string
          version: number
          weekdays_only: boolean
        }
        Insert: {
          active?: boolean
          channel: Database['crm']['Enums']['channel']
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          stop_on_meeting?: boolean
          stop_on_reply?: boolean
          trigger_kind?: Database['crm']['Enums']['sequence_trigger']
          updated_at?: string
          version?: number
          weekdays_only?: boolean
        }
        Update: {
          active?: boolean
          channel?: Database['crm']['Enums']['channel']
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          stop_on_meeting?: boolean
          stop_on_reply?: boolean
          trigger_kind?: Database['crm']['Enums']['sequence_trigger']
          updated_at?: string
          version?: number
          weekdays_only?: boolean
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      sperrliste: {
        Row: {
          channels: Database['crm']['Enums']['channel'][]
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          lead_id: string | null
          linkedin_url_norm: string | null
          name: string | null
          note: string | null
          phone_e164: string | null
          reason: string
        }
        Insert: {
          channels?: Database['crm']['Enums']['channel'][]
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          linkedin_url_norm?: string | null
          name?: string | null
          note?: string | null
          phone_e164?: string | null
          reason: string
        }
        Update: {
          channels?: Database['crm']['Enums']['channel'][]
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          linkedin_url_norm?: string | null
          name?: string | null
          note?: string | null
          phone_e164?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sperrliste_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sperrliste_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sperrliste_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          call_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_at: string
          id: string
          kind: Database['crm']['Enums']['task_kind']
          lead_id: string | null
          member_id: string | null
          note: string | null
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['task_status']
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_at: string
          id?: string
          kind?: Database['crm']['Enums']['task_kind']
          lead_id?: string | null
          member_id?: string | null
          note?: string | null
          snooze_count?: number
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['task_status']
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_at?: string
          id?: string
          kind?: Database['crm']['Enums']['task_kind']
          lead_id?: string | null
          member_id?: string | null
          note?: string | null
          snooze_count?: number
          source?: Database['crm']['Enums']['record_source']
          status?: Database['crm']['Enums']['task_status']
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_call_id_fkey'
            columns: ['call_id']
            isOneToOne: false
            referencedRelation: 'calls'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'tasks_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'v_template_performance'
            referencedColumns: ['template_id']
          },
        ]
      }
      templates: {
        Row: {
          active: boolean
          body: string
          channel: Database['crm']['Enums']['channel']
          created_at: string
          created_by: string | null
          form_of_address: Database['crm']['Enums']['form_of_address'] | null
          id: string
          key: string
          legacy_order: number | null
          legacy_phase: number | null
          name: string
          notes: string | null
          phase: Database['crm']['Enums']['template_phase']
          rating: number | null
          required_consent: Database['crm']['Enums']['email_consent_basis'][] | null
          sort_order: number
          subject: string | null
          updated_at: string
          variables: string[]
          variant_of: string | null
          when_to_use: string | null
        }
        Insert: {
          active?: boolean
          body?: string
          channel: Database['crm']['Enums']['channel']
          created_at?: string
          created_by?: string | null
          form_of_address?: Database['crm']['Enums']['form_of_address'] | null
          id?: string
          key: string
          legacy_order?: number | null
          legacy_phase?: number | null
          name: string
          notes?: string | null
          phase: Database['crm']['Enums']['template_phase']
          rating?: number | null
          required_consent?: Database['crm']['Enums']['email_consent_basis'][] | null
          sort_order?: number
          subject?: string | null
          updated_at?: string
          variables?: string[]
          variant_of?: string | null
          when_to_use?: string | null
        }
        Update: {
          active?: boolean
          body?: string
          channel?: Database['crm']['Enums']['channel']
          created_at?: string
          created_by?: string | null
          form_of_address?: Database['crm']['Enums']['form_of_address'] | null
          id?: string
          key?: string
          legacy_order?: number | null
          legacy_phase?: number | null
          name?: string
          notes?: string | null
          phase?: Database['crm']['Enums']['template_phase']
          rating?: number | null
          required_consent?: Database['crm']['Enums']['email_consent_basis'][] | null
          sort_order?: number
          subject?: string | null
          updated_at?: string
          variables?: string[]
          variant_of?: string | null
          when_to_use?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'templates_variant_of_fkey'
            columns: ['variant_of']
            isOneToOne: false
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'templates_variant_of_fkey'
            columns: ['variant_of']
            isOneToOne: false
            referencedRelation: 'v_template_performance'
            referencedColumns: ['template_id']
          },
        ]
      }
    }
    Views: {
      members: {
        Row: {
          calendly_url: string | null
          caller_number_e164: string | null
          created_at: string | null
          daily_target: number | null
          display_name: string | null
          email: string | null
          email_address: string | null
          id: string | null
          initial: string | null
          linkedin_plan: Database['crm']['Enums']['linkedin_plan'] | null
          linkedin_url: string | null
          preferences: Json | null
          short_name: string | null
          signature: string | null
          weekly_budget: number | null
        }
        Relationships: []
      }
      v_antwortzeit: {
        Row: {
          inbound_at: string | null
          lead_id: string | null
          member_id: string | null
          outbound_at: string | null
          werktage: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'activities_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'v_leads_ohne_bewegung'
            referencedColumns: ['lead_id']
          },
          {
            foreignKeyName: 'leads_owner_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      v_daily_activity: {
        Row: {
          anrufe: number | null
          anrufe_erreicht: number | null
          day: string | null
          dm_beantwortet: number | null
          emails_gesendet: number | null
          entscheider_gespraeche: number | null
          erstgespraech_gepitcht: number | null
          erstgespraeche: number | null
          gespraeche_eroeffnet: number | null
          member_id: string | null
          month_key: string | null
          strategiegespraeche: number | null
          termine_telefon: number | null
          vernetzungen_angenommen: number | null
          vernetzungen_versendet: number | null
          week_start: string | null
        }
        Relationships: []
      }
      v_funnel_monthly: {
        Row: {
          annahme_quote: number | null
          anrufe: number | null
          anrufe_erreicht: number | null
          antwort_quote: number | null
          ausstehend: number | null
          connect_rate: number | null
          dm_beantwortet: number | null
          emails_gesendet: number | null
          entscheider_gespraeche: number | null
          entscheider_quote: number | null
          erstgespraech_abgesagt: number | null
          erstgespraech_gepitcht: number | null
          erstgespraech_no_show: number | null
          erstgespraech_quote: number | null
          erstgespraeche: number | null
          erstgespraeche_vereinbart: number | null
          gespraeche_eroeffnet: number | null
          kunden_gewonnen: number | null
          kunden_quote: number | null
          member_id: string | null
          month: string | null
          month_key: string | null
          pitch_quote: number | null
          strategiegespraech_abgesagt: number | null
          strategiegespraech_no_show: number | null
          strategiegespraech_quote: number | null
          strategiegespraeche: number | null
          termine_pro_100_anrufe: number | null
          termine_telefon: number | null
          vernetzungen_angenommen: number | null
          vernetzungen_versendet: number | null
        }
        Relationships: []
      }
      v_leads_ohne_bewegung: {
        Row: {
          company_name: string | null
          full_name: string | null
          last_activity_at: string | null
          lead_id: string | null
          owner_id: string | null
          stage: Database['crm']['Enums']['lead_stage'] | null
          tage_ohne_bewegung: number | null
        }
        Insert: {
          company_name?: string | null
          full_name?: string | null
          last_activity_at?: string | null
          lead_id?: string | null
          owner_id?: string | null
          stage?: Database['crm']['Enums']['lead_stage'] | null
          tage_ohne_bewegung?: never
        }
        Update: {
          company_name?: string | null
          full_name?: string | null
          last_activity_at?: string | null
          lead_id?: string | null
          owner_id?: string | null
          stage?: Database['crm']['Enums']['lead_stage'] | null
          tage_ohne_bewegung?: never
        }
        Relationships: [
          {
            foreignKeyName: 'leads_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      v_mail_anbieter: {
        Row: {
          beantwortet: number | null
          bounces: number | null
          gesendet: number | null
          klasse: string | null
        }
        Relationships: []
      }
      v_mail_kampagnen: {
        Row: {
          abgemeldet: number | null
          abmelde_kopf: boolean | null
          abmelde_satz: boolean | null
          antworten: number | null
          beantwortet: number | null
          beendet_at: string | null
          bounce_schutz: boolean | null
          bounces: number | null
          created_at: string | null
          datenschutz_satz: boolean | null
          empfaenger: number | null
          fertig: number | null
          gesendet: number | null
          gestartet_at: string | null
          gestoppt: number | null
          heute: number | null
          id: string | null
          interessiert: number | null
          laufend: number | null
          member_id: string | null
          name: string | null
          neue_pro_tag: number | null
          notiz: string | null
          status: string | null
          status_text: string | null
          stopp_firma: boolean | null
          tageslimit: number | null
          updated_at: string | null
          wartend: number | null
          zeitplan: Json | null
        }
        Insert: {
          abgemeldet?: never
          abmelde_kopf?: boolean | null
          abmelde_satz?: boolean | null
          antworten?: never
          beantwortet?: never
          beendet_at?: string | null
          bounce_schutz?: boolean | null
          bounces?: never
          created_at?: string | null
          datenschutz_satz?: boolean | null
          empfaenger?: never
          fertig?: never
          gesendet?: never
          gestartet_at?: string | null
          gestoppt?: never
          heute?: never
          id?: string | null
          interessiert?: never
          laufend?: never
          member_id?: string | null
          name?: string | null
          neue_pro_tag?: number | null
          notiz?: string | null
          status?: string | null
          status_text?: string | null
          stopp_firma?: boolean | null
          tageslimit?: number | null
          updated_at?: string | null
          wartend?: never
          zeitplan?: Json | null
        }
        Update: {
          abgemeldet?: never
          abmelde_kopf?: boolean | null
          abmelde_satz?: boolean | null
          antworten?: never
          beantwortet?: never
          beendet_at?: string | null
          bounce_schutz?: boolean | null
          bounces?: never
          created_at?: string | null
          datenschutz_satz?: boolean | null
          empfaenger?: never
          fertig?: never
          gesendet?: never
          gestartet_at?: string | null
          gestoppt?: never
          heute?: never
          id?: string | null
          interessiert?: never
          laufend?: never
          member_id?: string | null
          name?: string | null
          neue_pro_tag?: number | null
          notiz?: string | null
          status?: string | null
          status_text?: string | null
          stopp_firma?: boolean | null
          tageslimit?: number | null
          updated_at?: string | null
          wartend?: never
          zeitplan?: Json | null
        }
        Relationships: []
      }
      v_mail_postfaecher: {
        Row: {
          abruf_ok_at: string | null
          absender_name: string | null
          adresse: string | null
          anbieter: string | null
          benutzer: string | null
          created_at: string | null
          domain: string | null
          gesperrt_bis: string | null
          hochlauf: boolean | null
          hochlauf_lage: Json | null
          hochlauf_start: string | null
          id: string | null
          imap_host: string | null
          member_id: string | null
          mindestabstand_min: number | null
          monat_antworten: number | null
          rolle: string | null
          signatur: string | null
          smtp_host: string | null
          status: string | null
          status_at: string | null
          status_text: string | null
          tageslimit: number | null
          test_ergebnis: Json | null
        }
        Insert: {
          abruf_ok_at?: string | null
          absender_name?: string | null
          adresse?: string | null
          anbieter?: string | null
          benutzer?: string | null
          created_at?: string | null
          domain?: string | null
          gesperrt_bis?: string | null
          hochlauf?: boolean | null
          hochlauf_lage?: never
          hochlauf_start?: string | null
          id?: string | null
          imap_host?: string | null
          member_id?: string | null
          mindestabstand_min?: number | null
          monat_antworten?: never
          rolle?: string | null
          signatur?: string | null
          smtp_host?: string | null
          status?: string | null
          status_at?: string | null
          status_text?: string | null
          tageslimit?: number | null
          test_ergebnis?: Json | null
        }
        Update: {
          abruf_ok_at?: string | null
          absender_name?: string | null
          adresse?: string | null
          anbieter?: string | null
          benutzer?: string | null
          created_at?: string | null
          domain?: string | null
          gesperrt_bis?: string | null
          hochlauf?: boolean | null
          hochlauf_lage?: never
          hochlauf_start?: string | null
          id?: string | null
          imap_host?: string | null
          member_id?: string | null
          mindestabstand_min?: number | null
          monat_antworten?: never
          rolle?: string | null
          signatur?: string | null
          smtp_host?: string | null
          status?: string | null
          status_at?: string | null
          status_text?: string | null
          tageslimit?: number | null
          test_ergebnis?: Json | null
        }
        Relationships: []
      }
      v_mail_tests: {
        Row: {
          betreff: string | null
          details: Json | null
          fehler: number | null
          fehlt: number | null
          gesamt: number | null
          gestartet_at: string | null
          offen: number | null
          posteingang: number | null
          spam: number | null
          test: string | null
          von_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'mail_platzierung_von_id_fkey'
            columns: ['von_id']
            isOneToOne: false
            referencedRelation: 'mail_postfaecher'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_platzierung_von_id_fkey'
            columns: ['von_id']
            isOneToOne: false
            referencedRelation: 'v_mail_postfaecher'
            referencedColumns: ['id']
          },
        ]
      }
      v_mail_varianten: {
        Row: {
          aktiv: boolean | null
          beantwortet: number | null
          bounces: number | null
          gesendet: number | null
          kampagne_id: string | null
          kennung: string | null
          position: number | null
          schritt_id: string | null
          variante_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'mail_schritte_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_schritte_kampagne_id_fkey'
            columns: ['kampagne_id']
            isOneToOne: false
            referencedRelation: 'v_mail_kampagnen'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mail_varianten_schritt_id_fkey'
            columns: ['schritt_id']
            isOneToOne: false
            referencedRelation: 'mail_schritte'
            referencedColumns: ['id']
          },
        ]
      }
      v_metric_events: {
        Row: {
          day: string | null
          member_id: string | null
          metric: Database['crm']['Enums']['metric'] | null
          period: Database['crm']['Enums']['counter_period'] | null
          source: string | null
          value: number | null
        }
        Relationships: []
      }
      v_pipeline_counts: {
        Row: {
          leads: number | null
          ohne_naechsten_schritt: number | null
          owner_id: string | null
          stage: Database['crm']['Enums']['lead_stage'] | null
          stage_rank: number | null
          tage_in_stufe: number | null
          ueberfaellig: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'leads_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      v_template_performance: {
        Row: {
          active: boolean | null
          antwort_quote: number | null
          beantwortet: number | null
          channel: Database['crm']['Enums']['channel'] | null
          gesendet: number | null
          key: string | null
          name: string | null
          phase: Database['crm']['Enums']['template_phase'] | null
          template_id: string | null
          termin_quote: number | null
          termine: number | null
          zuletzt_verwendet: string | null
        }
        Relationships: []
      }
      v_today_queue: {
        Row: {
          channel: Database['crm']['Enums']['channel'] | null
          company_name: string | null
          connection_id: string | null
          days_overdue: number | null
          do_not_contact: boolean | null
          due_at: string | null
          due_date: string | null
          email: string | null
          enrollment_id: string | null
          first_name: string | null
          follow_up_count: number | null
          item_id: string | null
          item_kind: string | null
          last_activity_at: string | null
          last_activity_type: Database['crm']['Enums']['activity_type'] | null
          last_name: string | null
          lead_created_at: string | null
          lead_id: string | null
          lead_name: string | null
          linkedin_url: string | null
          meeting_id: string | null
          member_id: string | null
          owner_id: string | null
          phone_e164: string | null
          priority: number | null
          rank_score: number | null
          salutation: Database['crm']['Enums']['salutation'] | null
          section: string | null
          section_order: number | null
          snooze_count: number | null
          stage: Database['crm']['Enums']['lead_stage'] | null
          stage_rank: number | null
          step_id: string | null
          subtitle: string | null
          task_id: string | null
          template_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'leads_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      advance_enrollment: {
        Args: {
          p_apply_stage?: boolean
          p_done_at?: string
          p_enrollment_id: string
        }
        Returns: {
          channel: Database['crm']['Enums']['channel']
          completed_at: string | null
          created_at: string
          current_position: number | null
          current_step_id: string | null
          id: string
          last_step_at: string | null
          lead_id: string
          member_id: string | null
          next_due_at: string | null
          note: string | null
          sequence_id: string
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          started_at: string
          status: Database['crm']['Enums']['enrollment_status']
          stopped_at: string | null
          stopped_reason: Database['crm']['Enums']['stop_reason'] | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'enrollments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      any_date: { Args: { p: string }; Returns: string }
      berlin_date: { Args: { p: string }; Returns: string }
      company_blocked: { Args: { p_lead_id: string }; Returns: boolean }
      company_norm: { Args: { p: string }; Returns: string }
      complete_step: {
        Args: {
          p_enrollment_id: string
          p_note?: string
          p_occurred_at?: string
          p_outcome?: Database['crm']['Enums']['step_outcome']
          p_template_id?: string
        }
        Returns: {
          channel: Database['crm']['Enums']['channel']
          completed_at: string | null
          created_at: string
          current_position: number | null
          current_step_id: string | null
          id: string
          last_step_at: string | null
          lead_id: string
          member_id: string | null
          next_due_at: string | null
          note: string | null
          sequence_id: string
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          started_at: string
          status: Database['crm']['Enums']['enrollment_status']
          stopped_at: string | null
          stopped_reason: Database['crm']['Enums']['stop_reason'] | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'enrollments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_task: {
        Args: { p_note?: string; p_task_id: string }
        Returns: {
          call_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_at: string
          id: string
          kind: Database['crm']['Enums']['task_kind']
          lead_id: string | null
          member_id: string | null
          note: string | null
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['task_status']
          template_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'tasks'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      due_on: { Args: { p: string }; Returns: string }
      eingang_aufraeumen: { Args: never; Returns: number }
      eingang_eigene_antwort: {
        Args: { p_bis?: string; p_lead_id: string; p_von: string }
        Returns: boolean
      }
      eingang_ignorieren: {
        Args: { p_id: string }
        Returns: {
          absender_name: string | null
          activity_id: number | null
          art: string
          created_at: string
          empfangen_at: string
          ergebnis: string | null
          external_id: string
          id: string
          lead_id: string | null
          linkedin_slug: string | null
          member_id: string
          quelle: string
          roh: Json
          status: string
          text: string | null
          verarbeitet_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'eingang'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      eingang_textgleich: {
        Args: { p_a: string; p_b: string }
        Returns: boolean
      }
      eingang_token_erzeugen: { Args: { p_label?: string }; Returns: string }
      eingang_token_widerrufen: { Args: never; Returns: number }
      eingang_verarbeiten: {
        Args: { p_id: string }
        Returns: {
          absender_name: string | null
          activity_id: number | null
          art: string
          created_at: string
          empfangen_at: string
          ergebnis: string | null
          external_id: string
          id: string
          lead_id: string | null
          linkedin_slug: string | null
          member_id: string
          quelle: string
          roh: Json
          status: string
          text: string | null
          verarbeitet_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'eingang'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      eingang_zuordnen: {
        Args: { p_id: string; p_lead_id: string }
        Returns: {
          absender_name: string | null
          activity_id: number | null
          art: string
          created_at: string
          empfangen_at: string
          ergebnis: string | null
          external_id: string
          id: string
          lead_id: string | null
          linkedin_slug: string | null
          member_id: string
          quelle: string
          roh: Json
          status: string
          text: string | null
          verarbeitet_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'eingang'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enroll: {
        Args: {
          p_first_due?: string
          p_lead_id: string
          p_member_id?: string
          p_note?: string
          p_sequence_key: string
          p_start_at?: string
          p_start_position?: number
        }
        Returns: string
      }
      export_backup: { Args: never; Returns: Json }
      has_kpi_sheet: {
        Args: { p_member: string; p_month: string }
        Returns: boolean
      }
      import_leads: {
        Args: {
          p_dry_run?: boolean
          p_label?: string
          p_owner?: string
          p_rows: Json
          p_source?: Database['crm']['Enums']['record_source']
        }
        Returns: Json
      }
      import_mode: { Args: never; Returns: boolean }
      import_sheet_kpis: { Args: { p_doc: Json }; Returns: Json }
      import_sheet_leads: {
        Args: { p_doc: Json; p_dry_run?: boolean }
        Returns: Json
      }
      import_templates: { Args: { p_rows: Json }; Returns: Json }
      is_blocked: {
        Args: { p_email: string; p_linkedin_norm: string; p_phone: string }
        Returns: boolean
      }
      is_holiday: { Args: { p: string }; Returns: boolean }
      ist_kontakt: {
        Args: { p_type: Database['crm']['Enums']['activity_type'] }
        Returns: boolean
      }
      lead_spiegel_berechnen: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      log_activity: {
        Args: {
          p_call_id?: string
          p_channel: Database['crm']['Enums']['channel']
          p_email_id?: string
          p_enrollment_id?: string
          p_kpi_relevant?: boolean
          p_lead_id: string
          p_meeting_id?: string
          p_member_id: string
          p_metadata?: Json
          p_note?: string
          p_occurred_at?: string
          p_outcome?: string
          p_reply_label?: Database['crm']['Enums']['reply_label']
          p_source?: Database['crm']['Enums']['record_source']
          p_step_id?: string
          p_task_id?: string
          p_template_id?: string
          p_type: Database['crm']['Enums']['activity_type']
        }
        Returns: number
      }
      log_call: {
        Args: {
          p_callback_at?: string
          p_direction?: Database['crm']['Enums']['call_direction']
          p_duration_sec?: number
          p_ended_at?: string
          p_ended_reason?: Database['crm']['Enums']['ended_reason']
          p_enrollment_id?: string
          p_from_number?: string
          p_lead_id: string
          p_meeting_at?: string
          p_note?: string
          p_outcome: Database['crm']['Enums']['call_outcome']
          p_reached_name?: string
          p_reached_person?: Database['crm']['Enums']['reached_person']
          p_started_at?: string
          p_task_id?: string
          p_template_id?: string
          p_to_number?: string
        }
        Returns: {
          answered_at: string | null
          attempt_no: number | null
          corrected: boolean
          created_at: string
          direction: Database['crm']['Enums']['call_direction']
          duration_sec: number | null
          ended_at: string | null
          enrollment_id: string | null
          external_call_id: string | null
          from_number: string | null
          id: string
          kpi_relevant: boolean
          lead_id: string
          member_id: string | null
          note: string | null
          outcome: Database['crm']['Enums']['call_outcome']
          provider: Database['crm']['Enums']['call_provider']
          raw_outcome: string | null
          reached_name: string | null
          reached_person: Database['crm']['Enums']['reached_person'] | null
          recording_url: string | null
          source: Database['crm']['Enums']['record_source']
          started_at: string
          talk_sec: number | null
          template_id: string | null
          to_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'calls'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_outbound: {
        Args: {
          p_channel?: Database['crm']['Enums']['channel']
          p_kind?: string
          p_lead_id: string
          p_note?: string
          p_occurred_at?: string
          p_template_id?: string
        }
        Returns: number
      }
      log_reply: {
        Args: {
          p_channel?: Database['crm']['Enums']['channel']
          p_label?: Database['crm']['Enums']['reply_label']
          p_lead_id: string
          p_note?: string
          p_occurred_at?: string
        }
        Returns: number
      }
      log_request: {
        Args: {
          p_date?: string
          p_lead_id: string
          p_member_id?: string
          p_note_variant?: Database['crm']['Enums']['note_variant']
        }
        Returns: {
          accepted_at: string | null
          created_at: string
          id: string
          kpi_relevant: boolean
          lead_id: string
          member_id: string
          note: string | null
          note_variant: Database['crm']['Enums']['note_variant']
          requested_at: string | null
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['connection_status']
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'linkedin_connections'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mail_abmelden: { Args: { p_token: string }; Returns: boolean }
      mail_antworten: {
        Args: { p_eingang: string; p_text: string }
        Returns: string
      }
      mail_empfaenger_hinzufuegen: {
        Args: { p_kampagne: string; p_leads: string[] }
        Returns: Json
      }
      mail_fuellen: {
        Args: {
          p_lead: string
          p_postfach: string
          p_text: string
          p_variablen: Json
        }
        Returns: string
      }
      mail_gate: { Args: { p_empfaenger: string }; Returns: string }
      mail_hochlauf: { Args: { p_postfach: string }; Returns: Json }
      mail_kampagne_pruefen: {
        Args: { p_kampagne: string }
        Returns: {
          empfaenger_id: string
          grund: string
        }[]
      }
      mail_kampagne_speichern: { Args: { p: Json }; Returns: string }
      mail_kampagne_status: {
        Args: { p_kampagne: string; p_status: string }
        Returns: {
          abmelde_kopf: boolean
          abmelde_satz: boolean
          beendet_at: string | null
          bounce_schutz: boolean
          created_at: string
          datenschutz_satz: boolean
          gestartet_at: string | null
          id: string
          member_id: string
          name: string
          neue_pro_tag: number
          notiz: string | null
          status: string
          status_text: string | null
          stopp_firma: boolean
          tageslimit: number
          updated_at: string
          zeitplan: Json
        }
        SetofOptions: {
          from: '*'
          to: 'mail_kampagnen'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mail_motor_abruf_fehler: {
        Args: { p_anmeldung?: boolean; p_fehler: string; p_postfach: string }
        Returns: undefined
      }
      mail_motor_abruf_liste: { Args: { p_max?: number }; Returns: Json }
      mail_motor_auftraege: { Args: { p_max?: number }; Returns: Json }
      mail_motor_eingang: {
        Args: { p_posten: Json; p_postfach: string; p_stand: Json }
        Returns: Json
      }
      mail_motor_ergebnis: {
        Args: {
          p_art: string
          p_fehler?: string
          p_fehlerart?: string
          p_id: string
          p_ok: boolean
        }
        Returns: undefined
      }
      mail_motor_mx_offen: { Args: { p_max?: number }; Returns: string[] }
      mail_motor_mx_setzen: { Args: { p_eintraege: Json }; Returns: undefined }
      mail_motor_platzierung_melden: {
        Args: { p_funde: Json; p_postfach: string }
        Returns: undefined
      }
      mail_motor_platzierung_offen: {
        Args: { p_postfach: string }
        Returns: string[]
      }
      mail_motor_schluessel: { Args: never; Returns: string }
      mail_motor_test_ergebnis: {
        Args: { p_ergebnis: Json; p_postfach: string }
        Returns: {
          abruf_at: string | null
          abruf_ok_at: string | null
          abruf_stand: Json
          absender_name: string
          adresse: string
          anbieter: string
          benutzer: string
          created_at: string
          created_by: string | null
          domain: string | null
          fehler_folge: number
          geheimnis_id: string | null
          gesperrt_bis: string | null
          hochlauf: boolean
          hochlauf_start: string | null
          id: string
          imap_host: string
          imap_port: number
          member_id: string | null
          mindestabstand_min: number
          naechster_versand_at: string | null
          rolle: string
          signatur: string | null
          smtp_host: string | null
          smtp_port: number | null
          smtp_sicherheit: string | null
          status: string
          status_at: string
          status_text: string | null
          tageslimit: number
          test_ergebnis: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'mail_postfaecher'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mail_motor_zugang: { Args: { p_postfach: string }; Returns: Json }
      mail_platzierung_starten: {
        Args: { p_betreff: string; p_postfach: string; p_text: string }
        Returns: string
      }
      mail_postfach_speichern: {
        Args: { p: Json; p_passwort?: string }
        Returns: {
          abruf_at: string | null
          abruf_ok_at: string | null
          abruf_stand: Json
          absender_name: string
          adresse: string
          anbieter: string
          benutzer: string
          created_at: string
          created_by: string | null
          domain: string | null
          fehler_folge: number
          geheimnis_id: string | null
          gesperrt_bis: string | null
          hochlauf: boolean
          hochlauf_start: string | null
          id: string
          imap_host: string
          imap_port: number
          member_id: string | null
          mindestabstand_min: number
          naechster_versand_at: string | null
          rolle: string
          signatur: string | null
          smtp_host: string | null
          smtp_port: number | null
          smtp_sicherheit: string | null
          status: string
          status_at: string
          status_text: string | null
          tageslimit: number
          test_ergebnis: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'mail_postfaecher'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_accepted: {
        Args: { p_date?: string; p_lead_id: string; p_member_id?: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          id: string
          kpi_relevant: boolean
          lead_id: string
          member_id: string
          note: string | null
          note_variant: Database['crm']['Enums']['note_variant']
          requested_at: string | null
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['connection_status']
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'linkedin_connections'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      meeting_rang: {
        Args: { p_type: Database['crm']['Enums']['meeting_type'] }
        Returns: number
      }
      member_id_by_name: { Args: { p_name: string }; Returns: string }
      next_due: {
        Args: {
          p_delay_days: number
          p_from: string
          p_weekdays_only?: boolean
        }
        Returns: string
      }
      normalize_linkedin_url: { Args: { p: string }; Returns: string }
      normalize_phone: { Args: { p: string }; Returns: string }
      parse_legacy_note: { Args: { p: string }; Returns: Json }
      ping: { Args: never; Returns: string }
      raise_stage: {
        Args: {
          p_lead_id: string
          p_member_id?: string
          p_stage: Database['crm']['Enums']['lead_stage']
        }
        Returns: undefined
      }
      recherche_agent_antworten: {
        Args: { p_freigabe: boolean; p_lauf: string; p_text?: string }
        Returns: {
          abgelehnt: number
          agent_anbieter: string
          agent_angefordert: string | null
          agent_antwort: string | null
          agent_auftrag: string | null
          agent_frage: string | null
          agent_heartbeat: string | null
          agent_meldung: string | null
          agent_rechner: string | null
          agent_sitzung: string | null
          agent_starts: number
          agent_status: string
          aktuelles_profil: string | null
          batch_id: string | null
          dubletten: number
          fehler: number
          finished_at: string | null
          geprueft: number
          gesendet: number
          id: string
          kontrollen: number
          meldung: string | null
          member_id: string
          qualifiziert: number
          started_at: string
          status: string
          unklar: number
          updated_at: string
          ziel: number
        }
        SetofOptions: {
          from: '*'
          to: 'recherche_laeufe'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recherche_agent_starten: {
        Args: { p_auftrag?: string; p_lauf: string }
        Returns: {
          abgelehnt: number
          agent_anbieter: string
          agent_angefordert: string | null
          agent_antwort: string | null
          agent_auftrag: string | null
          agent_frage: string | null
          agent_heartbeat: string | null
          agent_meldung: string | null
          agent_rechner: string | null
          agent_sitzung: string | null
          agent_starts: number
          agent_status: string
          aktuelles_profil: string | null
          batch_id: string | null
          dubletten: number
          fehler: number
          finished_at: string | null
          geprueft: number
          gesendet: number
          id: string
          kontrollen: number
          meldung: string | null
          member_id: string
          qualifiziert: number
          started_at: string
          status: string
          unklar: number
          updated_at: string
          ziel: number
        }
        SetofOptions: {
          from: '*'
          to: 'recherche_laeufe'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recherche_anbieter_waehlen: { Args: { p_anbieter: string }; Returns: string }
      recherche_claude_ersatz: { Args: { p_an: boolean }; Returns: undefined }
      recherche_dienst: {
        Args: { p_aktion: string; p_daten?: Json; p_schluessel: string }
        Returns: Json
      }
      recherche_dienst_einrichten: { Args: never; Returns: string }
      recherche_eintragen: {
        Args: {
          p_ausgangspunkt?: string
          p_ergebnis: string
          p_firma?: string
          p_firma_website?: string
          p_grund?: string
          p_kategorie?: string
          p_lauf: string
          p_nachname?: string
          p_position?: string
          p_url: string
          p_vorname?: string
        }
        Returns: {
          abgelehnt: number
          agent_anbieter: string
          agent_angefordert: string | null
          agent_antwort: string | null
          agent_auftrag: string | null
          agent_frage: string | null
          agent_heartbeat: string | null
          agent_meldung: string | null
          agent_rechner: string | null
          agent_sitzung: string | null
          agent_starts: number
          agent_status: string
          aktuelles_profil: string | null
          batch_id: string | null
          dubletten: number
          fehler: number
          finished_at: string | null
          geprueft: number
          gesendet: number
          id: string
          kontrollen: number
          meldung: string | null
          member_id: string
          qualifiziert: number
          started_at: string
          status: string
          unklar: number
          updated_at: string
          ziel: number
        }
        SetofOptions: {
          from: '*'
          to: 'recherche_laeufe'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recherche_kontrolle: {
        Args: { p_lauf: string }
        Returns: {
          abgelehnt: number
          agent_anbieter: string
          agent_angefordert: string | null
          agent_antwort: string | null
          agent_auftrag: string | null
          agent_frage: string | null
          agent_heartbeat: string | null
          agent_meldung: string | null
          agent_rechner: string | null
          agent_sitzung: string | null
          agent_starts: number
          agent_status: string
          aktuelles_profil: string | null
          batch_id: string | null
          dubletten: number
          fehler: number
          finished_at: string | null
          geprueft: number
          gesendet: number
          id: string
          kontrollen: number
          meldung: string | null
          member_id: string
          qualifiziert: number
          started_at: string
          status: string
          unklar: number
          updated_at: string
          ziel: number
        }
        SetofOptions: {
          from: '*'
          to: 'recherche_laeufe'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recherche_pruefen: {
        Args: {
          p_firma?: string
          p_lauf: string
          p_nachname?: string
          p_url: string
          p_vorname?: string
        }
        Returns: Json
      }
      recherche_rolle: {
        Args: { p_position: string }
        Returns: Database['crm']['Enums']['lead_role']
      }
      recherche_starten: {
        Args: { p_auftrag?: string; p_ziel?: number }
        Returns: {
          abgelehnt: number
          agent_anbieter: string
          agent_angefordert: string | null
          agent_antwort: string | null
          agent_auftrag: string | null
          agent_frage: string | null
          agent_heartbeat: string | null
          agent_meldung: string | null
          agent_rechner: string | null
          agent_sitzung: string | null
          agent_starts: number
          agent_status: string
          aktuelles_profil: string | null
          batch_id: string | null
          dubletten: number
          fehler: number
          finished_at: string | null
          geprueft: number
          gesendet: number
          id: string
          kontrollen: number
          meldung: string | null
          member_id: string
          qualifiziert: number
          started_at: string
          status: string
          unklar: number
          updated_at: string
          ziel: number
        }
        SetofOptions: {
          from: '*'
          to: 'recherche_laeufe'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recherche_status: {
        Args: { p_lauf: string; p_meldung?: string; p_status: string }
        Returns: {
          abgelehnt: number
          agent_anbieter: string
          agent_angefordert: string | null
          agent_antwort: string | null
          agent_auftrag: string | null
          agent_frage: string | null
          agent_heartbeat: string | null
          agent_meldung: string | null
          agent_rechner: string | null
          agent_sitzung: string | null
          agent_starts: number
          agent_status: string
          aktuelles_profil: string | null
          batch_id: string | null
          dubletten: number
          fehler: number
          finished_at: string | null
          geprueft: number
          gesendet: number
          id: string
          kontrollen: number
          meldung: string | null
          member_id: string
          qualifiziert: number
          started_at: string
          status: string
          unklar: number
          updated_at: string
          ziel: number
        }
        SetofOptions: {
          from: '*'
          to: 'recherche_laeufe'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_lead_next_action: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      record_source_now: {
        Args: never
        Returns: Database['crm']['Enums']['record_source']
      }
      release_lead: {
        Args: { p_lead_id: string; p_reason: string }
        Returns: {
          call_basis: Database['crm']['Enums']['call_basis'] | null
          call_basis_note: string | null
          call_basis_url: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          custom: Json
          deleted_at: string | null
          do_not_contact: boolean
          do_not_contact_channels: Database['crm']['Enums']['channel'][] | null
          email: string | null
          email_consent_at: string | null
          email_consent_basis: Database['crm']['Enums']['email_consent_basis']
          email_consent_note: string | null
          email_consent_ref: Json | null
          ended_at: string | null
          ended_note: string | null
          ended_reason: Database['crm']['Enums']['ended_reason'] | null
          first_name: string | null
          follow_up_count: number
          full_name: string | null
          id: string
          inbound_unanswered_since: string | null
          last_activity_at: string | null
          last_activity_type: Database['crm']['Enums']['activity_type'] | null
          last_inbound_at: string | null
          last_inbound_channel: Database['crm']['Enums']['channel'] | null
          last_name: string | null
          last_outbound_at: string | null
          legacy_id: number | null
          legacy_system_id: string | null
          legacy_system_id_2: string | null
          linkedin_url: string | null
          linkedin_url_norm: string | null
          next_action_at: string | null
          next_action_kind: Database['crm']['Enums']['next_action_kind'] | null
          next_action_label: string | null
          next_action_ref: string | null
          notes: string | null
          objection_at: string | null
          objection_note: string | null
          opened_by_id: string | null
          owner_id: string | null
          phone_collected_at: string | null
          phone_e164: string | null
          phone_numbers: Json
          phone_source: Database['crm']['Enums']['phone_source']
          phone_source_url: string | null
          phone_type: Database['crm']['Enums']['phone_type']
          priority: number
          privacy_notice_sent_at: string | null
          privacy_notice_version: string | null
          qualification: Json
          released: boolean
          released_at: string | null
          released_reason: string | null
          role: Database['crm']['Enums']['lead_role']
          role_title: string | null
          sales_nav_url: string | null
          sales_owner_id: string | null
          salutation: Database['crm']['Enums']['salutation']
          search: unknown
          source: Database['crm']['Enums']['record_source']
          source_batch_id: string | null
          stage: Database['crm']['Enums']['lead_stage']
          stage_changed_at: string
          title: string | null
          updated_at: string
          url_verified: boolean
          website: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'leads'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      roll_to_weekday: { Args: { p: string }; Returns: string }
      set_counter: {
        Args: {
          p_date?: string
          p_delta?: boolean
          p_member_id?: string
          p_metric: Database['crm']['Enums']['metric']
          p_value: number
        }
        Returns: {
          date: string
          member_id: string
          metric: Database['crm']['Enums']['metric']
          note: string | null
          period: Database['crm']['Enums']['counter_period']
          source: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        SetofOptions: {
          from: '*'
          to: 'daily_counters'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_reply_label: {
        Args: {
          p_activity_id: number
          p_label: Database['crm']['Enums']['reply_label']
          p_note?: string
        }
        Returns: number
      }
      set_stage: {
        Args: {
          p_ended_reason?: Database['crm']['Enums']['ended_reason']
          p_lead_id: string
          p_member_id?: string
          p_note?: string
          p_stage: Database['crm']['Enums']['lead_stage']
        }
        Returns: undefined
      }
      set_wiedervorlage: {
        Args: {
          p_due: string
          p_lead_id: string
          p_note?: string
          p_template_id?: string
        }
        Returns: {
          call_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_at: string
          id: string
          kind: Database['crm']['Enums']['task_kind']
          lead_id: string | null
          member_id: string | null
          note: string | null
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['task_status']
          template_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'tasks'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      setting: { Args: { p_key: string; p_path?: string }; Returns: Json }
      snooze_step: {
        Args: {
          p_days?: number
          p_enrollment_id: string
          p_note?: string
          p_until?: string
        }
        Returns: {
          channel: Database['crm']['Enums']['channel']
          completed_at: string | null
          created_at: string
          current_position: number | null
          current_step_id: string | null
          id: string
          last_step_at: string | null
          lead_id: string
          member_id: string | null
          next_due_at: string | null
          note: string | null
          sequence_id: string
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          started_at: string
          status: Database['crm']['Enums']['enrollment_status']
          stopped_at: string | null
          stopped_reason: Database['crm']['Enums']['stop_reason'] | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'enrollments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      snooze_task: {
        Args: { p_days?: number; p_task_id: string; p_until?: string }
        Returns: {
          call_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_at: string
          id: string
          kind: Database['crm']['Enums']['task_kind']
          lead_id: string | null
          member_id: string | null
          note: string | null
          snooze_count: number
          source: Database['crm']['Enums']['record_source']
          status: Database['crm']['Enums']['task_status']
          template_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'tasks'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      split_person_name: {
        Args: { p: string }
        Returns: Record<string, unknown>
      }
      stage_rank: {
        Args: { p: Database['crm']['Enums']['lead_stage'] }
        Returns: number
      }
      stop_enrollments: {
        Args: {
          p_channel?: Database['crm']['Enums']['channel']
          p_lead_id: string
          p_note?: string
          p_reason: Database['crm']['Enums']['stop_reason']
        }
        Returns: number
      }
      today: { Args: never; Returns: string }
      transfer_lead: {
        Args: { p_lead_id: string; p_note: string; p_to_member: string }
        Returns: {
          call_basis: Database['crm']['Enums']['call_basis'] | null
          call_basis_note: string | null
          call_basis_url: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          custom: Json
          deleted_at: string | null
          do_not_contact: boolean
          do_not_contact_channels: Database['crm']['Enums']['channel'][] | null
          email: string | null
          email_consent_at: string | null
          email_consent_basis: Database['crm']['Enums']['email_consent_basis']
          email_consent_note: string | null
          email_consent_ref: Json | null
          ended_at: string | null
          ended_note: string | null
          ended_reason: Database['crm']['Enums']['ended_reason'] | null
          first_name: string | null
          follow_up_count: number
          full_name: string | null
          id: string
          inbound_unanswered_since: string | null
          last_activity_at: string | null
          last_activity_type: Database['crm']['Enums']['activity_type'] | null
          last_inbound_at: string | null
          last_inbound_channel: Database['crm']['Enums']['channel'] | null
          last_name: string | null
          last_outbound_at: string | null
          legacy_id: number | null
          legacy_system_id: string | null
          legacy_system_id_2: string | null
          linkedin_url: string | null
          linkedin_url_norm: string | null
          next_action_at: string | null
          next_action_kind: Database['crm']['Enums']['next_action_kind'] | null
          next_action_label: string | null
          next_action_ref: string | null
          notes: string | null
          objection_at: string | null
          objection_note: string | null
          opened_by_id: string | null
          owner_id: string | null
          phone_collected_at: string | null
          phone_e164: string | null
          phone_numbers: Json
          phone_source: Database['crm']['Enums']['phone_source']
          phone_source_url: string | null
          phone_type: Database['crm']['Enums']['phone_type']
          priority: number
          privacy_notice_sent_at: string | null
          privacy_notice_version: string | null
          qualification: Json
          released: boolean
          released_at: string | null
          released_reason: string | null
          role: Database['crm']['Enums']['lead_role']
          role_title: string | null
          sales_nav_url: string | null
          sales_owner_id: string | null
          salutation: Database['crm']['Enums']['salutation']
          search: unknown
          source: Database['crm']['Enums']['record_source']
          source_batch_id: string | null
          stage: Database['crm']['Enums']['lead_stage']
          stage_changed_at: string
          title: string | null
          updated_at: string
          url_verified: boolean
          website: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'leads'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      undo_activity: { Args: { p_activity_id: number }; Returns: Json }
      undo_import: { Args: { p_batch_id: string }; Returns: Json }
      undo_mode: { Args: never; Returns: boolean }
      url_decode: { Args: { p: string }; Returns: string }
    }
    Enums: {
      activity_type:
        | 'angelegt'
        | 'import'
        | 'vernetzung_gesendet'
        | 'vernetzung_angenommen'
        | 'vernetzung_zurueckgezogen'
        | 'vernetzung_abgelaufen'
        | 'gespraech_eroeffnet'
        | 'nachricht_gesendet'
        | 'nachricht_erhalten'
        | 'pitch_gesendet'
        | 'anruf'
        | 'email_gesendet'
        | 'email_erhalten'
        | 'meeting_geplant'
        | 'meeting_stattgefunden'
        | 'meeting_no_show'
        | 'meeting_abgesagt'
        | 'meeting_verschoben'
        | 'notiz'
        | 'stage_wechsel'
        | 'uebergabe'
        | 'freigabe'
        | 'sequenz_gestartet'
        | 'sequenz_gestoppt'
        | 'sequenz_abgeschlossen'
        | 'sequenz_pausiert'
        | 'schritt_uebersprungen'
        | 'schritt_verschoben'
        | 'aufgabe_erledigt'
        | 'einwilligung'
        | 'widerspruch'
      call_basis:
        | 'linkedin_vernetzt_antwort'
        | 'linkedin_vernetzt'
        | 'email_antwort'
        | 'website_anfrage'
        | 'messe_event'
        | 'empfehlung'
        | 'bestandskontakt'
        | 'stellenanzeige_innendienst'
        | 'oeffentliche_aussage'
        | 'sonstiger_konkreter_anlass'
      call_direction: 'out' | 'in'
      call_outcome:
        | 'no_answer'
        | 'busy'
        | 'voicemail'
        | 'voicemail_left'
        | 'wrong_number'
        | 'gatekeeper'
        | 'gatekeeper_blocked'
        | 'callback_scheduled'
        | 'dm_interest'
        | 'meeting_booked'
        | 'send_info'
        | 'not_now'
        | 'not_interested'
        | 'not_icp'
        | 'do_not_call'
      call_provider: 'manual' | 'placetel' | 'sipgate' | 'aircall'
      channel: 'linkedin' | 'telefon' | 'email' | 'sonstiges'
      connection_status: 'ausstehend' | 'angenommen' | 'zurueckgezogen' | 'abgelaufen'
      counter_period: 'tag' | 'monat'
      email_channel: 'gmail_compose' | 'gmail_api' | 'brevo' | 'mailto' | 'manual' | 'smtp'
      email_consent_basis:
        | 'none'
        | 'requested_linkedin'
        | 'requested_phone'
        | 'requested_email'
        | 'meeting_held'
        | 'double_opt_in'
        | 'existing_customer'
        | 'revoked'
      email_direction: 'out' | 'in'
      email_status:
        | 'draft'
        | 'opened_in_client'
        | 'sent_confirmed'
        | 'sent'
        | 'delivered'
        | 'bounced'
        | 'replied'
        | 'failed'
        | 'received'
      ended_reason:
        | 'kein_bedarf'
        | 'nicht_icp'
        | 'nicht_qualifiziert'
        | 'kein_interesse'
        | 'falsche_nummer'
        | 'duplikat'
        | 'widerspruch'
        | 'sonstiges'
      enrollment_status: 'aktiv' | 'pausiert' | 'abgeschlossen' | 'gestoppt'
      form_of_address: 'sie' | 'du'
      lead_role:
        | 'geschaeftsfuehrer'
        | 'inhaber'
        | 'kundenbetreuer'
        | 'innendienst'
        | 'vertrieb'
        | 'projektleiter'
        | 'sonstiges'
        | 'unbekannt'
      lead_stage:
        | 'neu'
        | 'vernetzung_gesendet'
        | 'vernetzt'
        | 'gespraech_eroeffnet'
        | 'dm_follow_up'
        | 'dm_beantwortet'
        | 'bedarfsermittlung'
        | 'pitch'
        | 'erstgespraech_vereinbart'
        | 'erstgespraech'
        | 'strategiegespraech_vereinbart'
        | 'strategiegespraech'
        | 'sales_follow_up'
        | 'kunde'
        | 'langfristig'
        | 'beendet'
      linkedin_plan: 'basic' | 'premium' | 'sales_navigator'
      meeting_status: 'geplant' | 'stattgefunden' | 'no_show' | 'abgesagt' | 'verschoben'
      meeting_type: 'erstgespraech' | 'strategiegespraech' | 'folgegespraech'
      metric:
        | 'vernetzungen_versendet'
        | 'vernetzungen_angenommen'
        | 'ausstehend'
        | 'gespraeche_eroeffnet'
        | 'dm_beantwortet'
        | 'erstgespraech_gepitcht'
        | 'erstgespraeche_vereinbart'
        | 'erstgespraeche'
        | 'strategiegespraeche'
        | 'kunden_gewonnen'
        | 'erstgespraech_no_show'
        | 'erstgespraech_abgesagt'
        | 'strategiegespraech_no_show'
        | 'strategiegespraech_abgesagt'
        | 'anrufe'
        | 'anrufe_erreicht'
        | 'entscheider_gespraeche'
        | 'termine_telefon'
        | 'emails_gesendet'
        | 'strategiegespraeche_vereinbart'
      next_action_kind: 'sequenz_schritt' | 'rueckruf' | 'wiedervorlage' | 'aufgabe' | 'meeting' | 'antworten'
      note_variant: 'ohne' | 'note_v1' | 'note_v2'
      phone_source:
        | 'website_kontakt'
        | 'google_profil'
        | 'branchenverzeichnis'
        | 'linkedin'
        | 'visitenkarte'
        | 'mitgeteilt'
        | 'impressum'
        | 'unbekannt'
      phone_type: 'zentrale' | 'durchwahl' | 'mobil' | 'unbekannt'
      reached_person: 'niemand' | 'zentrale' | 'assistenz' | 'entscheider' | 'sonstige'
      record_source:
        | 'app'
        | 'import_sheet'
        | 'import_csv'
        | 'schnellimport'
        | 'linkedin_export'
        | 'telefonie'
        | 'email_sync'
        | 'recherche'
      reply_label:
        | 'interessiert'
        | 'frage'
        | 'kein_bedarf'
        | 'spaeter'
        | 'nicht_icp'
        | 'hat_partner'
        | 'falsches_problem'
        | 'widerspruch'
        | 'sonstiges'
      salutation: 'herr' | 'frau' | 'neutral'
      sequence_trigger:
        | 'manuell'
        | 'vernetzung_angenommen'
        | 'vernetzung_mit_notiz_angenommen'
        | 'antwort_gesendet'
        | 'erstgespraech_stattgefunden'
        | 'telefon_nicht_erreicht'
        | 'info_zugesagt_linkedin'
        | 'info_zugesagt_telefon'
      step_kind: 'nachricht' | 'anruf' | 'email' | 'aufgabe'
      step_outcome: 'gesendet' | 'uebersprungen' | 'antwort_erhalten' | 'abgebrochen'
      stop_reason:
        | 'antwort_erhalten'
        | 'meeting_gebucht'
        | 'lead_beendet'
        | 'verbindung_entfernt'
        | 'widerspruch'
        | 'manuell'
        | 'ersetzt'
        | 'uebergabe'
      task_kind: 'rueckruf' | 'wiedervorlage' | 'aufgabe'
      task_status: 'offen' | 'erledigt' | 'abgebrochen'
      template_phase:
        | 'vernetzung'
        | 'eroeffnung'
        | 'bedarfsermittlung'
        | 'pitch'
        | 'follow_up'
        | 'langfristig'
        | 'gatekeeper'
        | 'einstieg'
        | 'problem'
        | 'qualifizierung'
        | 'einwand'
        | 'abschluss'
        | 'mailbox'
        | 'rueckruf'
        | 'datenschutz'
        | 'zusammenfassung'
        | 'nachfassen'
        | 'infomail'
        | 'transaktional'
        | 'erstgespraech'
        | 'strategiegespraech'
        | 'einwandbehandlung'
        | 'angebot'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          color_light: string
          for_documents: boolean
          icon: string | null
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          color: string
          color_light: string
          for_documents?: boolean
          icon?: string | null
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string
          color_light?: string
          for_documents?: boolean
          icon?: string | null
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      cost_entries: {
        Row: {
          amount: number
          category: string
          cost_interval: string
          created_at: string
          created_by: string | null
          currency: string
          document_id: string | null
          end_date: string | null
          id: string
          label: string
          next_due: string | null
          notes: string | null
          start_date: string | null
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          cost_interval: string
          created_at?: string
          created_by?: string | null
          currency?: string
          document_id?: string | null
          end_date?: string | null
          id?: string
          label: string
          next_due?: string | null
          notes?: string | null
          start_date?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          cost_interval?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          document_id?: string | null
          end_date?: string | null
          id?: string
          label?: string
          next_due?: string | null
          notes?: string | null
          start_date?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cost_entries_category_fkey'
            columns: ['category']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['slug']
          },
          {
            foreignKeyName: 'cost_entries_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
        ]
      }
      document_chunks: {
        Row: {
          content: string
          document_id: string
          id: number
          position: number
          search: unknown
        }
        Insert: {
          content: string
          document_id: string
          id?: never
          position: number
          search?: unknown
        }
        Update: {
          content?: string
          document_id?: string
          id?: never
          position?: number
          search?: unknown
        }
        Relationships: [
          {
            foreignKeyName: 'document_chunks_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
        ]
      }
      documents: {
        Row: {
          ai_confidence: number | null
          ai_model: string | null
          amount: number | null
          billing_day: number | null
          category: string
          cost_interval: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          document_date: string | null
          due_date: string | null
          end_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          flagged: boolean
          fulltext: string | null
          id: string
          notes: string | null
          owner: string
          reference: string | null
          search: unknown
          sender: string | null
          status: string
          subcategory: string | null
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_model?: string | null
          amount?: number | null
          billing_day?: number | null
          category: string
          cost_interval?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document_date?: string | null
          due_date?: string | null
          end_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          flagged?: boolean
          fulltext?: string | null
          id?: string
          notes?: string | null
          owner?: string
          reference?: string | null
          search?: unknown
          sender?: string | null
          status?: string
          subcategory?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_model?: string | null
          amount?: number | null
          billing_day?: number | null
          category?: string
          cost_interval?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          document_date?: string | null
          due_date?: string | null
          end_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          flagged?: boolean
          fulltext?: string | null
          id?: string
          notes?: string | null
          owner?: string
          reference?: string | null
          search?: unknown
          sender?: string | null
          status?: string
          subcategory?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_category_fkey'
            columns: ['category']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['slug']
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          display_name: string
          email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          user_id?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category: string
          id: number
          label: string
          sort_order: number
        }
        Insert: {
          category: string
          id?: never
          label: string
          sort_order?: number
        }
        Update: {
          category?: string
          id?: never
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'subcategories_category_fkey'
            columns: ['category']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['slug']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  crm: {
    Enums: {
      activity_type: [
        'angelegt',
        'import',
        'vernetzung_gesendet',
        'vernetzung_angenommen',
        'vernetzung_zurueckgezogen',
        'vernetzung_abgelaufen',
        'gespraech_eroeffnet',
        'nachricht_gesendet',
        'nachricht_erhalten',
        'pitch_gesendet',
        'anruf',
        'email_gesendet',
        'email_erhalten',
        'meeting_geplant',
        'meeting_stattgefunden',
        'meeting_no_show',
        'meeting_abgesagt',
        'meeting_verschoben',
        'notiz',
        'stage_wechsel',
        'uebergabe',
        'freigabe',
        'sequenz_gestartet',
        'sequenz_gestoppt',
        'sequenz_abgeschlossen',
        'sequenz_pausiert',
        'schritt_uebersprungen',
        'schritt_verschoben',
        'aufgabe_erledigt',
        'einwilligung',
        'widerspruch',
      ],
      call_basis: [
        'linkedin_vernetzt_antwort',
        'linkedin_vernetzt',
        'email_antwort',
        'website_anfrage',
        'messe_event',
        'empfehlung',
        'bestandskontakt',
        'stellenanzeige_innendienst',
        'oeffentliche_aussage',
        'sonstiger_konkreter_anlass',
      ],
      call_direction: ['out', 'in'],
      call_outcome: [
        'no_answer',
        'busy',
        'voicemail',
        'voicemail_left',
        'wrong_number',
        'gatekeeper',
        'gatekeeper_blocked',
        'callback_scheduled',
        'dm_interest',
        'meeting_booked',
        'send_info',
        'not_now',
        'not_interested',
        'not_icp',
        'do_not_call',
      ],
      call_provider: ['manual', 'placetel', 'sipgate', 'aircall'],
      channel: ['linkedin', 'telefon', 'email', 'sonstiges'],
      connection_status: ['ausstehend', 'angenommen', 'zurueckgezogen', 'abgelaufen'],
      counter_period: ['tag', 'monat'],
      email_channel: ['gmail_compose', 'gmail_api', 'brevo', 'mailto', 'manual', 'smtp'],
      email_consent_basis: [
        'none',
        'requested_linkedin',
        'requested_phone',
        'requested_email',
        'meeting_held',
        'double_opt_in',
        'existing_customer',
        'revoked',
      ],
      email_direction: ['out', 'in'],
      email_status: [
        'draft',
        'opened_in_client',
        'sent_confirmed',
        'sent',
        'delivered',
        'bounced',
        'replied',
        'failed',
        'received',
      ],
      ended_reason: [
        'kein_bedarf',
        'nicht_icp',
        'nicht_qualifiziert',
        'kein_interesse',
        'falsche_nummer',
        'duplikat',
        'widerspruch',
        'sonstiges',
      ],
      enrollment_status: ['aktiv', 'pausiert', 'abgeschlossen', 'gestoppt'],
      form_of_address: ['sie', 'du'],
      lead_role: [
        'geschaeftsfuehrer',
        'inhaber',
        'kundenbetreuer',
        'innendienst',
        'vertrieb',
        'projektleiter',
        'sonstiges',
        'unbekannt',
      ],
      lead_stage: [
        'neu',
        'vernetzung_gesendet',
        'vernetzt',
        'gespraech_eroeffnet',
        'dm_follow_up',
        'dm_beantwortet',
        'bedarfsermittlung',
        'pitch',
        'erstgespraech_vereinbart',
        'erstgespraech',
        'strategiegespraech_vereinbart',
        'strategiegespraech',
        'sales_follow_up',
        'kunde',
        'langfristig',
        'beendet',
      ],
      linkedin_plan: ['basic', 'premium', 'sales_navigator'],
      meeting_status: ['geplant', 'stattgefunden', 'no_show', 'abgesagt', 'verschoben'],
      meeting_type: ['erstgespraech', 'strategiegespraech', 'folgegespraech'],
      metric: [
        'vernetzungen_versendet',
        'vernetzungen_angenommen',
        'ausstehend',
        'gespraeche_eroeffnet',
        'dm_beantwortet',
        'erstgespraech_gepitcht',
        'erstgespraeche_vereinbart',
        'erstgespraeche',
        'strategiegespraeche',
        'kunden_gewonnen',
        'erstgespraech_no_show',
        'erstgespraech_abgesagt',
        'strategiegespraech_no_show',
        'strategiegespraech_abgesagt',
        'anrufe',
        'anrufe_erreicht',
        'entscheider_gespraeche',
        'termine_telefon',
        'emails_gesendet',
        'strategiegespraeche_vereinbart',
      ],
      next_action_kind: ['sequenz_schritt', 'rueckruf', 'wiedervorlage', 'aufgabe', 'meeting', 'antworten'],
      note_variant: ['ohne', 'note_v1', 'note_v2'],
      phone_source: [
        'website_kontakt',
        'google_profil',
        'branchenverzeichnis',
        'linkedin',
        'visitenkarte',
        'mitgeteilt',
        'impressum',
        'unbekannt',
      ],
      phone_type: ['zentrale', 'durchwahl', 'mobil', 'unbekannt'],
      reached_person: ['niemand', 'zentrale', 'assistenz', 'entscheider', 'sonstige'],
      record_source: [
        'app',
        'import_sheet',
        'import_csv',
        'schnellimport',
        'linkedin_export',
        'telefonie',
        'email_sync',
        'recherche',
      ],
      reply_label: [
        'interessiert',
        'frage',
        'kein_bedarf',
        'spaeter',
        'nicht_icp',
        'hat_partner',
        'falsches_problem',
        'widerspruch',
        'sonstiges',
      ],
      salutation: ['herr', 'frau', 'neutral'],
      sequence_trigger: [
        'manuell',
        'vernetzung_angenommen',
        'vernetzung_mit_notiz_angenommen',
        'antwort_gesendet',
        'erstgespraech_stattgefunden',
        'telefon_nicht_erreicht',
        'info_zugesagt_linkedin',
        'info_zugesagt_telefon',
      ],
      step_kind: ['nachricht', 'anruf', 'email', 'aufgabe'],
      step_outcome: ['gesendet', 'uebersprungen', 'antwort_erhalten', 'abgebrochen'],
      stop_reason: [
        'antwort_erhalten',
        'meeting_gebucht',
        'lead_beendet',
        'verbindung_entfernt',
        'widerspruch',
        'manuell',
        'ersetzt',
        'uebergabe',
      ],
      task_kind: ['rueckruf', 'wiedervorlage', 'aufgabe'],
      task_status: ['offen', 'erledigt', 'abgebrochen'],
      template_phase: [
        'vernetzung',
        'eroeffnung',
        'bedarfsermittlung',
        'pitch',
        'follow_up',
        'langfristig',
        'gatekeeper',
        'einstieg',
        'problem',
        'qualifizierung',
        'einwand',
        'abschluss',
        'mailbox',
        'rueckruf',
        'datenschutz',
        'zusammenfassung',
        'nachfassen',
        'infomail',
        'transaktional',
        'erstgespraech',
        'strategiegespraech',
        'einwandbehandlung',
        'angebot',
      ],
    },
  },
  public: {
    Enums: {},
  },
} as const

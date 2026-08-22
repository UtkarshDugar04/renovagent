export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      approval_requests: {
        Row: {
          created_at: string
          decision_id: string | null
          design_option_id: string | null
          id: string
          project_id: string
          question: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          decision_id?: string | null
          design_option_id?: string | null
          id?: string
          project_id: string
          question: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          decision_id?: string | null
          design_option_id?: string | null
          id?: string
          project_id?: string
          question?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_design_option_id_fkey"
            columns: ["design_option_id"]
            isOneToOne: false
            referencedRelation: "design_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assumptions: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          domain: Database["public"]["Enums"]["domain_type"] | null
          id: string
          impact_if_wrong: string | null
          project_id: string
          statement: string
          status: string
          verification_required: boolean
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          domain?: Database["public"]["Enums"]["domain_type"] | null
          id?: string
          impact_if_wrong?: string | null
          project_id: string
          statement: string
          status?: string
          verification_required?: boolean
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          domain?: Database["public"]["Enums"]["domain_type"] | null
          id?: string
          impact_if_wrong?: string | null
          project_id?: string
          statement?: string
          status?: string
          verification_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assumptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          id: string
          label: string | null
          mime_type: string | null
          project_id: string
          status: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          mime_type?: string | null
          project_id: string
          status?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          mime_type?: string | null
          project_id?: string
          status?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          category: string
          confirmed: number | null
          created_at: string
          estimated: number | null
          id: string
          priority_tier: string
          probable_high: number | null
          probable_low: number | null
          project_id: string
          quoted: number | null
        }
        Insert: {
          category: string
          confirmed?: number | null
          created_at?: string
          estimated?: number | null
          id?: string
          priority_tier?: string
          probable_high?: number | null
          probable_low?: number | null
          project_id: string
          quoted?: number | null
        }
        Update: {
          category?: string
          confirmed?: number | null
          created_at?: string
          estimated?: number | null
          id?: string
          priority_tier?: string
          probable_high?: number | null
          probable_low?: number | null
          project_id?: string
          quoted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          ended_at: string | null
          id: string
          project_id: string
          started_at: string
          started_by: string | null
          status: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          project_id: string
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          project_id?: string
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conflicts: {
        Row: {
          affected_domains: Database["public"]["Enums"]["domain_type"][]
          blocks_decision_id: string | null
          created_at: string
          evidence_a_id: string
          evidence_b_id: string
          id: string
          project_id: string
          reason: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          affected_domains?: Database["public"]["Enums"]["domain_type"][]
          blocks_decision_id?: string | null
          created_at?: string
          evidence_a_id: string
          evidence_b_id: string
          id?: string
          project_id: string
          reason: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          affected_domains?: Database["public"]["Enums"]["domain_type"][]
          blocks_decision_id?: string | null
          created_at?: string
          evidence_a_id?: string
          evidence_b_id?: string
          id?: string
          project_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflicts_blocks_decision_id_fkey"
            columns: ["blocks_decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_evidence_a_id_fkey"
            columns: ["evidence_a_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_evidence_b_id_fkey"
            columns: ["evidence_b_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          call_session_id: string | null
          created_at: string
          extracted_evidence_ids: string[]
          id: string
          project_id: string
          sender_id: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
          text: string
          turn_type: string
        }
        Insert: {
          call_session_id?: string | null
          created_at?: string
          extracted_evidence_ids?: string[]
          id?: string
          project_id: string
          sender_id?: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
          text: string
          turn_type?: string
        }
        Update: {
          call_session_id?: string | null
          created_at?: string
          extracted_evidence_ids?: string[]
          id?: string
          project_id?: string
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["user_role"]
          text?: string
          turn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          affected_domains: Database["public"]["Enums"]["domain_type"][]
          alternatives_considered: string[]
          created_at: string
          decision_maker_role: Database["public"]["Enums"]["user_role"] | null
          decision_text: string
          id: string
          project_id: string
          rationale: string | null
          reversibility: string | null
          status: string
          supersedes_decision_id: string | null
        }
        Insert: {
          affected_domains?: Database["public"]["Enums"]["domain_type"][]
          alternatives_considered?: string[]
          created_at?: string
          decision_maker_role?: Database["public"]["Enums"]["user_role"] | null
          decision_text: string
          id?: string
          project_id: string
          rationale?: string | null
          reversibility?: string | null
          status?: string
          supersedes_decision_id?: string | null
        }
        Update: {
          affected_domains?: Database["public"]["Enums"]["domain_type"][]
          alternatives_considered?: string[]
          created_at?: string
          decision_maker_role?: Database["public"]["Enums"]["user_role"] | null
          decision_text?: string
          id?: string
          project_id?: string
          rationale?: string | null
          reversibility?: string | null
          status?: string
          supersedes_decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_supersedes_decision_id_fkey"
            columns: ["supersedes_decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      design_option_feedback: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          design_option_id: string
          id: string
          sentiment: string
          sub_element: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          design_option_id: string
          id?: string
          sentiment: string
          sub_element?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          design_option_id?: string
          id?: string
          sentiment?: string
          sub_element?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_option_feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_option_feedback_design_option_id_fkey"
            columns: ["design_option_id"]
            isOneToOne: false
            referencedRelation: "design_options"
            referencedColumns: ["id"]
          },
        ]
      }
      design_option_images: {
        Row: {
          angle: string | null
          created_at: string
          design_option_id: string
          id: string
          materials_shown: string[]
          storage_path: string
        }
        Insert: {
          angle?: string | null
          created_at?: string
          design_option_id: string
          id?: string
          materials_shown?: string[]
          storage_path: string
        }
        Update: {
          angle?: string | null
          created_at?: string
          design_option_id?: string
          id?: string
          materials_shown?: string[]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_option_images_design_option_id_fkey"
            columns: ["design_option_id"]
            isOneToOne: false
            referencedRelation: "design_options"
            referencedColumns: ["id"]
          },
        ]
      }
      design_options: {
        Row: {
          cost_band: Json | null
          created_at: string
          design_round_id: string
          id: string
          label: string
          project_id: string
          rationale: string
          satisfies_evidence_ids: string[]
          sourcing_status: Database["public"]["Enums"]["sourcing_status"]
          status: Database["public"]["Enums"]["design_option_status"]
          trade_offs: Json
          visible_to_homeowner: boolean
          what_it_would_feel_like: string | null
        }
        Insert: {
          cost_band?: Json | null
          created_at?: string
          design_round_id: string
          id?: string
          label: string
          project_id: string
          rationale: string
          satisfies_evidence_ids?: string[]
          sourcing_status?: Database["public"]["Enums"]["sourcing_status"]
          status?: Database["public"]["Enums"]["design_option_status"]
          trade_offs?: Json
          visible_to_homeowner?: boolean
          what_it_would_feel_like?: string | null
        }
        Update: {
          cost_band?: Json | null
          created_at?: string
          design_round_id?: string
          id?: string
          label?: string
          project_id?: string
          rationale?: string
          satisfies_evidence_ids?: string[]
          sourcing_status?: Database["public"]["Enums"]["sourcing_status"]
          status?: Database["public"]["Enums"]["design_option_status"]
          trade_offs?: Json
          visible_to_homeowner?: boolean
          what_it_would_feel_like?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_options_design_round_id_fkey"
            columns: ["design_round_id"]
            isOneToOne: false
            referencedRelation: "design_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_options_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      design_rounds: {
        Row: {
          created_at: string
          id: string
          project_id: string
          round_number: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          round_number: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          round_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_rounds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          blocking: boolean
          created_at: string
          domain: Database["public"]["Enums"]["domain_type"] | null
          id: string
          project_id: string
          question: string | null
          required_authority: Database["public"]["Enums"]["authority_level"]
          resolution: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["escalation_status"]
          trigger: string
        }
        Insert: {
          blocking?: boolean
          created_at?: string
          domain?: Database["public"]["Enums"]["domain_type"] | null
          id?: string
          project_id: string
          question?: string | null
          required_authority?: Database["public"]["Enums"]["authority_level"]
          resolution?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["escalation_status"]
          trigger: string
        }
        Update: {
          blocking?: boolean
          created_at?: string
          domain?: Database["public"]["Enums"]["domain_type"] | null
          id?: string
          project_id?: string
          question?: string | null
          required_authority?: Database["public"]["Enums"]["authority_level"]
          resolution?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["escalation_status"]
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          activity_summary: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          project_id: string
        }
        Insert: {
          activity_summary?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          project_id: string
        }
        Update: {
          activity_summary?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          authority: Database["public"]["Enums"]["authority_level"]
          confidence: Database["public"]["Enums"]["confidence_level"]
          contradicts_evidence_id: string | null
          created_at: string
          domain: Database["public"]["Enums"]["domain_type"]
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          household_member_id: string | null
          id: string
          project_id: string
          related_evidence_ids: string[]
          source: string | null
          statement: string
          status: Database["public"]["Enums"]["evidence_status"]
          superseded_by_id: string | null
        }
        Insert: {
          authority?: Database["public"]["Enums"]["authority_level"]
          confidence?: Database["public"]["Enums"]["confidence_level"]
          contradicts_evidence_id?: string | null
          created_at?: string
          domain: Database["public"]["Enums"]["domain_type"]
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          household_member_id?: string | null
          id?: string
          project_id: string
          related_evidence_ids?: string[]
          source?: string | null
          statement: string
          status?: Database["public"]["Enums"]["evidence_status"]
          superseded_by_id?: string | null
        }
        Update: {
          authority?: Database["public"]["Enums"]["authority_level"]
          confidence?: Database["public"]["Enums"]["confidence_level"]
          contradicts_evidence_id?: string | null
          created_at?: string
          domain?: Database["public"]["Enums"]["domain_type"]
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          household_member_id?: string | null
          id?: string
          project_id?: string
          related_evidence_ids?: string[]
          source?: string | null
          statement?: string
          status?: Database["public"]["Enums"]["evidence_status"]
          superseded_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_contradicts_evidence_id_fkey"
            columns: ["contradicts_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_household_member_id_fkey"
            columns: ["household_member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_records: {
        Row: {
          approved_by: string | null
          brief: string
          created_at: string
          email_content: string | null
          email_sent_to: string | null
          id: string
          project_id: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          brief: string
          created_at?: string
          email_content?: string | null
          email_sent_to?: string | null
          id?: string
          project_id: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          brief?: string
          created_at?: string
          email_content?: string | null
          email_sent_to?: string | null
          id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          accessibility_needs: string | null
          created_at: string
          id: string
          is_primary_contact: boolean
          name: string
          project_id: string
          role_in_household: string | null
        }
        Insert: {
          accessibility_needs?: string | null
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          name: string
          project_id: string
          role_in_household?: string | null
        }
        Update: {
          accessibility_needs?: string | null
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          name?: string
          project_id?: string
          role_in_household?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_image_reactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          preference_image_id: string
          reaction: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          preference_image_id: string
          reaction: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          preference_image_id?: string
          reaction?: string
        }
        Relationships: [
          {
            foreignKeyName: "preference_image_reactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preference_image_reactions_preference_image_id_fkey"
            columns: ["preference_image_id"]
            isOneToOne: false
            referencedRelation: "preference_images"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          project_id: string
          room_or_theme: string | null
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id: string
          room_or_theme?: string | null
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id?: string
          room_or_theme?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "preference_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      project_artifacts: {
        Row: {
          artifact_type: string
          content: string | null
          created_at: string
          engine: Database["public"]["Enums"]["domain_type"]
          id: string
          image_storage_path: string | null
          project_id: string
        }
        Insert: {
          artifact_type: string
          content?: string | null
          created_at?: string
          engine: Database["public"]["Enums"]["domain_type"]
          id?: string
          image_storage_path?: string | null
          project_id: string
        }
        Update: {
          artifact_type?: string
          content?: string | null
          created_at?: string
          engine?: Database["public"]["Enums"]["domain_type"]
          id?: string
          image_storage_path?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_constraints: {
        Row: {
          category: string
          created_at: string
          description: string
          evidence_ids: string[]
          hardness: Database["public"]["Enums"]["constraint_hardness"]
          id: string
          project_id: string
          status: Database["public"]["Enums"]["constraint_status"]
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          evidence_ids?: string[]
          hardness?: Database["public"]["Enums"]["constraint_hardness"]
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["constraint_status"]
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          evidence_ids?: string[]
          hardness?: Database["public"]["Enums"]["constraint_hardness"]
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["constraint_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_constraints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          project_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_ceiling: number | null
          budget_comfortable_high: number | null
          budget_comfortable_low: number | null
          budget_stretch_high: number | null
          budget_stretch_low: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          phase: string
          property_address: string | null
          scope_summary: string | null
          updated_at: string
          yoxa_send_claimed_at: string | null
        }
        Insert: {
          budget_ceiling?: number | null
          budget_comfortable_high?: number | null
          budget_comfortable_low?: number | null
          budget_stretch_high?: number | null
          budget_stretch_low?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          phase?: string
          property_address?: string | null
          scope_summary?: string | null
          updated_at?: string
          yoxa_send_claimed_at?: string | null
        }
        Update: {
          budget_ceiling?: number | null
          budget_comfortable_high?: number | null
          budget_comfortable_low?: number | null
          budget_stretch_high?: number | null
          budget_stretch_low?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phase?: string
          property_address?: string | null
          scope_summary?: string | null
          updated_at?: string
          yoxa_send_claimed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          blocks_readiness: boolean
          created_at: string
          domain: Database["public"]["Enums"]["domain_type"] | null
          id: string
          owner_role: Database["public"]["Enums"]["user_role"] | null
          project_id: string
          question_text: string
          resolution_evidence_id: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["question_status"]
          why_it_matters: string | null
        }
        Insert: {
          blocks_readiness?: boolean
          created_at?: string
          domain?: Database["public"]["Enums"]["domain_type"] | null
          id?: string
          owner_role?: Database["public"]["Enums"]["user_role"] | null
          project_id: string
          question_text: string
          resolution_evidence_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["question_status"]
          why_it_matters?: string | null
        }
        Update: {
          blocks_readiness?: boolean
          created_at?: string
          domain?: Database["public"]["Enums"]["domain_type"] | null
          id?: string
          owner_role?: Database["public"]["Enums"]["user_role"] | null
          project_id?: string
          question_text?: string
          resolution_evidence_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["question_status"]
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_resolution_evidence_id_fkey"
            columns: ["resolution_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness: {
        Row: {
          domain: Database["public"]["Enums"]["domain_type"]
          project_id: string
          reason: string | null
          state: Database["public"]["Enums"]["readiness_state"]
          updated_at: string
        }
        Insert: {
          domain: Database["public"]["Enums"]["domain_type"]
          project_id: string
          reason?: string | null
          state?: Database["public"]["Enums"]["readiness_state"]
          updated_at?: string
        }
        Update: {
          domain?: Database["public"]["Enums"]["domain_type"]
          project_id?: string
          reason?: string | null
          state?: Database["public"]["Enums"]["readiness_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_elements: {
        Row: {
          attributes: Json
          certainty: string
          created_at: string
          element_type: string
          evidence_ids: string[]
          id: string
          project_id: string
          requires_verification: boolean
          room: string | null
        }
        Insert: {
          attributes?: Json
          certainty?: string
          created_at?: string
          element_type: string
          evidence_ids?: string[]
          id?: string
          project_id: string
          requires_verification?: boolean
          room?: string | null
        }
        Update: {
          attributes?: Json
          certainty?: string
          created_at?: string
          element_type?: string
          evidence_ids?: string[]
          id?: string
          project_id?: string
          requires_verification?: boolean
          room?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spatial_elements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_offs: {
        Row: {
          accepted_by_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          gained: string
          id: string
          project_id: string
          reason: string | null
          sacrificed: string
          status: string
        }
        Insert: {
          accepted_by_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          gained: string
          id?: string
          project_id: string
          reason?: string | null
          sacrificed: string
          status?: string
        }
        Update: {
          accepted_by_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          gained?: string
          id?: string
          project_id?: string
          reason?: string | null
          sacrificed?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_offs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_results: {
        Row: {
          created_at: string
          failed_criteria: Json
          human_decision_required: boolean
          id: string
          mode: string
          project_id: string
          result: string
          target_id: string | null
          target_type: string
          unresolved_risks: Json
        }
        Insert: {
          created_at?: string
          failed_criteria?: Json
          human_decision_required?: boolean
          id?: string
          mode: string
          project_id: string
          result: string
          target_id?: string | null
          target_type: string
          unresolved_risks?: Json
        }
        Update: {
          created_at?: string
          failed_criteria?: Json
          human_decision_required?: boolean
          id?: string
          mode?: string
          project_id?: string
          result?: string
          target_id?: string | null
          target_type?: string
          unresolved_risks?: Json
        }
        Relationships: [
          {
            foreignKeyName: "validation_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          created_at: string
          project_id: string
          workflow_run_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          workflow_run_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      yoxa_hitl_requests: {
        Row: {
          answered_at: string | null
          answered_by: string | null
          created_at: string
          description: string | null
          event_id: string
          id: string
          options: Json
          override_message: string | null
          project_id: string
          selected_option_id: string | null
          status: string
          title: string
          workflow_run_id: string
          yoxa_request_id: string
        }
        Insert: {
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          options?: Json
          override_message?: string | null
          project_id: string
          selected_option_id?: string | null
          status?: string
          title: string
          workflow_run_id: string
          yoxa_request_id: string
        }
        Update: {
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          options?: Json
          override_message?: string | null
          project_id?: string
          selected_option_id?: string | null
          status?: string
          title?: string
          workflow_run_id?: string
          yoxa_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "yoxa_hitl_requests_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yoxa_hitl_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yoxa_hitl_requests_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["workflow_run_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      authority_level:
        | "d0_agent"
        | "d1_recommendation"
        | "d2_homeowner"
        | "d3_professional"
        | "d4_external"
      confidence_level: "unknown" | "low" | "medium" | "high"
      constraint_hardness: "hard" | "soft" | "negotiable"
      constraint_status:
        | "confirmed"
        | "provisional"
        | "unresolved"
        | "requires_verification"
        | "cleared"
      design_option_status: "proposed" | "validated" | "rejected"
      domain_type: "family" | "spatial" | "preference" | "budget" | "constraint"
      escalation_status: "open" | "waiting" | "resolved"
      evidence_status:
        | "explicit"
        | "verified"
        | "inferred"
        | "assumed"
        | "unresolved"
        | "conflicted"
        | "stale"
        | "superseded"
      evidence_type:
        | "aspiration"
        | "requirement"
        | "preference"
        | "routine"
        | "pain_point"
        | "observation"
        | "constraint"
        | "priority"
        | "decision"
        | "trade_off"
        | "assumption"
        | "inference"
        | "question"
        | "conflict"
        | "verification"
        | "rejection"
      question_status: "open" | "waiting" | "resolved"
      readiness_state:
        | "not_started"
        | "discovery_in_progress"
        | "partially_understood"
        | "sufficient_for_validation"
        | "validated"
      severity_level: "e0" | "e1" | "e2" | "e3" | "e4" | "e5"
      sourcing_status:
        | "not_evaluated"
        | "grounded"
        | "indicative"
        | "ungrounded"
      user_role: "homeowner" | "agency" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      authority_level: [
        "d0_agent",
        "d1_recommendation",
        "d2_homeowner",
        "d3_professional",
        "d4_external",
      ],
      confidence_level: ["unknown", "low", "medium", "high"],
      constraint_hardness: ["hard", "soft", "negotiable"],
      constraint_status: [
        "confirmed",
        "provisional",
        "unresolved",
        "requires_verification",
        "cleared",
      ],
      design_option_status: ["proposed", "validated", "rejected"],
      domain_type: ["family", "spatial", "preference", "budget", "constraint"],
      escalation_status: ["open", "waiting", "resolved"],
      evidence_status: [
        "explicit",
        "verified",
        "inferred",
        "assumed",
        "unresolved",
        "conflicted",
        "stale",
        "superseded",
      ],
      evidence_type: [
        "aspiration",
        "requirement",
        "preference",
        "routine",
        "pain_point",
        "observation",
        "constraint",
        "priority",
        "decision",
        "trade_off",
        "assumption",
        "inference",
        "question",
        "conflict",
        "verification",
        "rejection",
      ],
      question_status: ["open", "waiting", "resolved"],
      readiness_state: [
        "not_started",
        "discovery_in_progress",
        "partially_understood",
        "sufficient_for_validation",
        "validated",
      ],
      severity_level: ["e0", "e1", "e2", "e3", "e4", "e5"],
      sourcing_status: [
        "not_evaluated",
        "grounded",
        "indicative",
        "ungrounded",
      ],
      user_role: ["homeowner", "agency", "admin"],
    },
  },
} as const

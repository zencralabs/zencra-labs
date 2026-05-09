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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addons: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          credits_granted: number
          eligible_plan_id: string
          id: string
          interval: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          credits_granted: number
          eligible_plan_id: string
          id?: string
          interval: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          credits_granted?: number
          eligible_plan_id?: string
          id?: string
          interval?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_eligible_plan_id_fkey"
            columns: ["eligible_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_influencer_profiles: {
        Row: {
          age_range: string | null
          appearance_notes: string | null
          created_at: string
          face_structure: string | null
          fashion_style: string | null
          gender: string | null
          id: string
          influencer_id: string
          mood: string[]
          platform_intent: string[]
          realism_level: string | null
          skin_tone: string | null
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          appearance_notes?: string | null
          created_at?: string
          face_structure?: string | null
          fashion_style?: string | null
          gender?: string | null
          id?: string
          influencer_id: string
          mood?: string[]
          platform_intent?: string[]
          realism_level?: string | null
          skin_tone?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          appearance_notes?: string | null
          created_at?: string
          face_structure?: string | null
          fashion_style?: string | null
          gender?: string | null
          id?: string
          influencer_id?: string
          mood?: string[]
          platform_intent?: string[]
          realism_level?: string | null
          skin_tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_influencer_profiles_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: true
            referencedRelation: "ai_influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_influencers: {
        Row: {
          created_at: string
          display_name: string | null
          handle: string | null
          hero_asset_id: string | null
          id: string
          identity_lock_id: string | null
          name: string
          status: string
          style_category: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          handle?: string | null
          hero_asset_id?: string | null
          id?: string
          identity_lock_id?: string | null
          name: string
          status?: string
          style_category?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          handle?: string | null
          hero_asset_id?: string | null
          id?: string
          identity_lock_id?: string | null
          name?: string
          status?: string
          style_category?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_influencers_hero_asset_id_fkey"
            columns: ["hero_asset_id"]
            isOneToOne: false
            referencedRelation: "influencer_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_influencers_identity_lock"
            columns: ["identity_lock_id"]
            isOneToOne: false
            referencedRelation: "identity_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          aspect_ratio: string | null
          audio_detected: boolean | null
          bucket: string | null
          character_id: string | null
          completed_at: string | null
          concept_id: string | null
          created_at: string
          credits_cost: number | null
          duration_seconds: number | null
          enriched_metadata: Json | null
          error_message: string | null
          external_job_id: string | null
          generation_metadata: Json | null
          id: string
          is_favorite: boolean
          is_featured: boolean
          job_id: string
          last_polled_at: string | null
          metadata_enriched_at: string | null
          metadata_version: number | null
          mime_type: string | null
          model_key: string
          owner_project_type: string | null
          parent_job_id: string | null
          poll_attempts: number
          project_id: string | null
          prompt: string | null
          provider: string
          recovered: boolean
          reference_urls: string[] | null
          retry_of: string | null
          session_id: string | null
          size_bytes: number | null
          slug: string | null
          soul_id: string | null
          stale_at: string | null
          status: string
          storage_path: string | null
          studio: string
          studio_meta: Json
          updated_at: string
          url: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          aspect_ratio?: string | null
          audio_detected?: boolean | null
          bucket?: string | null
          character_id?: string | null
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          credits_cost?: number | null
          duration_seconds?: number | null
          enriched_metadata?: Json | null
          error_message?: string | null
          external_job_id?: string | null
          generation_metadata?: Json | null
          id?: string
          is_favorite?: boolean
          is_featured?: boolean
          job_id: string
          last_polled_at?: string | null
          metadata_enriched_at?: string | null
          metadata_version?: number | null
          mime_type?: string | null
          model_key: string
          owner_project_type?: string | null
          parent_job_id?: string | null
          poll_attempts?: number
          project_id?: string | null
          prompt?: string | null
          provider: string
          recovered?: boolean
          reference_urls?: string[] | null
          retry_of?: string | null
          session_id?: string | null
          size_bytes?: number | null
          slug?: string | null
          soul_id?: string | null
          stale_at?: string | null
          status?: string
          storage_path?: string | null
          studio: string
          studio_meta?: Json
          updated_at?: string
          url?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          aspect_ratio?: string | null
          audio_detected?: boolean | null
          bucket?: string | null
          character_id?: string | null
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          credits_cost?: number | null
          duration_seconds?: number | null
          enriched_metadata?: Json | null
          error_message?: string | null
          external_job_id?: string | null
          generation_metadata?: Json | null
          id?: string
          is_favorite?: boolean
          is_featured?: boolean
          job_id?: string
          last_polled_at?: string | null
          metadata_enriched_at?: string | null
          metadata_version?: number | null
          mime_type?: string | null
          model_key?: string
          owner_project_type?: string | null
          parent_job_id?: string | null
          poll_attempts?: number
          project_id?: string | null
          prompt?: string | null
          provider?: string
          recovered?: boolean
          reference_urls?: string[] | null
          retry_of?: string | null
          session_id?: string | null
          size_bytes?: number | null
          slug?: string | null
          soul_id?: string | null
          stale_at?: string | null
          status?: string
          storage_path?: string | null
          studio?: string
          studio_meta?: Json
          updated_at?: string
          url?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "creative_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "project_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boosts: {
        Row: {
          active: boolean
          amount_cents: number
          amount_cents_floor: number
          created_at: string
          credits: number
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          amount_cents_floor: number
          created_at?: string
          credits: number
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          amount_cents_floor?: number
          created_at?: string
          credits?: number
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          appearance_prompt: string
          created_at: string
          id: string
          name: string
          personality_traits: Json
          soul_id: string
          updated_at: string
          user_id: string
          visual_reference_url: string | null
          visual_style: string
          voice_profile: string | null
        }
        Insert: {
          appearance_prompt?: string
          created_at?: string
          id?: string
          name: string
          personality_traits?: Json
          soul_id: string
          updated_at?: string
          user_id: string
          visual_reference_url?: string | null
          visual_style?: string
          voice_profile?: string | null
        }
        Update: {
          appearance_prompt?: string
          created_at?: string
          id?: string
          name?: string
          personality_traits?: Json
          soul_id?: string
          updated_at?: string
          user_id?: string
          visual_reference_url?: string | null
          visual_style?: string
          voice_profile?: string | null
        }
        Relationships: []
      }
      creative_activity_log: {
        Row: {
          created_at: string
          event_payload: Json
          event_type: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_payload?: Json
          event_type: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_payload?: Json
          event_type?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_briefs: {
        Row: {
          additional_copy_notes: string | null
          advanced_settings: Json
          aspect_ratio: string | null
          color_preference: string | null
          concepting_session_key: string | null
          created_at: string
          cta: string | null
          goal: string | null
          headline: string | null
          id: string
          mood_tags: Json
          original_input: string | null
          parsed_brief_json: Json
          project_id: string
          project_type: string | null
          realism_vs_design: number | null
          reference_assets: Json
          style_preset: string | null
          subheadline: string | null
          text_rendering_intent: string | null
          updated_at: string
          visual_intensity: string | null
        }
        Insert: {
          additional_copy_notes?: string | null
          advanced_settings?: Json
          aspect_ratio?: string | null
          color_preference?: string | null
          concepting_session_key?: string | null
          created_at?: string
          cta?: string | null
          goal?: string | null
          headline?: string | null
          id?: string
          mood_tags?: Json
          original_input?: string | null
          parsed_brief_json?: Json
          project_id: string
          project_type?: string | null
          realism_vs_design?: number | null
          reference_assets?: Json
          style_preset?: string | null
          subheadline?: string | null
          text_rendering_intent?: string | null
          updated_at?: string
          visual_intensity?: string | null
        }
        Update: {
          additional_copy_notes?: string | null
          advanced_settings?: Json
          aspect_ratio?: string | null
          color_preference?: string | null
          concepting_session_key?: string | null
          created_at?: string
          cta?: string | null
          goal?: string | null
          headline?: string | null
          id?: string
          mood_tags?: Json
          original_input?: string | null
          parsed_brief_json?: Json
          project_id?: string
          project_type?: string | null
          realism_vs_design?: number | null
          reference_assets?: Json
          style_preset?: string | null
          subheadline?: string | null
          text_rendering_intent?: string | null
          updated_at?: string
          visual_intensity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_concepts: {
        Row: {
          brief_id: string | null
          color_strategy: string | null
          concept_index: number
          concept_payload: Json
          created_at: string
          id: string
          is_selected: boolean
          layout_strategy: string | null
          project_id: string
          rationale: string | null
          recommended_model: string | null
          recommended_provider: string | null
          recommended_use_case: string | null
          scores: Json
          session_id: string | null
          summary: string
          title: string
          typography_strategy: string | null
        }
        Insert: {
          brief_id?: string | null
          color_strategy?: string | null
          concept_index: number
          concept_payload?: Json
          created_at?: string
          id?: string
          is_selected?: boolean
          layout_strategy?: string | null
          project_id: string
          rationale?: string | null
          recommended_model?: string | null
          recommended_provider?: string | null
          recommended_use_case?: string | null
          scores?: Json
          session_id?: string | null
          summary: string
          title: string
          typography_strategy?: string | null
        }
        Update: {
          brief_id?: string | null
          color_strategy?: string | null
          concept_index?: number
          concept_payload?: Json
          created_at?: string
          id?: string
          is_selected?: boolean
          layout_strategy?: string | null
          project_id?: string
          rationale?: string | null
          recommended_model?: string | null
          recommended_provider?: string | null
          recommended_use_case?: string | null
          scores?: Json
          session_id?: string | null
          summary?: string
          title?: string
          typography_strategy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_concepts_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "creative_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_concepts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_concepts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "project_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_directions: {
        Row: {
          canvas_state: Json | null
          concept_id: string | null
          created_at: string
          direction_version: number
          id: string
          is_locked: boolean
          model_key: string | null
          name: string | null
          project_id: string | null
          scene_snapshot: Json | null
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canvas_state?: Json | null
          concept_id?: string | null
          created_at?: string
          direction_version?: number
          id?: string
          is_locked?: boolean
          model_key?: string | null
          name?: string | null
          project_id?: string | null
          scene_snapshot?: Json | null
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canvas_state?: Json | null
          concept_id?: string | null
          created_at?: string
          direction_version?: number
          id?: string
          is_locked?: boolean
          model_key?: string | null
          name?: string | null
          project_id?: string | null
          scene_snapshot?: Json | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_directions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "creative_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_directions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_generations: {
        Row: {
          adaptation_target: string | null
          asset_id: string | null
          character_id: string | null
          completed_at: string | null
          concept_id: string | null
          created_at: string
          credit_cost: number
          direction_id: string | null
          error_message: string | null
          generation_type: string
          id: string
          idempotency_key: string | null
          model: string
          normalized_prompt: Json
          parent_generation_id: string | null
          project_id: string | null
          provider: string
          refunded_at: string | null
          request_payload: Json
          session_id: string | null
          status: string
          user_id: string
          variation_type: string | null
        }
        Insert: {
          adaptation_target?: string | null
          asset_id?: string | null
          character_id?: string | null
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          credit_cost?: number
          direction_id?: string | null
          error_message?: string | null
          generation_type?: string
          id?: string
          idempotency_key?: string | null
          model: string
          normalized_prompt?: Json
          parent_generation_id?: string | null
          project_id?: string | null
          provider: string
          refunded_at?: string | null
          request_payload?: Json
          session_id?: string | null
          status?: string
          user_id: string
          variation_type?: string | null
        }
        Update: {
          adaptation_target?: string | null
          asset_id?: string | null
          character_id?: string | null
          completed_at?: string | null
          concept_id?: string | null
          created_at?: string
          credit_cost?: number
          direction_id?: string | null
          error_message?: string | null
          generation_type?: string
          id?: string
          idempotency_key?: string | null
          model?: string
          normalized_prompt?: Json
          parent_generation_id?: string | null
          project_id?: string | null
          provider?: string
          refunded_at?: string | null
          request_payload?: Json
          session_id?: string | null
          status?: string
          user_id?: string
          variation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_generations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_generations_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_generations_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "creative_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_generations_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "creative_directions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_generations_parent_generation_id_fkey"
            columns: ["parent_generation_id"]
            isOneToOne: false
            referencedRelation: "creative_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_generations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "project_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_projects: {
        Row: {
          audience: string | null
          brand_name: string | null
          cover_asset_id: string | null
          created_at: string
          id: string
          last_activity_at: string
          platform: string | null
          project_type: string
          selected_concept_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string | null
          brand_name?: string | null
          cover_asset_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          platform?: string | null
          project_type: string
          selected_concept_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string | null
          brand_name?: string | null
          cover_asset_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          platform?: string | null
          project_type?: string
          selected_concept_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_accounts: {
        Row: {
          addon_credits: number
          bonus_credits: number
          created_at: string
          id: string
          subscription_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          addon_credits?: number
          bonus_credits?: number
          created_at?: string
          id?: string
          subscription_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          addon_credits?: number
          bonus_credits?: number
          created_at?: string
          id?: string
          subscription_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          bucket: string
          created_at: string
          description: string | null
          entry_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          amount: number
          bucket: string
          created_at?: string
          description?: string | null
          entry_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          amount?: number
          bucket?: string
          created_at?: string
          description?: string | null
          entry_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      credit_model_costs: {
        Row: {
          active: boolean
          base_credits: number
          created_at: string
          id: string
          is_addon: boolean
          label: string
          model_key: string
          parent_model_key: string | null
          quality_multipliers: Json | null
          studio: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_credits: number
          created_at?: string
          id?: string
          is_addon?: boolean
          label: string
          model_key: string
          parent_model_key?: string | null
          quality_multipliers?: Json | null
          studio: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_credits?: number
          created_at?: string
          id?: string
          is_addon?: boolean
          label?: string
          model_key?: string
          parent_model_key?: string | null
          quality_multipliers?: Json | null
          studio?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_model_costs_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          model_cost_id: string
          new_base_credits: number
          old_base_credits: number
          reason: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          model_cost_id: string
          new_base_credits: number
          old_base_credits: number
          reason: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          model_cost_id?: string
          new_base_credits?: number
          old_base_credits?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_model_costs_audit_model_cost_id_fkey"
            columns: ["model_cost_id"]
            isOneToOne: false
            referencedRelation: "credit_model_costs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          active: boolean
          created_at: string
          credits: number
          currency: string
          id: string
          metadata: Json
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits: number
          currency?: string
          id?: string
          metadata?: Json
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          metadata?: Json
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          owner_user_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          owner_user_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          owner_user_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direction_elements: {
        Row: {
          asset_url: string | null
          created_at: string
          direction_id: string
          id: string
          label: string
          position: number
          type: string
          weight: number
        }
        Insert: {
          asset_url?: string | null
          created_at?: string
          direction_id: string
          id?: string
          label: string
          position?: number
          type: string
          weight?: number
        }
        Update: {
          asset_url?: string | null
          created_at?: string
          direction_id?: string
          id?: string
          label?: string
          position?: number
          type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "direction_elements_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "creative_directions"
            referencedColumns: ["id"]
          },
        ]
      }
      direction_refinements: {
        Row: {
          camera_angle: string | null
          color_palette: string | null
          created_at: string
          direction_id: string
          id: string
          identity_lock: boolean
          lens: string | null
          lighting_style: string | null
          scene_energy: string | null
          shot_type: string | null
          tone_intensity: number | null
          updated_at: string
        }
        Insert: {
          camera_angle?: string | null
          color_palette?: string | null
          created_at?: string
          direction_id: string
          id?: string
          identity_lock?: boolean
          lens?: string | null
          lighting_style?: string | null
          scene_energy?: string | null
          shot_type?: string | null
          tone_intensity?: number | null
          updated_at?: string
        }
        Update: {
          camera_angle?: string | null
          color_palette?: string | null
          created_at?: string
          direction_id?: string
          id?: string
          identity_lock?: boolean
          lens?: string | null
          lighting_style?: string | null
          scene_energy?: string | null
          shot_type?: string | null
          tone_intensity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direction_refinements_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "creative_directions"
            referencedColumns: ["id"]
          },
        ]
      }
      free_usage: {
        Row: {
          created_at: string
          images_max: number
          images_used: number
          updated_at: string
          user_id: string
          videos_max: number
          videos_used: number
        }
        Insert: {
          created_at?: string
          images_max?: number
          images_used?: number
          updated_at?: string
          user_id: string
          videos_max?: number
          videos_used?: number
        }
        Update: {
          created_at?: string
          images_max?: number
          images_used?: number
          updated_at?: string
          user_id?: string
          videos_max?: number
          videos_used?: number
        }
        Relationships: []
      }
      generation_idempotency: {
        Row: {
          asset_id: string | null
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          job_id: string | null
          result_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          job_id?: string | null
          result_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          job_id?: string | null
          result_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          api_cost_usd: number | null
          completed_at: string | null
          created_at: string
          credits_used: number
          error_message: string | null
          estimated_credits: number | null
          external_job_id: string | null
          final_credits: number | null
          id: string
          idempotency_key: string | null
          metadata: Json
          mode: string | null
          negative_prompt: string | null
          output_url: string | null
          parameters: Json | null
          project_id: string | null
          prompt: string
          provider: string | null
          refunded_at: string | null
          result_url: string | null
          result_urls: string[] | null
          status: string
          tool: string
          tool_category: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          api_cost_usd?: number | null
          completed_at?: string | null
          created_at?: string
          credits_used?: number
          error_message?: string | null
          estimated_credits?: number | null
          external_job_id?: string | null
          final_credits?: number | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          mode?: string | null
          negative_prompt?: string | null
          output_url?: string | null
          parameters?: Json | null
          project_id?: string | null
          prompt: string
          provider?: string | null
          refunded_at?: string | null
          result_url?: string | null
          result_urls?: string[] | null
          status?: string
          tool: string
          tool_category: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          api_cost_usd?: number | null
          completed_at?: string | null
          created_at?: string
          credits_used?: number
          error_message?: string | null
          estimated_credits?: number | null
          external_job_id?: string | null
          final_credits?: number | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          mode?: string | null
          negative_prompt?: string | null
          output_url?: string | null
          parameters?: Json | null
          project_id?: string | null
          prompt?: string
          provider?: string | null
          refunded_at?: string | null
          result_url?: string | null
          result_urls?: string[] | null
          status?: string
          tool?: string
          tool_category?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          code: string
          created_at: string
          credits: number
          expires_at: string | null
          id: string
          message: string | null
          recipient_email: string | null
          recipient_id: string | null
          redeemed_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          code?: string
          created_at?: string
          credits: number
          expires_at?: string | null
          id?: string
          message?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          redeemed_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          credits?: number
          expires_at?: string | null
          id?: string
          message?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          redeemed_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_locks: {
        Row: {
          appearance_signature: Json
          body_signature: Json
          canonical_asset_id: string
          created_at: string
          face_embedding: Json
          id: string
          identity_strength_score: number
          influencer_id: string
          locked_at: string
          reference_asset_ids: string[]
          style_signature: Json
        }
        Insert: {
          appearance_signature?: Json
          body_signature?: Json
          canonical_asset_id: string
          created_at?: string
          face_embedding?: Json
          id?: string
          identity_strength_score?: number
          influencer_id: string
          locked_at?: string
          reference_asset_ids?: string[]
          style_signature?: Json
        }
        Update: {
          appearance_signature?: Json
          body_signature?: Json
          canonical_asset_id?: string
          created_at?: string
          face_embedding?: Json
          id?: string
          identity_strength_score?: number
          influencer_id?: string
          locked_at?: string
          reference_asset_ids?: string[]
          style_signature?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fk_identity_locks_canonical_asset"
            columns: ["canonical_asset_id"]
            isOneToOne: false
            referencedRelation: "influencer_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_locks_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "ai_influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          identity_lock_id: string | null
          influencer_id: string
          is_hero: boolean
          job_id: string | null
          metadata: Json
          thumbnail_url: string | null
          url: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          id?: string
          identity_lock_id?: string | null
          influencer_id: string
          is_hero?: boolean
          job_id?: string | null
          metadata?: Json
          thumbnail_url?: string | null
          url: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          identity_lock_id?: string | null
          influencer_id?: string
          is_hero?: boolean
          job_id?: string | null
          metadata?: Json
          thumbnail_url?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_influencer_assets_identity_lock"
            columns: ["identity_lock_id"]
            isOneToOne: false
            referencedRelation: "identity_locks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_influencer_assets_influencer"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "ai_influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_influencer_assets_job"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "influencer_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_generation_jobs: {
        Row: {
          aspect_ratio: string | null
          canonical_asset_id: string | null
          created_at: string
          credits_consumed: number | null
          error_message: string | null
          estimated_credits: number | null
          external_job_id: string | null
          id: string
          identity_lock_id: string | null
          influencer_id: string
          job_type: string
          metadata: Json
          model_key: string | null
          pack_label: string | null
          prompt: string | null
          provider: string | null
          result_urls: string[]
          status: string
          updated_at: string
        }
        Insert: {
          aspect_ratio?: string | null
          canonical_asset_id?: string | null
          created_at?: string
          credits_consumed?: number | null
          error_message?: string | null
          estimated_credits?: number | null
          external_job_id?: string | null
          id?: string
          identity_lock_id?: string | null
          influencer_id: string
          job_type: string
          metadata?: Json
          model_key?: string | null
          pack_label?: string | null
          prompt?: string | null
          provider?: string | null
          result_urls?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          aspect_ratio?: string | null
          canonical_asset_id?: string | null
          created_at?: string
          credits_consumed?: number | null
          error_message?: string | null
          estimated_credits?: number | null
          external_job_id?: string | null
          id?: string
          identity_lock_id?: string | null
          influencer_id?: string
          job_type?: string
          metadata?: Json
          model_key?: string | null
          pack_label?: string | null
          prompt?: string | null
          provider?: string | null
          result_urls?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_generation_jobs_canonical_asset"
            columns: ["canonical_asset_id"]
            isOneToOne: false
            referencedRelation: "influencer_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_generation_jobs_identity_lock_id_fkey"
            columns: ["identity_lock_id"]
            isOneToOne: false
            referencedRelation: "identity_locks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_generation_jobs_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "ai_influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          created_at: string
          credit_pack_id: string | null
          credits_to_grant: number
          currency: string
          fulfilled_at: string | null
          fulfillment_state: Database["public"]["Enums"]["fulfillment_state"]
          id: string
          idempotency_key: string | null
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_order_id: string
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_pack_id?: string | null
          credits_to_grant: number
          currency?: string
          fulfilled_at?: string | null
          fulfillment_state?: Database["public"]["Enums"]["fulfillment_state"]
          id?: string
          idempotency_key?: string | null
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_order_id: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_pack_id?: string | null
          credits_to_grant?: number
          currency?: string
          fulfilled_at?: string | null
          fulfillment_state?: Database["public"]["Enums"]["fulfillment_state"]
          id?: string
          idempotency_key?: string | null
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_order_id?: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_credit_pack_id_fkey"
            columns: ["credit_pack_id"]
            isOneToOne: false
            referencedRelation: "credit_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_usd: number
          created_at: string
          credits_purchased: number | null
          id: string
          metadata: Json | null
          pack_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          credits_purchased?: number | null
          id?: string
          metadata?: Json | null
          pack_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          credits_purchased?: number | null
          id?: string
          metadata?: Json | null
          pack_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          currency: string
          id: string
          interval: string
          plan_id: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          interval: string
          plan_id: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          credits_per_cycle: number
          fcs_allowed: boolean
          id: string
          max_users: number
          name: string
          slug: string
          team_enabled: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits_per_cycle: number
          fcs_allowed?: boolean
          id?: string
          max_users?: number
          name: string
          slug: string
          team_enabled?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          credits_per_cycle?: number
          fcs_allowed?: boolean
          id?: string
          max_users?: number
          name?: string
          slug?: string
          team_enabled?: boolean
        }
        Relationships: []
      }
      private_preview_access: {
        Row: {
          access_code: string
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          max_uses: number | null
          used_count: number
        }
        Insert: {
          access_code: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          used_count?: number
        }
        Update: {
          access_code?: string
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          used_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_color: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          credits: number
          email_lock_expires_at: string | null
          email_verified: boolean
          fcs_access: boolean
          full_name: string | null
          id: string
          is_system: boolean
          passkey_registered: boolean
          phone: string | null
          phone_verified: boolean
          plan: string
          referral_code: string | null
          referred_by: string | null
          role: string
          subscription_purchased_at: string | null
          totp_enabled: boolean
          updated_at: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          credits?: number
          email_lock_expires_at?: string | null
          email_verified?: boolean
          fcs_access?: boolean
          full_name?: string | null
          id: string
          is_system?: boolean
          passkey_registered?: boolean
          phone?: string | null
          phone_verified?: boolean
          plan?: string
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          subscription_purchased_at?: string | null
          totp_enabled?: boolean
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_color?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          credits?: number
          email_lock_expires_at?: string | null
          email_verified?: boolean
          fcs_access?: boolean
          full_name?: string | null
          id?: string
          is_system?: boolean
          passkey_registered?: boolean
          phone?: string | null
          phone_verified?: boolean
          plan?: string
          referral_code?: string | null
          referred_by?: string | null
          role?: string
          subscription_purchased_at?: string | null
          totp_enabled?: boolean
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sessions: {
        Row: {
          brief_json: Json
          created_at: string
          id: string
          name: string | null
          parsed_brief_json: Json
          project_id: string
          selected_concept_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          brief_json?: Json
          created_at?: string
          id?: string
          name?: string | null
          parsed_brief_json?: Json
          project_id: string
          selected_concept_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          brief_json?: Json
          created_at?: string
          id?: string
          name?: string | null
          parsed_brief_json?: Json
          project_id?: string
          selected_concept_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sessions_selected_concept_id_fk"
            columns: ["selected_concept_id"]
            isOneToOne: false
            referencedRelation: "creative_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          asset_count: number
          cover_asset_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          asset_count?: number
          cover_asset_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          asset_count?: number
          cover_asset_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          credits: number
          current_uses: number
          discount_pct: number | null
          id: string
          is_active: boolean
          max_uses: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          credits?: number
          current_uses?: number
          discount_pct?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          credits?: number
          current_uses?: number
          discount_pct?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          id: string
          promo_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          promo_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          promo_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_accounts: {
        Row: {
          balance_synced_at: string | null
          balance_unit: string | null
          billing_type: string
          created_at: string
          currency: string
          current_balance: number | null
          display_name: string
          id: string
          is_active: boolean
          low_balance_threshold: number | null
          notes: string | null
          provider_key: string
          quota_reset_date: string | null
          quota_total: number | null
          quota_used: number | null
          sync_method: string | null
          updated_at: string
        }
        Insert: {
          balance_synced_at?: string | null
          balance_unit?: string | null
          billing_type: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          display_name: string
          id?: string
          is_active?: boolean
          low_balance_threshold?: number | null
          notes?: string | null
          provider_key: string
          quota_reset_date?: string | null
          quota_total?: number | null
          quota_used?: number | null
          sync_method?: string | null
          updated_at?: string
        }
        Update: {
          balance_synced_at?: string | null
          balance_unit?: string | null
          billing_type?: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          display_name?: string
          id?: string
          is_active?: boolean
          low_balance_threshold?: number | null
          notes?: string | null
          provider_key?: string
          quota_reset_date?: string | null
          quota_total?: number | null
          quota_used?: number | null
          sync_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_balance_history: {
        Row: {
          balance: number | null
          balance_unit: string | null
          id: string
          provider_key: string
          snapshot_at: string
        }
        Insert: {
          balance?: number | null
          balance_unit?: string | null
          id?: string
          provider_key: string
          snapshot_at?: string
        }
        Update: {
          balance?: number | null
          balance_unit?: string | null
          id?: string
          provider_key?: string
          snapshot_at?: string
        }
        Relationships: []
      }
      provider_cost_log: {
        Row: {
          asset_id: string | null
          cost_basis: string
          failure_reason: string | null
          generation_params: Json | null
          id: string
          model_key: string
          provider_cost_units: number | null
          provider_cost_usd: number | null
          provider_key: string
          recorded_at: string
          status: string
          studio: string
          user_id: string | null
          zencra_credits_charged: number | null
        }
        Insert: {
          asset_id?: string | null
          cost_basis?: string
          failure_reason?: string | null
          generation_params?: Json | null
          id?: string
          model_key: string
          provider_cost_units?: number | null
          provider_cost_usd?: number | null
          provider_key: string
          recorded_at?: string
          status: string
          studio: string
          user_id?: string | null
          zencra_credits_charged?: number | null
        }
        Update: {
          asset_id?: string | null
          cost_basis?: string
          failure_reason?: string | null
          generation_params?: Json | null
          id?: string
          model_key?: string
          provider_cost_units?: number | null
          provider_cost_usd?: number | null
          provider_key?: string
          recorded_at?: string
          status?: string
          studio?: string
          user_id?: string | null
          zencra_credits_charged?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_cost_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          count: number
          expires_at: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          expires_at: string
          key: string
          window_start: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      request_logs: {
        Row: {
          asset_id: string | null
          created_at: string
          credits_used: number | null
          duration_ms: number | null
          error_code: string | null
          id: string
          ip: string | null
          model_key: string | null
          provider_cost: number | null
          route: string
          status: string
          studio: string | null
          user_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          credits_used?: number | null
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          ip?: string | null
          model_key?: string | null
          provider_cost?: number | null
          route: string
          status: string
          studio?: string | null
          user_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          credits_used?: number | null
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          ip?: string | null
          model_key?: string | null
          provider_cost?: number | null
          route?: string
          status?: string
          studio?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seat_add_on_prices: {
        Row: {
          active: boolean
          additional_seats: number
          amount_cents: number
          created_at: string
          credits_granted: number
          id: string
          interval: string
        }
        Insert: {
          active?: boolean
          additional_seats: number
          amount_cents: number
          created_at?: string
          credits_granted: number
          id?: string
          interval: string
        }
        Update: {
          active?: boolean
          additional_seats?: number
          amount_cents?: number
          created_at?: string
          credits_granted?: number
          id?: string
          interval?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      subscription_addons: {
        Row: {
          addon_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          provider_subscription_id: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider_subscription_id?: string | null
          status: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider_subscription_id?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_addons_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_seats: {
        Row: {
          created_at: string
          id: string
          invited_at: string
          invited_email: string
          joined_at: string | null
          removed_at: string | null
          seat_addon_id: string | null
          status: string
          subscription_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_email: string
          joined_at?: string | null
          removed_at?: string | null
          seat_addon_id?: string | null
          status: string
          subscription_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_email?: string
          joined_at?: string | null
          removed_at?: string | null
          seat_addon_id?: string | null
          status?: string
          subscription_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_seats_seat_addon_id_fkey"
            columns: ["seat_addon_id"]
            isOneToOne: false
            referencedRelation: "seat_add_on_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_seats_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          price_id: string
          provider: string | null
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          price_id: string
          provider?: string | null
          provider_subscription_id?: string | null
          status: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          price_id?: string
          provider?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "plan_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_usage: {
        Row: {
          audio_max: number
          audio_used: number
          converted_at: string | null
          created_at: string
          exhausted_at: string | null
          id: string
          images_max: number
          images_used: number
          trial_ends_at: string
          user_id: string
          videos_max: number
          videos_used: number
        }
        Insert: {
          audio_max?: number
          audio_used?: number
          converted_at?: string | null
          created_at?: string
          exhausted_at?: string | null
          id?: string
          images_max?: number
          images_used?: number
          trial_ends_at: string
          user_id: string
          videos_max?: number
          videos_used?: number
        }
        Update: {
          audio_max?: number
          audio_used?: number
          converted_at?: string | null
          created_at?: string
          exhausted_at?: string | null
          id?: string
          images_max?: number
          images_used?: number
          trial_ends_at?: string
          user_id?: string
          videos_max?: number
          videos_used?: number
        }
        Relationships: []
      }
      video_sequences: {
        Row: {
          aspect_ratio: string
          completed_shots: number
          created_at: string
          description: string | null
          duration_seconds: number
          id: string
          model_id: string
          sequence_status: string
          title: string | null
          total_shots: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          completed_shots?: number
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          model_id: string
          sequence_status?: string
          title?: string | null
          total_shots?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          completed_shots?: number
          created_at?: string
          description?: string | null
          duration_seconds?: number
          id?: string
          model_id?: string
          sequence_status?: string
          title?: string | null
          total_shots?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_shots: {
        Row: {
          asset_id: string | null
          composition_type: string | null
          continuity_disabled: boolean
          created_at: string
          end_frame_url: string | null
          error_message: string | null
          id: string
          identity_context: Json | null
          job_id: string | null
          motion_control: Json | null
          prompt: string
          resolved_prompt: string | null
          sequence_id: string
          shot_number: number
          shot_status: string
          start_frame_url: string | null
          transition_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          composition_type?: string | null
          continuity_disabled?: boolean
          created_at?: string
          end_frame_url?: string | null
          error_message?: string | null
          id?: string
          identity_context?: Json | null
          job_id?: string | null
          motion_control?: Json | null
          prompt: string
          resolved_prompt?: string | null
          sequence_id: string
          shot_number: number
          shot_status?: string
          start_frame_url?: string | null
          transition_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          composition_type?: string | null
          continuity_disabled?: boolean
          created_at?: string
          end_frame_url?: string | null
          error_message?: string | null
          id?: string
          identity_context?: Json | null
          job_id?: string | null
          motion_control?: Json | null
          prompt?: string
          resolved_prompt?: string | null
          sequence_id?: string
          shot_number?: number
          shot_status?: string
          start_frame_url?: string | null
          transition_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_shots_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "video_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          processed: boolean
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed?: boolean
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_event_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed?: boolean
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          credit_released: number
          credit_reserved: number
          credit_used: number
          error_message: string | null
          final_asset_id: string | null
          id: string
          input_payload: Json
          intent_type: string
          source: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credit_released?: number
          credit_reserved?: number
          credit_used?: number
          error_message?: string | null
          final_asset_id?: string | null
          id?: string
          input_payload?: Json
          intent_type: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credit_released?: number
          credit_reserved?: number
          credit_used?: number
          error_message?: string | null
          final_asset_id?: string | null
          id?: string
          input_payload?: Json
          intent_type?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      workflow_step_assets_legacy: {
        Row: {
          asset_id: string
          asset_type: string
          created_at: string
          id: string
          step_id: string
          user_id: string
        }
        Insert: {
          asset_id: string
          asset_type?: string
          created_at?: string
          id?: string
          step_id: string
          user_id: string
        }
        Update: {
          asset_id?: string
          asset_type?: string
          created_at?: string
          id?: string
          step_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_assets_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          attempt: number
          capability: string
          completed_at: string | null
          created_at: string
          credits_estimated: number
          credits_used: number
          error_message: string | null
          id: string
          idempotency_key: string
          input_payload: Json
          model_key: string | null
          output_asset_id: string | null
          output_payload: Json | null
          provider_key: string | null
          started_at: string | null
          status: string
          step_index: number
          updated_at: string
          workflow_run_id: string
        }
        Insert: {
          attempt?: number
          capability: string
          completed_at?: string | null
          created_at?: string
          credits_estimated?: number
          credits_used?: number
          error_message?: string | null
          id?: string
          idempotency_key: string
          input_payload?: Json
          model_key?: string | null
          output_asset_id?: string | null
          output_payload?: Json | null
          provider_key?: string | null
          started_at?: string | null
          status?: string
          step_index: number
          updated_at?: string
          workflow_run_id: string
        }
        Update: {
          attempt?: number
          capability?: string
          completed_at?: string | null
          created_at?: string
          credits_estimated?: number
          credits_used?: number
          error_message?: string | null
          id?: string
          idempotency_key?: string
          input_payload?: Json
          model_key?: string | null
          output_asset_id?: string | null
          output_payload?: Json | null
          provider_key?: string | null
          started_at?: string | null
          status?: string
          step_index?: number
          updated_at?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps_legacy: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          credits_used: number | null
          id: string
          model_key: string
          negative_prompt: string | null
          prompt: string
          result_url: string | null
          result_urls: string[] | null
          seed: number | null
          status: string
          step_number: number
          studio_type: string
          updated_at: string
          user_id: string
          workflow_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          credits_used?: number | null
          id?: string
          model_key: string
          negative_prompt?: string | null
          prompt?: string
          result_url?: string | null
          result_urls?: string[] | null
          seed?: number | null
          status?: string
          step_number: number
          studio_type: string
          updated_at?: string
          user_id: string
          workflow_id: string
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          credits_used?: number | null
          id?: string
          model_key?: string
          negative_prompt?: string | null
          prompt?: string
          result_url?: string | null
          result_urls?: string[] | null
          seed?: number | null
          status?: string
          step_number?: number
          studio_type?: string
          updated_at?: string
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows_legacy: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: {
          p_amount: number
          p_description: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      check_rate_limit: {
        Args: { p_key: string; p_max_req: number; p_window_s: number }
        Returns: boolean
      }
      claim_next_sequence_shot: {
        Args: { p_sequence_id: string }
        Returns: {
          asset_id: string | null
          composition_type: string | null
          continuity_disabled: boolean
          created_at: string
          end_frame_url: string | null
          error_message: string | null
          id: string
          identity_context: Json | null
          job_id: string | null
          motion_control: Json | null
          prompt: string
          resolved_prompt: string | null
          sequence_id: string
          shot_number: number
          shot_status: string
          start_frame_url: string | null
          transition_type: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "video_shots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      consume_free_usage: {
        Args: { p_studio_type: string; p_user_id: string }
        Returns: Json
      }
      consume_trial_usage: {
        Args: { p_studio_type: string; p_user_id: string }
        Returns: Json
      }
      deduct_credits: {
        Args: { p_amount: number; p_job_id?: string; p_user_id: string }
        Returns: boolean
      }
      fulfill_order: {
        Args: { p_order_id: string; p_provider_payment_id: string }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      get_user_entitlement: { Args: { p_user_id: string }; Returns: Json }
      grant_cycle_credits: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      refund_credits: {
        Args: {
          p_amount: number
          p_description: string
          p_generation_id?: string
          p_user_id: string
        }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      restore_credits: {
        Args: { p_amount: number; p_job_id?: string; p_user_id: string }
        Returns: undefined
      }
      spend_credits: {
        Args: {
          p_amount: number
          p_description: string
          p_generation_id?: string
          p_user_id: string
        }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
    }
    Enums: {
      billing_provider: "razorpay" | "stripe" | "crypto"
      fulfillment_state: "pending" | "fulfilled" | "failed"
      order_status:
        | "created"
        | "pending"
        | "paid"
        | "failed"
        | "expired"
        | "refunded"
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
  public: {
    Enums: {
      billing_provider: ["razorpay", "stripe", "crypto"],
      fulfillment_state: ["pending", "fulfilled", "failed"],
      order_status: [
        "created",
        "pending",
        "paid",
        "failed",
        "expired",
        "refunded",
      ],
    },
  },
} as const

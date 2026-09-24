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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      financial_transactions: {
        Row: { id: string; user_id: string; amount: number; transaction_date: string; currency: string; description: string; category: string; provider: string; provider_category: string; reconciliation_status: string; }
        Insert: { id?: string; user_id: string; amount: number; transaction_date: string; currency: string; description: string; category: string; provider: string; provider_category: string; reconciliation_status: string; [key: string]: any }
        Update: { id?: string; user_id?: string; amount?: number; transaction_date?: string; currency?: string; description?: string; category?: string; provider?: string; provider_category?: string; reconciliation_status?: string; [key: string]: any }
        Relationships: []
      }
      bank_connections: {
        Row: { id: string; user_id: string; provider: string; encrypted_access_token: string; }
        Insert: { id?: string; user_id: string; provider: string; encrypted_access_token: string; [key: string]: any }
        Update: { id?: string; user_id?: string; provider?: string; encrypted_access_token?: string; [key: string]: any }
        Relationships: []
      }
      user_financial_regions: {
        Row: { id: string; user_id: string; country_code: string; }
        Insert: { id?: string; user_id: string; country_code: string; [key: string]: any }
        Update: { id?: string; user_id?: string; country_code?: string; [key: string]: any }
        Relationships: []
      }
      user_budget_profiles: {
        Row: { id: string; user_id: string; monthly_budget: number; currency: string; budget_source: string; financial_goal: string | null; is_normalized: boolean | null; original_amount: number | null; original_currency: string | null; exchange_rate_used: number | null; exchange_rate_source: string | null; normalized_at: string | null; created_at: string; updated_at: string; }
        Insert: { id?: string; user_id: string; monthly_budget: number; currency?: string; budget_source?: string; financial_goal?: string | null; is_normalized?: boolean | null; original_amount?: number | null; original_currency?: string | null; exchange_rate_used?: number | null; exchange_rate_source?: string | null; normalized_at?: string | null; created_at?: string; updated_at?: string; [key: string]: any }
        Update: { id?: string; user_id?: string; monthly_budget?: number; currency?: string; budget_source?: string; financial_goal?: string | null; is_normalized?: boolean | null; original_amount?: number | null; original_currency?: string | null; exchange_rate_used?: number | null; exchange_rate_source?: string | null; normalized_at?: string | null; created_at?: string; updated_at?: string; [key: string]: any }
        Relationships: []
      }
      product_price_cache: {
        Row: { product_id: string; price: number; country: string; retailer: string; currency: string; source: string; confidence: number; retrieved_at: string; }
        Insert: { product_id: string; price: number; country: string; retailer: string; currency: string; source: string; confidence: number; retrieved_at?: string; [key: string]: any }
        Update: { product_id?: string; price?: number; country?: string; retailer?: string; currency?: string; source?: string; confidence?: number; retrieved_at?: string; [key: string]: any }
        Relationships: []
      }
      budget_transactions: {
        Row: {
          amount: number
          budget_id: string | null
          description: string | null
          food_analysis_id: string | null
          id: string
          transaction_date: string | null
        }
        Insert: {
          amount: number
          budget_id?: string | null
          description?: string | null
          food_analysis_id?: string | null
          id?: string
          transaction_date?: string | null
        }
        Update: {
          amount?: number
          budget_id?: string | null
          description?: string | null
          food_analysis_id?: string | null
          id?: string
          transaction_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_transactions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "user_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_users: {
        Row: {
          country_code: string
          created_at: string | null
          id: string
          is_verified: boolean | null
          phone_number: string
          user_id: string | null
          verification_code: string | null
          verification_expires_at: string | null
        }
        Insert: {
          country_code: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          phone_number: string
          user_id?: string | null
          verification_code?: string | null
          verification_expires_at?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          phone_number?: string
          user_id?: string | null
          verification_code?: string | null
          verification_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          invest_israel: boolean | null
          invest_uae: boolean | null
          name: string
          notes: string | null
          subsidiaries: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invest_israel?: boolean | null
          invest_uae?: boolean | null
          name: string
          notes?: string | null
          subsidiaries?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invest_israel?: boolean | null
          invest_uae?: boolean | null
          name?: string
          notes?: string | null
          subsidiaries?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          created_at: string | null
          from_user_id: string | null
          id: string
          status: string | null
          to_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          status?: string | null
          to_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          status?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string | null
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string | null
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string | null
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string | null
          deleted_at: string | null
          id: string
          joined_at: string | null
          last_read_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          conversation_type: string
          created_at: string | null
          created_by: string | null
          id: string
          is_group: boolean | null
          last_message_at: string | null
          last_message_content: string | null
          last_message_sender_id: string | null
          last_message_type: string | null
          metadata: Json | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          conversation_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_sender_id?: string | null
          last_message_type?: string | null
          metadata?: Json | null
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          conversation_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_sender_id?: string | null
          last_message_type?: string | null
          metadata?: Json | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      country_currency_map: {
        Row: {
          budget_range_high_monthly: number
          budget_range_low_monthly: number
          cost_of_living_tier: number
          country_code: string
          country_name: string
          created_at: string
          currency_code: string
          currency_symbol: string
          updated_at: string
        }
        Insert: {
          budget_range_high_monthly: number
          budget_range_low_monthly: number
          cost_of_living_tier?: number
          country_code: string
          country_name: string
          created_at?: string
          currency_code: string
          currency_symbol: string
          updated_at?: string
        }
        Update: {
          budget_range_high_monthly?: number
          budget_range_low_monthly?: number
          cost_of_living_tier?: number
          country_code?: string
          country_name?: string
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      currency_lookup: {
        Row: {
          country_code: string
          country_name: string
          currency_code: string
          currency_symbol: string
        }
        Insert: {
          country_code: string
          country_name: string
          currency_code: string
          currency_symbol: string
        }
        Update: {
          country_code?: string
          country_name?: string
          currency_code?: string
          currency_symbol?: string
        }
        Relationships: []
      }
      daily_progress: {
        Row: {
          calories_consumed: number | null
          calories_goal: number | null
          carbs_consumed: number | null
          carbs_goal: number | null
          created_at: string | null
          fat_consumed: number | null
          fat_goal: number | null
          fiber_consumed: number | null
          id: string
          meals_logged: number | null
          progress_data: Json | null
          progress_date: string
          protein_consumed: number | null
          protein_goal: number | null
          sugar_consumed: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          calories_consumed?: number | null
          calories_goal?: number | null
          carbs_consumed?: number | null
          carbs_goal?: number | null
          created_at?: string | null
          fat_consumed?: number | null
          fat_goal?: number | null
          fiber_consumed?: number | null
          id?: string
          meals_logged?: number | null
          progress_data?: Json | null
          progress_date: string
          protein_consumed?: number | null
          protein_goal?: number | null
          sugar_consumed?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          calories_consumed?: number | null
          calories_goal?: number | null
          carbs_consumed?: number | null
          carbs_goal?: number | null
          created_at?: string | null
          fat_consumed?: number | null
          fat_goal?: number | null
          fiber_consumed?: number | null
          id?: string
          meals_logged?: number | null
          progress_data?: Json | null
          progress_date?: string
          protein_consumed?: number | null
          protein_goal?: number | null
          sugar_consumed?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          max_attempts: number | null
          user_id: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          max_attempts?: number | null
          user_id?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          max_attempts?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      food_analysis_history: {
        Row: {
          analysis_data: Json | null
          analysis_type: string | null
          analyzed_at: string | null
          calories: number | null
          calories_consumed: number | null
          carbs: number | null
          created_at: string | null
          fat: number | null
          food_item_id: string | null
          food_name: string | null
          id: string
          image_url: string | null
          meal_type: string | null
          medication_id: string | null
          notes: string | null
          price_paid: number | null
          product_id: string | null
          protein: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_data?: Json | null
          analysis_type?: string | null
          analyzed_at?: string | null
          calories?: number | null
          calories_consumed?: number | null
          carbs?: number | null
          created_at?: string | null
          fat?: number | null
          food_item_id?: string | null
          food_name?: string | null
          id?: string
          image_url?: string | null
          meal_type?: string | null
          medication_id?: string | null
          notes?: string | null
          price_paid?: number | null
          product_id?: string | null
          protein?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_data?: Json | null
          analysis_type?: string | null
          analyzed_at?: string | null
          calories?: number | null
          calories_consumed?: number | null
          carbs?: number | null
          created_at?: string | null
          fat?: number | null
          food_item_id?: string | null
          food_name?: string | null
          id?: string
          image_url?: string | null
          meal_type?: string | null
          medication_id?: string | null
          notes?: string | null
          price_paid?: number | null
          product_id?: string | null
          protein?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_analysis_history_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_analysis_history_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_analysis_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_analysis_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          alternatives: Json | null
          barcode: string | null
          calories: number | null
          carbs: number | null
          category: string | null
          clinical_evaluation: string | null
          clinical_synopsis: string | null
          confidence_level: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          fat: number | null
          fiber: number | null
          glycemic_impact: Json | null
          goal_alignment_analysis: string | null
          health_impact_score: number | null
          health_rating: number | null
          health_status: string | null
          id: string
          image_url: string | null
          metabolic_impact: string | null
          micronutrients: Json | null
          minerals: Json | null
          name: string
          origin_context: string | null
          preparation_science: string | null
          price: number | null
          protein: number | null
          recommendation: string | null
          serving_size: string | null
          serving_size_unit: string | null
          sugar: number | null
          sustainability_audit: string | null
          user_id: string | null
          vitamins: Json | null
          vitamins_and_nutrition: string | null
        }
        Insert: {
          alternatives?: Json | null
          barcode?: string | null
          calories?: number | null
          carbs?: number | null
          category?: string | null
          clinical_evaluation?: string | null
          clinical_synopsis?: string | null
          confidence_level?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          fat?: number | null
          fiber?: number | null
          glycemic_impact?: Json | null
          goal_alignment_analysis?: string | null
          health_impact_score?: number | null
          health_rating?: number | null
          health_status?: string | null
          id?: string
          image_url?: string | null
          metabolic_impact?: string | null
          micronutrients?: Json | null
          minerals?: Json | null
          name: string
          origin_context?: string | null
          preparation_science?: string | null
          price?: number | null
          protein?: number | null
          recommendation?: string | null
          serving_size?: string | null
          serving_size_unit?: string | null
          sugar?: number | null
          sustainability_audit?: string | null
          user_id?: string | null
          vitamins?: Json | null
          vitamins_and_nutrition?: string | null
        }
        Update: {
          alternatives?: Json | null
          barcode?: string | null
          calories?: number | null
          carbs?: number | null
          category?: string | null
          clinical_evaluation?: string | null
          clinical_synopsis?: string | null
          confidence_level?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          fat?: number | null
          fiber?: number | null
          glycemic_impact?: Json | null
          goal_alignment_analysis?: string | null
          health_impact_score?: number | null
          health_rating?: number | null
          health_status?: string | null
          id?: string
          image_url?: string | null
          metabolic_impact?: string | null
          micronutrients?: Json | null
          minerals?: Json | null
          name?: string
          origin_context?: string | null
          preparation_science?: string | null
          price?: number | null
          protein?: number | null
          recommendation?: string | null
          serving_size?: string | null
          serving_size_unit?: string | null
          sugar?: number | null
          sustainability_audit?: string | null
          user_id?: string | null
          vitamins?: Json | null
          vitamins_and_nutrition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_location_cache: {
        Row: {
          cached_at: string | null
          city: string | null
          country_code: string
          country_name: string | null
          currency_code: string | null
          currency_symbol: string | null
          expires_at: string | null
          ip_address: string
        }
        Insert: {
          cached_at?: string | null
          city?: string | null
          country_code: string
          country_name?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          expires_at?: string | null
          ip_address: string
        }
        Update: {
          cached_at?: string | null
          city?: string | null
          country_code?: string
          country_name?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          expires_at?: string | null
          ip_address?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          calories: number | null
          cook_time_minutes: number | null
          created_at: string | null
          id: string
          image: string | null
          ingredients: Json | null
          instructions: Json | null
          meal_type: string | null
          name: string
          prep_time_minutes: number | null
          subtitle: string | null
          total_time_minutes: number | null
        }
        Insert: {
          calories?: number | null
          cook_time_minutes?: number | null
          created_at?: string | null
          id?: string
          image?: string | null
          ingredients?: Json | null
          instructions?: Json | null
          meal_type?: string | null
          name: string
          prep_time_minutes?: number | null
          subtitle?: string | null
          total_time_minutes?: number | null
        }
        Update: {
          calories?: number | null
          cook_time_minutes?: number | null
          created_at?: string | null
          id?: string
          image?: string | null
          ingredients?: Json | null
          instructions?: Json | null
          meal_type?: string | null
          name?: string
          prep_time_minutes?: number | null
          subtitle?: string | null
          total_time_minutes?: number | null
        }
        Relationships: []
      }
      medications: {
        Row: {
          active_ingredients: Json | null
          adverse_reactions: string | null
          contraindications: string | null
          created_at: string | null
          dosage_form: string | null
          dosage_guidelines: string | null
          generic_name: string | null
          id: string
          indications: string | null
          is_verified: boolean | null
          manufacturer: string | null
          ndc_code: string | null
          proprietary_name: string | null
          safety_assessment: Json | null
          strength: string | null
          updated_at: string | null
          warnings: string | null
        }
        Insert: {
          active_ingredients?: Json | null
          adverse_reactions?: string | null
          contraindications?: string | null
          created_at?: string | null
          dosage_form?: string | null
          dosage_guidelines?: string | null
          generic_name?: string | null
          id?: string
          indications?: string | null
          is_verified?: boolean | null
          manufacturer?: string | null
          ndc_code?: string | null
          proprietary_name?: string | null
          safety_assessment?: Json | null
          strength?: string | null
          updated_at?: string | null
          warnings?: string | null
        }
        Update: {
          active_ingredients?: Json | null
          adverse_reactions?: string | null
          contraindications?: string | null
          created_at?: string | null
          dosage_form?: string | null
          dosage_guidelines?: string | null
          generic_name?: string | null
          id?: string
          indications?: string | null
          is_verified?: boolean | null
          manufacturer?: string | null
          ndc_code?: string | null
          proprietary_name?: string | null
          safety_assessment?: Json | null
          strength?: string | null
          updated_at?: string | null
          warnings?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          is_delivered: boolean | null
          is_read: boolean | null
          message_type: string | null
          metadata: Json | null
          pending_analysis_id: string | null
          read_at: string | null
          sender_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_delivered?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          pending_analysis_id?: string | null
          read_at?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_delivered?: boolean | null
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          pending_analysis_id?: string | null
          read_at?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pending_analysis_id_fkey"
            columns: ["pending_analysis_id"]
            isOneToOne: false
            referencedRelation: "food_analysis_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          adherence_percentage: number | null
          created_at: string | null
          id: string
          insights: Json | null
          report_month: number
          report_year: number
          spending_efficiency: string | null
          summary: string | null
          tips: Json | null
          trend: string | null
          user_id: string | null
        }
        Insert: {
          adherence_percentage?: number | null
          created_at?: string | null
          id?: string
          insights?: Json | null
          report_month: number
          report_year: number
          spending_efficiency?: string | null
          summary?: string | null
          tips?: Json | null
          trend?: string | null
          user_id?: string | null
        }
        Update: {
          adherence_percentage?: number | null
          created_at?: string | null
          id?: string
          insights?: Json | null
          report_month?: number
          report_year?: number
          spending_efficiency?: string | null
          summary?: string | null
          tips?: Json | null
          trend?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          notification_type: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_responses: {
        Row: {
          activity_level: string | null
          age: number | null
          budget: number | null
          calorie_flexibility: string | null
          carbs_goal: number | null
          cooking_skill: string | null
          created_at: string | null
          daily_calorie_goal: number | null
          daily_meal_frequency: string | null
          dietary_lifestyle: Json | null
          fat_goal: number | null
          fiber_goal: number | null
          full_name: string | null
          gender: string | null
          goal: string | null
          health_conditions: string | null
          height_cm: number | null
          id: string
          liked_foods: Json | null
          meal_prep_time: string | null
          medical_conditions: string | null
          onboarding_completed: boolean | null
          preferences: Json | null
          preferred_cuisines: Json | null
          protein_goal: number | null
          restrictions: Json | null
          sugar_goal: number | null
          target: number | null
          updated_at: string | null
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          budget?: number | null
          calorie_flexibility?: string | null
          carbs_goal?: number | null
          cooking_skill?: string | null
          created_at?: string | null
          daily_calorie_goal?: number | null
          daily_meal_frequency?: string | null
          dietary_lifestyle?: Json | null
          fat_goal?: number | null
          fiber_goal?: number | null
          full_name?: string | null
          gender?: string | null
          goal?: string | null
          health_conditions?: string | null
          height_cm?: number | null
          id?: string
          liked_foods?: Json | null
          meal_prep_time?: string | null
          medical_conditions?: string | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          preferred_cuisines?: Json | null
          protein_goal?: number | null
          restrictions?: Json | null
          sugar_goal?: number | null
          target?: number | null
          updated_at?: string | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          budget?: number | null
          calorie_flexibility?: string | null
          carbs_goal?: number | null
          cooking_skill?: string | null
          created_at?: string | null
          daily_calorie_goal?: number | null
          daily_meal_frequency?: string | null
          dietary_lifestyle?: Json | null
          fat_goal?: number | null
          fiber_goal?: number | null
          full_name?: string | null
          gender?: string | null
          goal?: string | null
          health_conditions?: string | null
          height_cm?: number | null
          id?: string
          liked_foods?: Json | null
          meal_prep_time?: string | null
          medical_conditions?: string | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          preferred_cuisines?: Json | null
          protein_goal?: number | null
          restrictions?: Json | null
          sugar_goal?: number | null
          target?: number | null
          updated_at?: string | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category_tags: string[] | null
          country_of_origin: string | null
          created_at: string | null
          id: string
          manufacturer: string | null
          name: string
          nutritional_data: Json | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          category_tags?: string[] | null
          country_of_origin?: string | null
          created_at?: string | null
          id?: string
          manufacturer?: string | null
          name: string
          nutritional_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          category_tags?: string[] | null
          country_of_origin?: string | null
          created_at?: string | null
          id?: string
          manufacturer?: string | null
          name?: string
          nutritional_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_measurements: {
        Row: {
          created_at: string | null
          height: number | null
          id: string
          measurement_date: string
          notes: string | null
          user_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string | null
          height?: number | null
          id?: string
          measurement_date: string
          notes?: string | null
          user_id?: string | null
          weight: number
        }
        Update: {
          created_at?: string | null
          height?: number | null
          id?: string
          measurement_date?: string
          notes?: string | null
          user_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "progress_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          carbs_g: number | null
          cook_time_minutes: number | null
          created_at: string | null
          cuisine_type: string | null
          description: string | null
          dietary_tags: Json | null
          difficulty: string | null
          fat_g: number | null
          id: string
          image_url: string | null
          ingredients: Json | null
          instructions: Json | null
          prep_time_minutes: number | null
          protein_g: number | null
          spoonacular_id: string | null
          step_images: Json | null
          title: string
          total_calories: number | null
        }
        Insert: {
          carbs_g?: number | null
          cook_time_minutes?: number | null
          created_at?: string | null
          cuisine_type?: string | null
          description?: string | null
          dietary_tags?: Json | null
          difficulty?: string | null
          fat_g?: number | null
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          instructions?: Json | null
          prep_time_minutes?: number | null
          protein_g?: number | null
          spoonacular_id?: string | null
          step_images?: Json | null
          title: string
          total_calories?: number | null
        }
        Update: {
          carbs_g?: number | null
          cook_time_minutes?: number | null
          created_at?: string | null
          cuisine_type?: string | null
          description?: string | null
          dietary_tags?: Json | null
          difficulty?: string | null
          fat_g?: number | null
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          instructions?: Json | null
          prep_time_minutes?: number | null
          protein_g?: number | null
          spoonacular_id?: string | null
          step_images?: Json | null
          title?: string
          total_calories?: number | null
        }
        Relationships: []
      }
      regional_configuration: {
        Row: {
          budget_tiers: Json | null
          cost_of_living_index: number | null
          country_code: string
          country_name: string
          currency_code: string
          currency_symbol: string
          decimal_separator: string | null
          last_updated: string | null
          thousands_separator: string | null
        }
        Insert: {
          budget_tiers?: Json | null
          cost_of_living_index?: number | null
          country_code: string
          country_name: string
          currency_code: string
          currency_symbol: string
          decimal_separator?: string | null
          last_updated?: string | null
          thousands_separator?: string | null
        }
        Update: {
          budget_tiers?: Json | null
          cost_of_living_index?: number | null
          country_code?: string
          country_name?: string
          currency_code?: string
          currency_symbol?: string
          decimal_separator?: string | null
          last_updated?: string | null
          thousands_separator?: string | null
        }
        Relationships: []
      }
      regional_pricing: {
        Row: {
          barcode: string | null
          country_code: string
          created_at: string | null
          currency_code: string
          currency_symbol: string | null
          id: string
          price: number
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          country_code: string
          created_at?: string | null
          currency_code?: string
          currency_symbol?: string | null
          id?: string
          price: number
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          country_code?: string
          created_at?: string | null
          currency_code?: string
          currency_symbol?: string | null
          id?: string
          price?: number
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regional_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_content: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          reference: string | null
          type: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          reference?: string | null
          type?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          reference?: string | null
          type?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          status?: string | null
        }
        Relationships: []
      }
      user_budgets: {
        Row: {
          created_at: string | null
          currency: string | null
          currency_symbol: string | null
          current_balance: number
          id: string
          is_active: boolean | null
          period_end: string
          period_start: string
          remaining_budget: number | null
          total_budget: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          currency_symbol?: string | null
          current_balance: number
          id?: string
          is_active?: boolean | null
          period_end: string
          period_start: string
          remaining_budget?: number | null
          total_budget: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          currency_symbol?: string | null
          current_balance?: number
          id?: string
          is_active?: boolean | null
          period_end?: string
          period_start?: string
          remaining_budget?: number | null
          total_budget?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_milestones: {
        Row: {
          ai_analysis: string | null
          created_at: string | null
          id: string
          milestone_date: string
          objective: string | null
          plan_suggestion: string | null
          problems_faced: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string | null
          id?: string
          milestone_date: string
          objective?: string | null
          plan_suggestion?: string | null
          problems_faced?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string | null
          id?: string
          milestone_date?: string
          objective?: string | null
          plan_suggestion?: string | null
          problems_faced?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          activity_level: string | null
          avatar_url: string | null
          created_at: string | null
          daily_carbs_goal_g: number | null
          daily_fat_goal_g: number | null
          daily_protein_goal_g: number | null
          date_of_birth: string | null
          dietary_preferences: Json | null
          email: string | null
          email_verified: boolean | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          goal_calories: number | null
          health_conditions: Json | null
          height_cm: number | null
          id: string
          last_name: string | null
          location_metadata: Json | null
          onboarding_complete: boolean | null
          onboarding_completed: boolean | null
          search_vector: unknown
          updated_at: string | null
          username: string | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          avatar_url?: string | null
          created_at?: string | null
          daily_carbs_goal_g?: number | null
          daily_fat_goal_g?: number | null
          daily_protein_goal_g?: number | null
          date_of_birth?: string | null
          dietary_preferences?: Json | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          goal_calories?: number | null
          health_conditions?: Json | null
          height_cm?: number | null
          id: string
          last_name?: string | null
          location_metadata?: Json | null
          onboarding_complete?: boolean | null
          onboarding_completed?: boolean | null
          search_vector?: unknown
          updated_at?: string | null
          username?: string | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          avatar_url?: string | null
          created_at?: string | null
          daily_carbs_goal_g?: number | null
          daily_fat_goal_g?: number | null
          daily_protein_goal_g?: number | null
          date_of_birth?: string | null
          dietary_preferences?: Json | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          goal_calories?: number | null
          health_conditions?: Json | null
          height_cm?: number | null
          id?: string
          last_name?: string | null
          location_metadata?: Json | null
          onboarding_complete?: boolean | null
          onboarding_completed?: boolean | null
          search_vector?: unknown
          updated_at?: string | null
          username?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_recipe_interactions: {
        Row: {
          id: string
          interacted_at: string | null
          interaction_type: string
          notes: string | null
          rating: number | null
          recipe_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          interacted_at?: string | null
          interaction_type: string
          notes?: string | null
          rating?: number | null
          recipe_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          interacted_at?: string | null
          interaction_type?: string
          notes?: string | null
          rating?: number | null
          recipe_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_recipe_interactions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_recipe_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          country_code: string | null
          created_at: string | null
          currency: string | null
          id: string
          is_language_auto: boolean | null
          language: string | null
          push_notifications_enabled: boolean | null
          subscription_expires_at: string | null
          subscription_status: string | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_language_auto?: boolean | null
          language?: string | null
          push_notifications_enabled?: boolean | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_language_auto?: boolean | null
          language?: string | null
          push_notifications_enabled?: boolean | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_spiritual_history: {
        Row: {
          content_id: string | null
          id: string
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          content_id?: string | null
          id?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          content_id?: string | null
          id?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_spiritual_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "spiritual_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_spiritual_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_budget_status: {
        Row: { user_id: string; monthly_budget: number; days_in_month: number; daily_allowance: number; }
        Relationships: []
      }
    }
    Functions: {
      add_contact_and_chat:
        | { Args: { p_contact_id: string; p_user_id: string }; Returns: Json }
        | {
            Args: { p_contact_id: string; p_user_id: string }
            Returns: {
              contact_name: string
              conversation_id: string
            }[]
          }
      add_contact_pure: {
        Args: { p_contact_id: string; p_user_id: string }
        Returns: undefined
      }
      check_auth_user_by_phone: {
        Args: { p_phone: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      check_conversation_access: {
        Args: { p_conv_id: string; p_user_id: string }
        Returns: boolean
      }
      check_conversation_participation: {
        Args: { conv_id: string }
        Returns: boolean
      }
      current_user_conversation_ids: { Args: never; Returns: string[] }
      diagnostic_find_phone: { Args: { p_phone: string }; Returns: Json }
      find_conversation_by_participants: {
        Args: { p_user1: string; p_user2: string }
        Returns: {
          id: string
        }[]
      }
      find_user_by_identifier: {
        Args: { p_identifier: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          is_verified: boolean
          phone_number: string
        }[]
      }
      get_or_create_conversation: {
        Args: { p_other_id: string; p_user_id: string }
        Returns: string
      }
      get_unread_count: { Args: { p_user_id: string }; Returns: number }
      is_conversation_participant: {
        Args: { conv_id: string; user_id_text: string }
        Returns: boolean
      }
      is_member_of: { Args: { p_conv_id: string }; Returns: boolean }
      provision_and_send_message: {
        Args: {
          p_content: string
          p_message_type?: string
          p_metadata?: Json
          p_receiver_id: string
          p_sender_id: string
        }
        Returns: string
      }
      provision_user_system_chats: {
        Args: { p_user_id: string }
        Returns: Json
      }
      resolve_chat_contact: {
        Args: { p_identifier: string; p_is_id?: boolean }
        Returns: {
          r_avatar_url: string
          r_full_name: string
          r_id: string
          r_phone_number: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

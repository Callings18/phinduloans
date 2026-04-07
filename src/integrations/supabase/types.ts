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
      account_transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          destination: string | null
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          source: string | null
          transaction_type: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          transaction_type: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string
          balance: number
          created_at: string
          currency: string
          id: string
          is_active: boolean | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      application_documents: {
        Row: {
          application_id: string
          borrower_id: string
          created_at: string
          doc_label: string
          doc_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_required: boolean | null
          loan_product_id: string | null
          mime_type: string | null
          month_tag: string | null
          notes: string | null
          payslip_password: string | null
          status: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          borrower_id: string
          created_at?: string
          doc_label: string
          doc_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_required?: boolean | null
          loan_product_id?: string | null
          mime_type?: string | null
          month_tag?: string | null
          notes?: string | null
          payslip_password?: string | null
          status?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          borrower_id?: string
          created_at?: string
          doc_label?: string
          doc_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_required?: boolean | null
          loan_product_id?: string | null
          mime_type?: string | null
          month_tag?: string | null
          notes?: string | null
          payslip_password?: string | null
          status?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "application_documents_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      borrower_document_vault: {
        Row: {
          borrower_id: string
          created_at: string
          doc_label: string
          doc_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_verified: boolean | null
          mime_type: string | null
          notes: string | null
          updated_at: string
          uploaded_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          borrower_id: string
          created_at?: string
          doc_label: string
          doc_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          borrower_id?: string
          created_at?: string
          doc_label?: string
          doc_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      borrower_kyc_info: {
        Row: {
          account_type: string | null
          admin_notes: string | null
          airtel_money_number: string | null
          bank_account_holder_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          borrower_id: string
          created_at: string | null
          id: string
          is_verified: boolean | null
          mobile_money_account_name: string | null
          mtn_mobile_money_number: string | null
          nok_address: string | null
          nok_alt_phone: string | null
          nok_district: string | null
          nok_full_name: string | null
          nok_nrc_number: string | null
          nok_phone: string | null
          nok_relationship: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          zamtel_kwacha_number: string | null
        }
        Insert: {
          account_type?: string | null
          admin_notes?: string | null
          airtel_money_number?: string | null
          bank_account_holder_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          borrower_id: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          mobile_money_account_name?: string | null
          mtn_mobile_money_number?: string | null
          nok_address?: string | null
          nok_alt_phone?: string | null
          nok_district?: string | null
          nok_full_name?: string | null
          nok_nrc_number?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          zamtel_kwacha_number?: string | null
        }
        Update: {
          account_type?: string | null
          admin_notes?: string | null
          airtel_money_number?: string | null
          bank_account_holder_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          borrower_id?: string
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          mobile_money_account_name?: string | null
          mtn_mobile_money_number?: string | null
          nok_address?: string | null
          nok_alt_phone?: string | null
          nok_district?: string | null
          nok_full_name?: string | null
          nok_nrc_number?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          zamtel_kwacha_number?: string | null
        }
        Relationships: []
      }
      borrower_references: {
        Row: {
          address: string | null
          alt_phone: string | null
          borrower_id: string
          created_at: string | null
          full_name: string
          id: string
          is_verified: boolean | null
          occupation: string | null
          phone: string
          relationship: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
          years_known: number | null
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          borrower_id: string
          created_at?: string | null
          full_name: string
          id?: string
          is_verified?: boolean | null
          occupation?: string | null
          phone: string
          relationship: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          years_known?: number | null
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          borrower_id?: string
          created_at?: string | null
          full_name?: string
          id?: string
          is_verified?: boolean | null
          occupation?: string | null
          phone?: string
          relationship?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          years_known?: number | null
        }
        Relationships: []
      }
      brevo_whatsapp_templates: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          is_active: boolean | null
          template_id: string
          template_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          template_id: string
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          template_id?: string
          template_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      collection_activities: {
        Row: {
          activity_type: string
          assigned_to: string | null
          contact_method: string | null
          created_at: string
          escalation_level: number | null
          follow_up_date: string | null
          id: string
          loan_id: string
          notes: string | null
          outcome: string | null
          promise_amount: number | null
          promise_date: string | null
          ptp_status: string | null
          repayment_id: string | null
          staff_id: string | null
        }
        Insert: {
          activity_type: string
          assigned_to?: string | null
          contact_method?: string | null
          created_at?: string
          escalation_level?: number | null
          follow_up_date?: string | null
          id?: string
          loan_id: string
          notes?: string | null
          outcome?: string | null
          promise_amount?: number | null
          promise_date?: string | null
          ptp_status?: string | null
          repayment_id?: string | null
          staff_id?: string | null
        }
        Update: {
          activity_type?: string
          assigned_to?: string | null
          contact_method?: string | null
          created_at?: string
          escalation_level?: number | null
          follow_up_date?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          outcome?: string | null
          promise_amount?: number | null
          promise_date?: string | null
          ptp_status?: string | null
          repayment_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_activities_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_activities_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "collection_activities_repayment_id_fkey"
            columns: ["repayment_id"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          collector_id: string
          created_at: string
          id: string
          last_contact_at: string | null
          loan_id: string
          next_action_date: string | null
          notes: string | null
          priority: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          collector_id: string
          created_at?: string
          id?: string
          last_contact_at?: string | null
          loan_id: string
          next_action_date?: string | null
          notes?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          collector_id?: string
          created_at?: string
          id?: string
          last_contact_at?: string | null
          loan_id?: string
          next_action_date?: string | null
          notes?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_assignments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_assignments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      commission_calculations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commission_amount: number
          commission_rate: number
          created_at: string | null
          employee_id: string
          id: string
          loan_amount: number
          loan_id: string | null
          period_end: string
          period_start: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string | null
          employee_id: string
          id?: string
          loan_amount?: number
          loan_id?: string | null
          period_end: string
          period_start: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string | null
          employee_id?: string
          id?: string
          loan_amount?: number
          loan_id?: string | null
          period_end?: string
          period_start?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_calculations_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_calculations_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string | null
          created_at: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          loan_product_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          loan_product_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          loan_product_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      court_case_events: {
        Row: {
          court_case_id: string
          created_at: string
          created_by: string | null
          description: string | null
          documents_url: string | null
          event_date: string
          event_type: string
          id: string
          next_action: string | null
          next_action_date: string | null
          outcome: string | null
        }
        Insert: {
          court_case_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents_url?: string | null
          event_date?: string
          event_type: string
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          outcome?: string | null
        }
        Update: {
          court_case_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents_url?: string | null
          event_date?: string
          event_type?: string
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_case_events_court_case_id_fkey"
            columns: ["court_case_id"]
            isOneToOne: false
            referencedRelation: "court_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      court_cases: {
        Row: {
          assigned_lawyer: string | null
          case_number: string | null
          case_type: string
          claim_amount: number | null
          court_location: string | null
          court_name: string | null
          created_at: string
          created_by: string | null
          defendant_name: string | null
          enforcement_status: string | null
          filing_date: string | null
          hearing_date: string | null
          id: string
          judgment_amount: number | null
          judgment_date: string | null
          lawyer_contact: string | null
          legal_fees: number | null
          loan_id: string
          next_hearing_date: string | null
          notes: string | null
          plaintiff_name: string | null
          recovered_amount: number | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_lawyer?: string | null
          case_number?: string | null
          case_type?: string
          claim_amount?: number | null
          court_location?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          defendant_name?: string | null
          enforcement_status?: string | null
          filing_date?: string | null
          hearing_date?: string | null
          id?: string
          judgment_amount?: number | null
          judgment_date?: string | null
          lawyer_contact?: string | null
          legal_fees?: number | null
          loan_id: string
          next_hearing_date?: string | null
          notes?: string | null
          plaintiff_name?: string | null
          recovered_amount?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_lawyer?: string | null
          case_number?: string | null
          case_type?: string
          claim_amount?: number | null
          court_location?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          defendant_name?: string | null
          enforcement_status?: string | null
          filing_date?: string | null
          hearing_date?: string | null
          id?: string
          judgment_amount?: number | null
          judgment_date?: string | null
          lawyer_contact?: string | null
          legal_fees?: number | null
          loan_id?: string
          next_hearing_date?: string | null
          notes?: string | null
          plaintiff_name?: string | null
          recovered_amount?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_cases_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_cases_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      crb_requests: {
        Row: {
          blacklist_flag: boolean | null
          borrower_id: string
          consent_obtained: boolean | null
          consent_timestamp: string | null
          created_at: string | null
          created_by: string | null
          credit_score: number | null
          error_message: string | null
          id: string
          loan_application_id: string | null
          nrc_number: string
          provider: string | null
          request_payload: Json | null
          request_type: string
          response_payload: Json | null
          risk_rating: string | null
          status: string | null
        }
        Insert: {
          blacklist_flag?: boolean | null
          borrower_id: string
          consent_obtained?: boolean | null
          consent_timestamp?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_score?: number | null
          error_message?: string | null
          id?: string
          loan_application_id?: string | null
          nrc_number: string
          provider?: string | null
          request_payload?: Json | null
          request_type: string
          response_payload?: Json | null
          risk_rating?: string | null
          status?: string | null
        }
        Update: {
          blacklist_flag?: boolean | null
          borrower_id?: string
          consent_obtained?: boolean | null
          consent_timestamp?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_score?: number | null
          error_message?: string | null
          id?: string
          loan_application_id?: string | null
          nrc_number?: string
          provider?: string | null
          request_payload?: Json | null
          request_type?: string
          response_payload?: Json | null
          risk_rating?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crb_requests_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crb_requests_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      demand_letters: {
        Row: {
          amount_demanded: number | null
          created_at: string
          delivery_status: string | null
          due_date: string | null
          file_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          letter_type: string
          loan_id: string
          response_date: string | null
          response_notes: string | null
          response_received: boolean | null
          sent_at: string | null
          sent_via: string | null
        }
        Insert: {
          amount_demanded?: number | null
          created_at?: string
          delivery_status?: string | null
          due_date?: string | null
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          letter_type?: string
          loan_id: string
          response_date?: string | null
          response_notes?: string | null
          response_received?: boolean | null
          sent_at?: string | null
          sent_via?: string | null
        }
        Update: {
          amount_demanded?: number | null
          created_at?: string
          delivery_status?: string | null
          due_date?: string | null
          file_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          letter_type?: string
          loan_id?: string
          response_date?: string | null
          response_notes?: string | null
          response_received?: boolean | null
          sent_at?: string | null
          sent_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_letters_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_letters_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      disbursements: {
        Row: {
          account_number: string | null
          amount: number
          created_at: string
          disbursed_at: string | null
          disbursement_method: string
          id: string
          loan_id: string
          mobile_money_number: string | null
          source_account_id: string | null
          status: string | null
          transaction_reference: string | null
        }
        Insert: {
          account_number?: string | null
          amount: number
          created_at?: string
          disbursed_at?: string | null
          disbursement_method: string
          id?: string
          loan_id: string
          mobile_money_number?: string | null
          source_account_id?: string | null
          status?: string | null
          transaction_reference?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number
          created_at?: string
          disbursed_at?: string | null
          disbursement_method?: string
          id?: string
          loan_id?: string
          mobile_money_number?: string | null
          source_account_id?: string | null
          status?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disbursements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "disbursements_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      document_checklists: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          file_url: string | null
          id: string
          is_required: boolean | null
          is_submitted: boolean | null
          is_verified: boolean | null
          loan_id: string
          notes: string | null
          rejection_reason: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          file_url?: string | null
          id?: string
          is_required?: boolean | null
          is_submitted?: boolean | null
          is_verified?: boolean | null
          loan_id: string
          notes?: string | null
          rejection_reason?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          file_url?: string | null
          id?: string
          is_required?: boolean | null
          is_submitted?: boolean | null
          is_verified?: boolean | null
          loan_id?: string
          notes?: string | null
          rejection_reason?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_checklists_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklists_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          branch: string | null
          city: string | null
          commission_percentage: number | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          email: string | null
          employee_number: string | null
          employment_start_date: string | null
          employment_type: string | null
          first_name: string | null
          full_name: string
          hire_date: string | null
          housing_allowance: number | null
          id: string
          is_active: boolean | null
          last_name: string | null
          lunch_allowance: number | null
          napsa_number: string | null
          nhima_number: string | null
          nrc_number: string | null
          other_allowances: number | null
          payment_method: string | null
          phone: string | null
          position: string | null
          salary: number | null
          tpin: string | null
          transport_allowance: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          branch?: string | null
          city?: string | null
          commission_percentage?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          employee_number?: string | null
          employment_start_date?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name: string
          hire_date?: string | null
          housing_allowance?: number | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          lunch_allowance?: number | null
          napsa_number?: string | null
          nhima_number?: string | null
          nrc_number?: string | null
          other_allowances?: number | null
          payment_method?: string | null
          phone?: string | null
          position?: string | null
          salary?: number | null
          tpin?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          branch?: string | null
          city?: string | null
          commission_percentage?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          employee_number?: string | null
          employment_start_date?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name?: string
          hire_date?: string | null
          housing_allowance?: number | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          lunch_allowance?: number | null
          napsa_number?: string | null
          nhima_number?: string | null
          nrc_number?: string | null
          other_allowances?: number | null
          payment_method?: string | null
          phone?: string | null
          position?: string | null
          salary?: number | null
          tpin?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      employers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          is_verified: boolean | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_verified?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_verified?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          branch: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_category: string
          expense_date: string
          id: string
          loan_id: string | null
          paid_at: string | null
          payment_method: string
          status: string
          updated_at: string
          vendor_payee: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category: string
          expense_date?: string
          id?: string
          loan_id?: string | null
          paid_at?: string | null
          payment_method?: string
          status?: string
          updated_at?: string
          vendor_payee: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          branch?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category?: string
          expense_date?: string
          id?: string
          loan_id?: string | null
          paid_at?: string | null
          payment_method?: string
          status?: string
          updated_at?: string
          vendor_payee?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      guarantees: {
        Row: {
          admin_override: boolean | null
          approval_date: string | null
          approved_by: string | null
          conditions: Json | null
          created_at: string | null
          eligibility_code: string | null
          guarantee_fee: number | null
          guarantee_provider: string
          guaranteed_amount: number | null
          guaranteed_percentage: number | null
          id: string
          loan_id: string
          override_reason: string | null
          reference_code: string | null
          response_payload: Json | null
          status: string | null
          updated_at: string | null
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          admin_override?: boolean | null
          approval_date?: string | null
          approved_by?: string | null
          conditions?: Json | null
          created_at?: string | null
          eligibility_code?: string | null
          guarantee_fee?: number | null
          guarantee_provider: string
          guaranteed_amount?: number | null
          guaranteed_percentage?: number | null
          id?: string
          loan_id: string
          override_reason?: string | null
          reference_code?: string | null
          response_payload?: Json | null
          status?: string | null
          updated_at?: string | null
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          admin_override?: boolean | null
          approval_date?: string | null
          approved_by?: string | null
          conditions?: Json | null
          created_at?: string | null
          eligibility_code?: string | null
          guarantee_fee?: number | null
          guarantee_provider?: string
          guaranteed_amount?: number | null
          guaranteed_percentage?: number | null
          id?: string
          loan_id?: string
          override_reason?: string | null
          reference_code?: string | null
          response_payload?: Json | null
          status?: string | null
          updated_at?: string | null
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guarantees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          address: string | null
          admin_notes: string | null
          admin_signed: boolean | null
          admin_signed_at: string | null
          admin_signed_by: string | null
          approval_stage: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          bank_statement_url: string | null
          borrower_signed: boolean | null
          borrower_signed_at: string | null
          city: string | null
          collateral_description: string | null
          collateral_image_2_url: string | null
          collateral_image_3_url: string | null
          collateral_image_url: string | null
          collateral_value: number | null
          contract_fully_signed_at: string | null
          contract_url: string | null
          crb_consent: boolean | null
          crb_consent_timestamp: string | null
          created_at: string
          date_of_birth: string | null
          defaulted_at: string | null
          disbursed_at: string | null
          disbursed_by: string | null
          document_verified_at: string | null
          document_verified_by: string | null
          early_settlement_fee: number | null
          email: string
          employer_id: string | null
          employer_letter_url: string | null
          employer_name: string | null
          employment_duration: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          enforcement_fees: number | null
          finance_verified_at: string | null
          finance_verified_by: string | null
          full_name: string
          id: string
          interest_rate: number | null
          job_title: string | null
          legal_fees: number | null
          legal_referred_at: string | null
          loan_amount: number
          loan_product_id: string | null
          loan_purpose: string
          loan_term_months: number
          monthly_income: number
          monthly_payment: number | null
          nrc_back_url: string | null
          nrc_front_url: string | null
          nrc_number: string
          parent_loan_id: string | null
          payslip_2_url: string | null
          payslip_3_url: string | null
          payslip_password: string | null
          payslip_url: string | null
          penalty_count: number | null
          phone: string
          product_specific_data: Json | null
          recommended_at: string | null
          recommended_by: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          settlement_date: string | null
          settlement_type: string | null
          signed_contract_uploaded_at: string | null
          signed_contract_url: string | null
          source: string | null
          status: Database["public"]["Enums"]["loan_status"]
          term_unit: string
          total_penalties: number | null
          total_repayment: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          admin_signed?: boolean | null
          admin_signed_at?: string | null
          admin_signed_by?: string | null
          approval_stage?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          bank_statement_url?: string | null
          borrower_signed?: boolean | null
          borrower_signed_at?: string | null
          city?: string | null
          collateral_description?: string | null
          collateral_image_2_url?: string | null
          collateral_image_3_url?: string | null
          collateral_image_url?: string | null
          collateral_value?: number | null
          contract_fully_signed_at?: string | null
          contract_url?: string | null
          crb_consent?: boolean | null
          crb_consent_timestamp?: string | null
          created_at?: string
          date_of_birth?: string | null
          defaulted_at?: string | null
          disbursed_at?: string | null
          disbursed_by?: string | null
          document_verified_at?: string | null
          document_verified_by?: string | null
          early_settlement_fee?: number | null
          email: string
          employer_id?: string | null
          employer_letter_url?: string | null
          employer_name?: string | null
          employment_duration?: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          enforcement_fees?: number | null
          finance_verified_at?: string | null
          finance_verified_by?: string | null
          full_name: string
          id?: string
          interest_rate?: number | null
          job_title?: string | null
          legal_fees?: number | null
          legal_referred_at?: string | null
          loan_amount: number
          loan_product_id?: string | null
          loan_purpose: string
          loan_term_months: number
          monthly_income: number
          monthly_payment?: number | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_number: string
          parent_loan_id?: string | null
          payslip_2_url?: string | null
          payslip_3_url?: string | null
          payslip_password?: string | null
          payslip_url?: string | null
          penalty_count?: number | null
          phone: string
          product_specific_data?: Json | null
          recommended_at?: string | null
          recommended_by?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          settlement_date?: string | null
          settlement_type?: string | null
          signed_contract_uploaded_at?: string | null
          signed_contract_url?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          term_unit?: string
          total_penalties?: number | null
          total_repayment?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          admin_signed?: boolean | null
          admin_signed_at?: string | null
          admin_signed_by?: string | null
          approval_stage?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          bank_statement_url?: string | null
          borrower_signed?: boolean | null
          borrower_signed_at?: string | null
          city?: string | null
          collateral_description?: string | null
          collateral_image_2_url?: string | null
          collateral_image_3_url?: string | null
          collateral_image_url?: string | null
          collateral_value?: number | null
          contract_fully_signed_at?: string | null
          contract_url?: string | null
          crb_consent?: boolean | null
          crb_consent_timestamp?: string | null
          created_at?: string
          date_of_birth?: string | null
          defaulted_at?: string | null
          disbursed_at?: string | null
          disbursed_by?: string | null
          document_verified_at?: string | null
          document_verified_by?: string | null
          early_settlement_fee?: number | null
          email?: string
          employer_id?: string | null
          employer_letter_url?: string | null
          employer_name?: string | null
          employment_duration?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          enforcement_fees?: number | null
          finance_verified_at?: string | null
          finance_verified_by?: string | null
          full_name?: string
          id?: string
          interest_rate?: number | null
          job_title?: string | null
          legal_fees?: number | null
          legal_referred_at?: string | null
          loan_amount?: number
          loan_product_id?: string | null
          loan_purpose?: string
          loan_term_months?: number
          monthly_income?: number
          monthly_payment?: number | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_number?: string
          parent_loan_id?: string | null
          payslip_2_url?: string | null
          payslip_3_url?: string | null
          payslip_password?: string | null
          payslip_url?: string | null
          penalty_count?: number | null
          phone?: string
          product_specific_data?: Json | null
          recommended_at?: string | null
          recommended_by?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          settlement_date?: string | null
          settlement_type?: string | null
          signed_contract_uploaded_at?: string | null
          signed_contract_url?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          term_unit?: string
          total_penalties?: number | null
          total_repayment?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_parent_loan_id_fkey"
            columns: ["parent_loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_parent_loan_id_fkey"
            columns: ["parent_loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_collateral_images: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_order: number
          image_url: string
          loan_application_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_order?: number
          image_url: string
          loan_application_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_order?: number
          image_url?: string
          loan_application_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_collateral_images_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_collateral_images_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_events: {
        Row: {
          amount: number | null
          created_at: string
          document_url: string | null
          event_type: string
          fees_charged: number | null
          id: string
          loan_id: string
          net_amount: number | null
          new_loan_id: string | null
          new_values: Json | null
          performed_at: string
          performed_by: string | null
          previous_values: Json | null
          reason: string | null
          source_account_id: string | null
          visibility: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          document_url?: string | null
          event_type: string
          fees_charged?: number | null
          id?: string
          loan_id: string
          net_amount?: number | null
          new_loan_id?: string | null
          new_values?: Json | null
          performed_at?: string
          performed_by?: string | null
          previous_values?: Json | null
          reason?: string | null
          source_account_id?: string | null
          visibility?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          document_url?: string | null
          event_type?: string
          fees_charged?: number | null
          id?: string
          loan_id?: string
          net_amount?: number | null
          new_loan_id?: string | null
          new_values?: Json | null
          performed_at?: string
          performed_by?: string | null
          previous_values?: Json | null
          reason?: string | null
          source_account_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_events_new_loan_id_fkey"
            columns: ["new_loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_events_new_loan_id_fkey"
            columns: ["new_loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_events_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_guarantors: {
        Row: {
          address: string | null
          city: string | null
          consent_date: string | null
          consent_signed: boolean | null
          created_at: string
          email: string | null
          employer_name: string | null
          employment_status: string | null
          full_name: string
          id: string
          is_verified: boolean | null
          loan_id: string
          monthly_income: number | null
          nrc_back_url: string | null
          nrc_front_url: string | null
          nrc_number: string | null
          phone: string
          relationship: string
          updated_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          consent_date?: string | null
          consent_signed?: boolean | null
          created_at?: string
          email?: string | null
          employer_name?: string | null
          employment_status?: string | null
          full_name: string
          id?: string
          is_verified?: boolean | null
          loan_id: string
          monthly_income?: number | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_number?: string | null
          phone: string
          relationship: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          consent_date?: string | null
          consent_signed?: boolean | null
          created_at?: string
          email?: string | null
          employer_name?: string | null
          employment_status?: string | null
          full_name?: string
          id?: string
          is_verified?: boolean | null
          loan_id?: string
          monthly_income?: number | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_number?: string | null
          phone?: string
          relationship?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_guarantors_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_guarantors_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_notes: {
        Row: {
          created_at: string | null
          id: string
          is_internal: boolean | null
          loan_id: string
          note: string
          note_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          loan_id: string
          note: string
          note_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          loan_id?: string
          note?: string
          note_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_notes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_notes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_products: {
        Row: {
          amount_logic: string | null
          auto_disbursement: boolean | null
          blacklist_check_required: boolean | null
          channels: string[] | null
          collateral_required: boolean | null
          contract_template_url: string | null
          crb_auto_approve_score: number | null
          crb_auto_decline_score: number | null
          crb_check_required: boolean | null
          crb_manual_review_score: number | null
          created_at: string
          default_threshold_days: number | null
          description: string | null
          digital_signature_required: boolean | null
          early_repayment_allowed: boolean | null
          early_repayment_fee_percent: number | null
          eligible_locations: string[] | null
          employer_whitelist_enabled: boolean | null
          employment_types: string[] | null
          enforcement_fee_percent: number | null
          flat_interest_mode: string | null
          grace_period_days: number | null
          guarantee_fee_percent: number | null
          guarantee_provider: string | null
          guarantee_required: boolean | null
          id: string
          installment_structure: string | null
          insurance_percent: number | null
          insurance_required: boolean | null
          interest_period: string | null
          interest_rate: number
          interest_type: string | null
          is_active: boolean | null
          late_payment_penalty_percent: number | null
          legal_escalation_days: number | null
          max_age: number | null
          max_amount: number
          max_concurrent_loans: number | null
          max_dti_ratio: number | null
          max_guarantee_percent: number | null
          max_salary_percent: number | null
          max_term_months: number
          min_age: number | null
          min_amount: number
          min_credit_score: number | null
          min_salary: number | null
          min_term_months: number
          mou_required: boolean | null
          name: string
          parent_product_id: string | null
          partial_disbursement: boolean | null
          penalty_frequency: string | null
          platform_fee_percent: number | null
          platform_fee_type: string | null
          processing_fee_percent: number | null
          product_code: string | null
          repayment_frequency: string | null
          repayment_methods: string[] | null
          required_documents: Json | null
          requirements: string[] | null
          status: string | null
          term_unit: string
          updated_at: string
          vat_percent: number | null
          version: number | null
        }
        Insert: {
          amount_logic?: string | null
          auto_disbursement?: boolean | null
          blacklist_check_required?: boolean | null
          channels?: string[] | null
          collateral_required?: boolean | null
          contract_template_url?: string | null
          crb_auto_approve_score?: number | null
          crb_auto_decline_score?: number | null
          crb_check_required?: boolean | null
          crb_manual_review_score?: number | null
          created_at?: string
          default_threshold_days?: number | null
          description?: string | null
          digital_signature_required?: boolean | null
          early_repayment_allowed?: boolean | null
          early_repayment_fee_percent?: number | null
          eligible_locations?: string[] | null
          employer_whitelist_enabled?: boolean | null
          employment_types?: string[] | null
          enforcement_fee_percent?: number | null
          flat_interest_mode?: string | null
          grace_period_days?: number | null
          guarantee_fee_percent?: number | null
          guarantee_provider?: string | null
          guarantee_required?: boolean | null
          id?: string
          installment_structure?: string | null
          insurance_percent?: number | null
          insurance_required?: boolean | null
          interest_period?: string | null
          interest_rate?: number
          interest_type?: string | null
          is_active?: boolean | null
          late_payment_penalty_percent?: number | null
          legal_escalation_days?: number | null
          max_age?: number | null
          max_amount?: number
          max_concurrent_loans?: number | null
          max_dti_ratio?: number | null
          max_guarantee_percent?: number | null
          max_salary_percent?: number | null
          max_term_months?: number
          min_age?: number | null
          min_amount?: number
          min_credit_score?: number | null
          min_salary?: number | null
          min_term_months?: number
          mou_required?: boolean | null
          name: string
          parent_product_id?: string | null
          partial_disbursement?: boolean | null
          penalty_frequency?: string | null
          platform_fee_percent?: number | null
          platform_fee_type?: string | null
          processing_fee_percent?: number | null
          product_code?: string | null
          repayment_frequency?: string | null
          repayment_methods?: string[] | null
          required_documents?: Json | null
          requirements?: string[] | null
          status?: string | null
          term_unit?: string
          updated_at?: string
          vat_percent?: number | null
          version?: number | null
        }
        Update: {
          amount_logic?: string | null
          auto_disbursement?: boolean | null
          blacklist_check_required?: boolean | null
          channels?: string[] | null
          collateral_required?: boolean | null
          contract_template_url?: string | null
          crb_auto_approve_score?: number | null
          crb_auto_decline_score?: number | null
          crb_check_required?: boolean | null
          crb_manual_review_score?: number | null
          created_at?: string
          default_threshold_days?: number | null
          description?: string | null
          digital_signature_required?: boolean | null
          early_repayment_allowed?: boolean | null
          early_repayment_fee_percent?: number | null
          eligible_locations?: string[] | null
          employer_whitelist_enabled?: boolean | null
          employment_types?: string[] | null
          enforcement_fee_percent?: number | null
          flat_interest_mode?: string | null
          grace_period_days?: number | null
          guarantee_fee_percent?: number | null
          guarantee_provider?: string | null
          guarantee_required?: boolean | null
          id?: string
          installment_structure?: string | null
          insurance_percent?: number | null
          insurance_required?: boolean | null
          interest_period?: string | null
          interest_rate?: number
          interest_type?: string | null
          is_active?: boolean | null
          late_payment_penalty_percent?: number | null
          legal_escalation_days?: number | null
          max_age?: number | null
          max_amount?: number
          max_concurrent_loans?: number | null
          max_dti_ratio?: number | null
          max_guarantee_percent?: number | null
          max_salary_percent?: number | null
          max_term_months?: number
          min_age?: number | null
          min_amount?: number
          min_credit_score?: number | null
          min_salary?: number | null
          min_term_months?: number
          mou_required?: boolean | null
          name?: string
          parent_product_id?: string | null
          partial_disbursement?: boolean | null
          penalty_frequency?: string | null
          platform_fee_percent?: number | null
          platform_fee_type?: string | null
          processing_fee_percent?: number | null
          product_code?: string | null
          repayment_frequency?: string | null
          repayment_methods?: string[] | null
          required_documents?: Json | null
          requirements?: string[] | null
          status?: string | null
          term_unit?: string
          updated_at?: string
          vat_percent?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number | null
          interest_paid: number | null
          is_reversed: boolean | null
          loan_id: string
          original_amount: number | null
          paid_date: string | null
          payment_method: string | null
          penalty_amount: number | null
          penalty_paid: number | null
          principal_paid: number | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string | null
          transaction_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number?: number | null
          interest_paid?: number | null
          is_reversed?: boolean | null
          loan_id: string
          original_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          penalty_amount?: number | null
          penalty_paid?: number | null
          principal_paid?: number | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string | null
          transaction_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number | null
          interest_paid?: number | null
          is_reversed?: boolean | null
          loan_id?: string
          original_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          penalty_amount?: number | null
          penalty_paid?: number | null
          principal_paid?: number | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string | null
          transaction_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_status_transitions: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          from_status: string
          id: string
          loan_id: string
          reason_code: string | null
          reason_text: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          from_status: string
          id?: string
          loan_id: string
          reason_code?: string | null
          reason_text?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          from_status?: string
          id?: string
          loan_id?: string
          reason_code?: string | null
          reason_text?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_status_transitions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_status_transitions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_writeoffs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          loan_id: string
          reason: string
          recovery_amount: number | null
          recovery_notes: string | null
          status: string | null
          updated_at: string
          writeoff_amount: number
          writeoff_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          loan_id: string
          reason: string
          recovery_amount?: number | null
          recovery_notes?: string | null
          status?: string | null
          updated_at?: string
          writeoff_amount: number
          writeoff_date?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          loan_id?: string
          reason?: string
          recovery_amount?: number | null
          recovery_notes?: string | null
          status?: string | null
          updated_at?: string
          writeoff_amount?: number
          writeoff_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_writeoffs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_writeoffs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          provider_response: Json | null
          recipient: string
          sent_at: string | null
          status: string | null
          subject: string | null
          title: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          provider_response?: Json | null
          recipient: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          title?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          provider_response?: Json | null
          recipient?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          title?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          created_at: string | null
          email_subject: string | null
          email_template: string | null
          event_type: string
          id: string
          is_active: boolean | null
          sms_template: string | null
          updated_at: string | null
          whatsapp_template: string | null
        }
        Insert: {
          created_at?: string | null
          email_subject?: string | null
          email_template?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          sms_template?: string | null
          updated_at?: string | null
          whatsapp_template?: string | null
        }
        Update: {
          created_at?: string | null
          email_subject?: string | null
          email_template?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          sms_template?: string | null
          updated_at?: string | null
          whatsapp_template?: string | null
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          phone: string
          purpose: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          phone: string
          purpose?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          phone?: string
          purpose?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      payment_claims: {
        Row: {
          amount: number
          created_at: string
          decision_reason_code: string | null
          id: string
          loan_id: string
          receipt_url: string | null
          reference: string
          repayment_id: string
          review_comment: string | null
          status: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          decision_reason_code?: string | null
          id?: string
          loan_id: string
          receipt_url?: string | null
          reference: string
          repayment_id: string
          review_comment?: string | null
          status?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          decision_reason_code?: string | null
          id?: string
          loan_id?: string
          receipt_url?: string | null
          reference?: string
          repayment_id?: string
          review_comment?: string | null
          status?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_claims_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_claims_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payment_claims_repayment_id_fkey"
            columns: ["repayment_id"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_settings: {
        Row: {
          api_key: string | null
          created_at: string
          environment: string | null
          gateway_name: string
          id: string
          is_active: boolean | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          environment?: string | null
          gateway_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          environment?: string | null
          gateway_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      payment_splits: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          repayment_id: string
          transaction_reference: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method: string
          repayment_id: string
          transaction_reference?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          repayment_id?: string
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_splits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_repayment_id_fkey"
            columns: ["repayment_id"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          basic_salary: number
          commission_amount: number
          created_at: string
          created_by: string | null
          employee_id: string
          gross_pay: number
          housing_allowance: number
          id: string
          loan_deduction: number
          lunch_allowance: number
          napsa_employee: number
          napsa_employer: number
          net_pay: number
          nhima_employee: number
          nhima_employer: number
          notes: string | null
          other_allowances: number
          other_deductions: number
          overtime_pay: number
          paid_at: string | null
          paye_tax: number
          payment_reference: string | null
          payroll_month: number
          payroll_run_id: string | null
          payroll_year: number
          pension_deduction: number
          status: string
          total_deductions: number
          total_employer_cost: number
          transport_allowance: number
          union_dues: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          basic_salary?: number
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          gross_pay?: number
          housing_allowance?: number
          id?: string
          loan_deduction?: number
          lunch_allowance?: number
          napsa_employee?: number
          napsa_employer?: number
          net_pay?: number
          nhima_employee?: number
          nhima_employer?: number
          notes?: string | null
          other_allowances?: number
          other_deductions?: number
          overtime_pay?: number
          paid_at?: string | null
          paye_tax?: number
          payment_reference?: string | null
          payroll_month: number
          payroll_run_id?: string | null
          payroll_year: number
          pension_deduction?: number
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          transport_allowance?: number
          union_dues?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          basic_salary?: number
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          gross_pay?: number
          housing_allowance?: number
          id?: string
          loan_deduction?: number
          lunch_allowance?: number
          napsa_employee?: number
          napsa_employer?: number
          net_pay?: number
          nhima_employee?: number
          nhima_employer?: number
          notes?: string | null
          other_allowances?: number
          other_deductions?: number
          overtime_pay?: number
          paid_at?: string | null
          paye_tax?: number
          payment_reference?: string | null
          payroll_month?: number
          payroll_run_id?: string | null
          payroll_year?: number
          pension_deduction?: number
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          transport_allowance?: number
          union_dues?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payroll_month: number
          payroll_year: number
          status: string
          total_employees: number
          total_employer_cost: number
          total_gross: number
          total_napsa: number
          total_net: number
          total_nhima: number
          total_paye: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payroll_month: number
          payroll_year: number
          status?: string
          total_employees?: number
          total_employer_cost?: number
          total_gross?: number
          total_napsa?: number
          total_net?: number
          total_nhima?: number
          total_paye?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payroll_month?: number
          payroll_year?: number
          status?: string
          total_employees?: number
          total_employer_cost?: number
          total_gross?: number
          total_napsa?: number
          total_net?: number
          total_nhima?: number
          total_paye?: number
          updated_at?: string
        }
        Relationships: []
      }
      payroll_tax_config: {
        Row: {
          band_max: number | null
          band_min: number | null
          ceiling_amount: number | null
          config_type: string
          created_at: string
          effective_from: string
          effective_to: string | null
          employee_rate_percent: number | null
          employer_rate_percent: number | null
          id: string
          is_active: boolean
          label: string | null
          notes: string | null
          rate_percent: number | null
          updated_at: string
        }
        Insert: {
          band_max?: number | null
          band_min?: number | null
          ceiling_amount?: number | null
          config_type: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_rate_percent?: number | null
          employer_rate_percent?: number | null
          id?: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          rate_percent?: number | null
          updated_at?: string
        }
        Update: {
          band_max?: number | null
          band_min?: number | null
          ceiling_amount?: number | null
          config_type?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_rate_percent?: number | null
          employer_rate_percent?: number | null
          id?: string
          is_active?: boolean
          label?: string | null
          notes?: string | null
          rate_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      pmic_borrower_enrollments: {
        Row: {
          available_deduction_capacity: number | null
          borrower_id: string
          created_at: string | null
          department: string | null
          employee_number: string
          employer_id: string | null
          enrolled_at: string | null
          enrollment_status: string | null
          existing_deductions: number | null
          gross_salary: number | null
          id: string
          net_salary: number | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          available_deduction_capacity?: number | null
          borrower_id: string
          created_at?: string | null
          department?: string | null
          employee_number: string
          employer_id?: string | null
          enrolled_at?: string | null
          enrollment_status?: string | null
          existing_deductions?: number | null
          gross_salary?: number | null
          id?: string
          net_salary?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          available_deduction_capacity?: number | null
          borrower_id?: string
          created_at?: string | null
          department?: string | null
          employee_number?: string
          employer_id?: string | null
          enrolled_at?: string | null
          enrollment_status?: string | null
          existing_deductions?: number | null
          gross_salary?: number | null
          id?: string
          net_salary?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pmic_borrower_enrollments_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmic_borrower_enrollments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "pmic_employers"
            referencedColumns: ["id"]
          },
        ]
      }
      pmic_config: {
        Row: {
          created_at: string | null
          deduction_code: string | null
          deduction_code_assigned_date: string | null
          default_loan_term_months: number | null
          id: string
          is_active: boolean | null
          max_concurrent_loans: number | null
          max_deduction_percent: number | null
          max_loan_multiplier: number | null
          min_net_pay_percent: number | null
          payroll_authority: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deduction_code?: string | null
          deduction_code_assigned_date?: string | null
          default_loan_term_months?: number | null
          id?: string
          is_active?: boolean | null
          max_concurrent_loans?: number | null
          max_deduction_percent?: number | null
          max_loan_multiplier?: number | null
          min_net_pay_percent?: number | null
          payroll_authority?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deduction_code?: string | null
          deduction_code_assigned_date?: string | null
          default_loan_term_months?: number | null
          id?: string
          is_active?: boolean | null
          max_concurrent_loans?: number | null
          max_deduction_percent?: number | null
          max_loan_multiplier?: number | null
          min_net_pay_percent?: number | null
          payroll_authority?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pmic_employers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          employer_code: string
          employer_name: string
          employer_type: string
          id: string
          is_verified: boolean | null
          payroll_cycle: string
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          employer_code: string
          employer_name: string
          employer_type: string
          id?: string
          is_verified?: boolean | null
          payroll_cycle: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          employer_code?: string
          employer_name?: string
          employer_type?: string
          id?: string
          is_verified?: boolean | null
          payroll_cycle?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      pmic_exceptions: {
        Row: {
          created_at: string | null
          description: string | null
          enrollment_id: string | null
          exception_status: string | null
          exception_type: string
          id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          submission_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          exception_status?: string | null
          exception_type: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          submission_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          exception_status?: string | null
          exception_type?: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          submission_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pmic_exceptions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "pmic_borrower_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmic_exceptions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "pmic_payroll_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      pmic_payroll_submissions: {
        Row: {
          created_at: string | null
          file_url: string | null
          id: string
          notes: string | null
          payroll_period_end: string
          payroll_period_start: string
          processed_at: string | null
          response_file_url: string | null
          status: string | null
          submission_reference: string
          submission_type: string
          submitted_at: string | null
          submitted_by: string | null
          total_amount: number | null
          total_records: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          payroll_period_end: string
          payroll_period_start: string
          processed_at?: string | null
          response_file_url?: string | null
          status?: string | null
          submission_reference: string
          submission_type: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          total_records?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          payroll_period_end?: string
          payroll_period_start?: string
          processed_at?: string | null
          response_file_url?: string | null
          status?: string | null
          submission_reference?: string
          submission_type?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          total_records?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_document_requirements: {
        Row: {
          allowed_file_types: string[] | null
          can_reuse_previous: boolean | null
          created_at: string | null
          description: string | null
          display_order: number | null
          document_name: string
          document_type: string
          id: string
          is_active: boolean | null
          is_mandatory: boolean
          loan_product_id: string
          max_file_size_mb: number | null
          updated_at: string | null
          validity_days: number | null
        }
        Insert: {
          allowed_file_types?: string[] | null
          can_reuse_previous?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          document_name: string
          document_type: string
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean
          loan_product_id: string
          max_file_size_mb?: number | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Update: {
          allowed_file_types?: string[] | null
          can_reuse_previous?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          document_name?: string
          document_type?: string
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean
          loan_product_id?: string
          max_file_size_mb?: number | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_document_requirements_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          blacklist_expires_at: string | null
          blacklist_reason: string | null
          blacklisted_at: string | null
          blacklisted_by: string | null
          city: string | null
          created_at: string
          email: string
          email_reminders: boolean | null
          email_verified_at: string | null
          employer_name: string | null
          employment_type: string | null
          full_name: string | null
          id: string
          is_blacklisted: boolean | null
          job_title: string | null
          marketing: boolean | null
          net_income: number | null
          nrc_number: string | null
          payment_alerts: boolean | null
          phone: string | null
          phone_verified_at: string | null
          sms_reminders: boolean | null
          updated_at: string
          years_in_employment: number | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          blacklist_expires_at?: string | null
          blacklist_reason?: string | null
          blacklisted_at?: string | null
          blacklisted_by?: string | null
          city?: string | null
          created_at?: string
          email: string
          email_reminders?: boolean | null
          email_verified_at?: string | null
          employer_name?: string | null
          employment_type?: string | null
          full_name?: string | null
          id: string
          is_blacklisted?: boolean | null
          job_title?: string | null
          marketing?: boolean | null
          net_income?: number | null
          nrc_number?: string | null
          payment_alerts?: boolean | null
          phone?: string | null
          phone_verified_at?: string | null
          sms_reminders?: boolean | null
          updated_at?: string
          years_in_employment?: number | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          blacklist_expires_at?: string | null
          blacklist_reason?: string | null
          blacklisted_at?: string | null
          blacklisted_by?: string | null
          city?: string | null
          created_at?: string
          email?: string
          email_reminders?: boolean | null
          email_verified_at?: string | null
          employer_name?: string | null
          employment_type?: string | null
          full_name?: string | null
          id?: string
          is_blacklisted?: boolean | null
          job_title?: string | null
          marketing?: boolean | null
          net_income?: number | null
          nrc_number?: string | null
          payment_alerts?: boolean | null
          phone?: string | null
          phone_verified_at?: string | null
          sms_reminders?: boolean | null
          updated_at?: string
          years_in_employment?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device_info: Json | null
          endpoint: string
          id: string
          is_active: boolean | null
          p256dh_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_info?: Json | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          p256dh_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_info?: Json | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          p256dh_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          admin_notes: string | null
          assessed_by: string | null
          created_at: string
          credit_score: number | null
          decision: string | null
          id: string
          items: Json | null
          loan_application_id: string | null
          risk_rating: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assessed_by?: string | null
          created_at?: string
          credit_score?: number | null
          decision?: string | null
          id?: string
          items?: Json | null
          loan_application_id?: string | null
          risk_rating?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assessed_by?: string | null
          created_at?: string
          credit_score?: number | null
          decision?: string | null
          id?: string
          items?: Json | null
          loan_application_id?: string | null
          risk_rating?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "overdue_loans_view"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_name_fkey"
            columns: ["role_name"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_accounts: {
        Row: {
          account_type: string
          balance: number
          created_at: string
          currency: string
          id: string
          is_active: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          status: string | null
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      overdue_loans_view: {
        Row: {
          active_ptp_amount: number | null
          active_ptp_date: string | null
          assigned_collector_id: string | null
          borrower_email: string | null
          borrower_name: string | null
          borrower_phone: string | null
          collection_priority: string | null
          last_activity_date: string | null
          last_activity_type: string | null
          last_contact_at: string | null
          loan_amount: number | null
          loan_id: string | null
          loan_status: Database["public"]["Enums"]["loan_status"] | null
          next_action_date: string | null
          oldest_overdue_date: string | null
          overdue_amount: number | null
          overdue_count: number | null
          total_paid: number | null
          total_repayment: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_approve_loan_writeoff: {
        Args: { p_writeoff_id: string }
        Returns: Json
      }
      admin_mark_loan_defaulted: {
        Args: { p_loan_id: string; p_reason: string }
        Returns: Json
      }
      admin_record_writeoff_recovery: {
        Args: { p_amount: number; p_notes: string; p_writeoff_id: string }
        Returns: Json
      }
      admin_reject_loan_writeoff: {
        Args: { p_reason: string; p_writeoff_id: string }
        Returns: Json
      }
      admin_set_expense_status: {
        Args: {
          p_expense_id: string
          p_new_status: string
          p_reject_reason?: string
        }
        Returns: Json
      }
      apply_loan_penalties: { Args: { p_loan_id: string }; Returns: number }
      calculate_early_settlement: {
        Args: { p_loan_id: string }
        Returns: {
          early_settlement_fee: number
          outstanding_interest: number
          outstanding_principal: number
          total_payoff_amount: number
          total_penalties: number
        }[]
      }
      calculate_repayment_penalty: {
        Args: { p_repayment_id: string }
        Returns: number
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      get_my_permissions: {
        Args: never
        Returns: {
          action: string
          module: string
        }[]
      }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_auth_event: {
        Args: { p_action: string; p_device_info?: Json; p_ip_address?: string }
        Returns: undefined
      }
      officer_loan_stats: {
        Args: { p_period_end: string; p_period_start: string }
        Returns: {
          approval_rate: number
          approved_count: number
          officer_id: string
          officer_name: string
          rejected_count: number
          total_applications: number
          total_collected: number
          total_disbursed: number
        }[]
      }
      portfolio_at_risk: {
        Args: { p_as_of_date?: string }
        Returns: {
          par_30: number
          par_30_pct: number
          par_60: number
          par_60_pct: number
          par_90: number
          par_90_pct: number
          total_outstanding: number
        }[]
      }
      send_notification_via_edge_function: {
        Args: {
          p_event_type?: string
          p_message: string
          p_recipient: string
          p_subject?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      transition_loan_status: {
        Args: { p_action: string; p_loan_id: string; p_reason?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "employer"
        | "super_admin"
        | "loan_officer"
        | "credit_officer"
        | "finance_officer"
        | "collections_officer"
        | "auditor"
        | "support"
      employment_type: "employed" | "self_employed" | "contract" | "other"
      loan_status:
        | "pending"
        | "under_review"
        | "approved"
        | "contract_signing"
        | "awaiting_disbursement"
        | "rejected"
        | "disbursed"
        | "active"
        | "completed"
        | "defaulted"
        | "crb_failed"
        | "pmic_pending"
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
      app_role: [
        "admin",
        "user",
        "employer",
        "super_admin",
        "loan_officer",
        "credit_officer",
        "finance_officer",
        "collections_officer",
        "auditor",
        "support",
      ],
      employment_type: ["employed", "self_employed", "contract", "other"],
      loan_status: [
        "pending",
        "under_review",
        "approved",
        "contract_signing",
        "awaiting_disbursement",
        "rejected",
        "disbursed",
        "active",
        "completed",
        "defaulted",
        "crb_failed",
        "pmic_pending",
      ],
    },
  },
} as const

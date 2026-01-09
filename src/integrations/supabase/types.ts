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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
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
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
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
          court_name: string | null
          created_at: string
          created_by: string | null
          filing_date: string | null
          hearing_date: string | null
          id: string
          judgment_amount: number | null
          judgment_date: string | null
          lawyer_contact: string | null
          legal_fees: number | null
          loan_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_lawyer?: string | null
          case_number?: string | null
          case_type?: string
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          filing_date?: string | null
          hearing_date?: string | null
          id?: string
          judgment_amount?: number | null
          judgment_date?: string | null
          lawyer_contact?: string | null
          legal_fees?: number | null
          loan_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_lawyer?: string | null
          case_number?: string | null
          case_type?: string
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          filing_date?: string | null
          hearing_date?: string | null
          id?: string
          judgment_amount?: number | null
          judgment_date?: string | null
          lawyer_contact?: string | null
          legal_fees?: number | null
          loan_id?: string
          notes?: string | null
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
          assigned_to: string | null
          bank_statement_url: string | null
          city: string | null
          collateral_description: string | null
          collateral_image_url: string | null
          collateral_value: number | null
          contract_url: string | null
          crb_consent: boolean | null
          crb_consent_timestamp: string | null
          created_at: string
          date_of_birth: string | null
          early_settlement_fee: number | null
          email: string
          employer_id: string | null
          employer_letter_url: string | null
          employer_name: string | null
          employment_duration: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id: string
          interest_rate: number | null
          job_title: string | null
          loan_amount: number
          loan_product_id: string | null
          loan_purpose: string
          loan_term_months: number
          monthly_income: number
          monthly_payment: number | null
          nrc_back_url: string | null
          nrc_front_url: string | null
          nrc_number: string
          payslip_2_url: string | null
          payslip_3_url: string | null
          payslip_url: string | null
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          settlement_date: string | null
          settlement_type: string | null
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
          assigned_to?: string | null
          bank_statement_url?: string | null
          city?: string | null
          collateral_description?: string | null
          collateral_image_url?: string | null
          collateral_value?: number | null
          contract_url?: string | null
          crb_consent?: boolean | null
          crb_consent_timestamp?: string | null
          created_at?: string
          date_of_birth?: string | null
          early_settlement_fee?: number | null
          email: string
          employer_id?: string | null
          employer_letter_url?: string | null
          employer_name?: string | null
          employment_duration?: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id?: string
          interest_rate?: number | null
          job_title?: string | null
          loan_amount: number
          loan_product_id?: string | null
          loan_purpose: string
          loan_term_months: number
          monthly_income: number
          monthly_payment?: number | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_number: string
          payslip_2_url?: string | null
          payslip_3_url?: string | null
          payslip_url?: string | null
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          settlement_date?: string | null
          settlement_type?: string | null
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
          assigned_to?: string | null
          bank_statement_url?: string | null
          city?: string | null
          collateral_description?: string | null
          collateral_image_url?: string | null
          collateral_value?: number | null
          contract_url?: string | null
          crb_consent?: boolean | null
          crb_consent_timestamp?: string | null
          created_at?: string
          date_of_birth?: string | null
          early_settlement_fee?: number | null
          email?: string
          employer_id?: string | null
          employer_letter_url?: string | null
          employer_name?: string | null
          employment_duration?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          id?: string
          interest_rate?: number | null
          job_title?: string | null
          loan_amount?: number
          loan_product_id?: string | null
          loan_purpose?: string
          loan_term_months?: number
          monthly_income?: number
          monthly_payment?: number | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_number?: string
          payslip_2_url?: string | null
          payslip_3_url?: string | null
          payslip_url?: string | null
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          settlement_date?: string | null
          settlement_type?: string | null
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
          employer_whitelist_enabled: boolean | null
          employment_types: string[] | null
          enforcement_fee_percent: number | null
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
          employer_whitelist_enabled?: boolean | null
          employment_types?: string[] | null
          enforcement_fee_percent?: number | null
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
          employer_whitelist_enabled?: boolean | null
          employment_types?: string[] | null
          enforcement_fee_percent?: number | null
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
          title?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
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
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          blacklist_reason: string | null
          blacklisted_at: string | null
          blacklisted_by: string | null
          city: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_blacklisted: boolean | null
          nrc_number: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          blacklist_reason?: string | null
          blacklisted_at?: string | null
          blacklisted_by?: string | null
          city?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_blacklisted?: boolean | null
          nrc_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          blacklist_reason?: string | null
          blacklisted_at?: string | null
          blacklisted_by?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_blacklisted?: boolean | null
          nrc_number?: string | null
          phone?: string | null
          updated_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
        | "rejected"
        | "disbursed"
        | "active"
        | "completed"
        | "defaulted"
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
        "rejected",
        "disbursed",
        "active",
        "completed",
        "defaulted",
      ],
    },
  },
} as const

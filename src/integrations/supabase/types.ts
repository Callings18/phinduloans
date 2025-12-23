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
      loan_applications: {
        Row: {
          address: string | null
          admin_notes: string | null
          city: string | null
          collateral_description: string | null
          collateral_value: number | null
          contract_url: string | null
          created_at: string
          date_of_birth: string | null
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
          payslip_url: string | null
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["loan_status"]
          total_repayment: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          city?: string | null
          collateral_description?: string | null
          collateral_value?: number | null
          contract_url?: string | null
          created_at?: string
          date_of_birth?: string | null
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
          payslip_url?: string | null
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          total_repayment?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          city?: string | null
          collateral_description?: string | null
          collateral_value?: number | null
          contract_url?: string | null
          created_at?: string
          date_of_birth?: string | null
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
          payslip_url?: string | null
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
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
      loan_products: {
        Row: {
          created_at: string
          description: string | null
          employment_types: string[] | null
          id: string
          interest_rate: number
          is_active: boolean | null
          max_amount: number
          max_term_months: number
          min_amount: number
          min_term_months: number
          name: string
          processing_fee_percent: number | null
          requirements: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          employment_types?: string[] | null
          id?: string
          interest_rate?: number
          is_active?: boolean | null
          max_amount?: number
          max_term_months?: number
          min_amount?: number
          min_term_months?: number
          name: string
          processing_fee_percent?: number | null
          requirements?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          employment_types?: string[] | null
          id?: string
          interest_rate?: number
          is_active?: boolean | null
          max_amount?: number
          max_term_months?: number
          min_amount?: number
          min_term_months?: number
          name?: string
          processing_fee_percent?: number | null
          requirements?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      loan_repayments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number | null
          loan_id: string
          paid_date: string | null
          payment_method: string | null
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
          loan_id: string
          paid_date?: string | null
          payment_method?: string | null
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
          loan_id?: string
          paid_date?: string | null
          payment_method?: string | null
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
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          nrc_number: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          nrc_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          nrc_number?: string | null
          phone?: string | null
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      app_role: ["admin", "user", "employer"],
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

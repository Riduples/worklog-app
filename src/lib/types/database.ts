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
      bookings: {
        Row: {
          balance_due: number | null
          booking_date: string
          booking_time: string | null
          business_id: string
          client_contact_id: string | null
          client_name: string
          created_at: string | null
          deleted_at: string | null
          deposit_paid: number | null
          id: string
          service: string | null
          status: string
          total_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance_due?: number | null
          booking_date: string
          booking_time?: string | null
          business_id: string
          client_contact_id?: string | null
          client_name: string
          created_at?: string | null
          deleted_at?: string | null
          deposit_paid?: number | null
          id?: string
          service?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance_due?: number | null
          booking_date?: string
          booking_time?: string | null
          business_id?: string
          client_contact_id?: string | null
          client_name?: string
          created_at?: string | null
          deleted_at?: string | null
          deposit_paid?: number | null
          id?: string
          service?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          permissions: Json
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          permissions?: Json
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          permissions?: Json
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          address: string | null
          business_type: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          paye_ref: string | null
          phone: string | null
          plan: string
          sdl_registered: boolean
          show_all_tools: boolean
          updated_at: string | null
          user_id: string
          vat_number: string | null
          vat_period: string
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          paye_ref?: string | null
          phone?: string | null
          plan?: string
          sdl_registered?: boolean
          show_all_tools?: boolean
          updated_at?: string | null
          user_id: string
          vat_number?: string | null
          vat_period?: string
        }
        Update: {
          address?: string | null
          business_type?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          paye_ref?: string | null
          phone?: string | null
          plan?: string
          sdl_registered?: boolean
          show_all_tools?: boolean
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
          vat_period?: string
        }
        Relationships: []
      }
      cash_ups: {
        Row: {
          business_id: string
          cash_in: number
          cash_out: number
          cash_up_date: string
          counted: number
          created_at: string | null
          expected: number
          id: string
          notes: string | null
          user_id: string
          variance: number
        }
        Insert: {
          business_id: string
          cash_in?: number
          cash_out?: number
          cash_up_date: string
          counted?: number
          created_at?: string | null
          expected?: number
          id?: string
          notes?: string | null
          user_id: string
          variance?: number
        }
        Update: {
          business_id?: string
          cash_in?: number
          cash_out?: number
          cash_up_date?: string
          counted?: number
          created_at?: string | null
          expected?: number
          id?: string
          notes?: string | null
          user_id?: string
          variance?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_ups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          business_id: string
          contact_type: string
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_behaviour: string | null
          payment_terms: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          contact_type: string
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_behaviour?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          contact_type?: string
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_behaviour?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          created_at: string | null
          deleted_at: string | null
          details: string | null
          id: string
          matched_document_id: string | null
          matched_document_type: string | null
          paid_to: string | null
          paid_to_contact_id: string | null
          payment_method: string | null
          sars_category: string | null
          source: string | null
          transaction_date: string
          updated_at: string | null
          user_id: string
          what_for: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string | null
          deleted_at?: string | null
          details?: string | null
          id?: string
          matched_document_id?: string | null
          matched_document_type?: string | null
          paid_to?: string | null
          paid_to_contact_id?: string | null
          payment_method?: string | null
          sars_category?: string | null
          source?: string | null
          transaction_date: string
          updated_at?: string | null
          user_id: string
          what_for?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string | null
          deleted_at?: string | null
          details?: string | null
          id?: string
          matched_document_id?: string | null
          matched_document_type?: string | null
          paid_to?: string | null
          paid_to_contact_id?: string | null
          payment_method?: string | null
          sars_category?: string | null
          source?: string | null
          transaction_date?: string
          updated_at?: string | null
          user_id?: string
          what_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_to_contact_id_fkey"
            columns: ["paid_to_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          business_id: string
          document_type: string
          file_path: string
          file_url: string | null
          generated_at: string | null
          id: string
          source_id: string
          user_id: string
        }
        Insert: {
          business_id: string
          document_type: string
          file_path: string
          file_url?: string | null
          generated_at?: string | null
          id?: string
          source_id: string
          user_id: string
        }
        Update: {
          business_id?: string
          document_type?: string
          file_path?: string
          file_url?: string | null
          generated_at?: string | null
          id?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          business_id: string
          created_at: string | null
          deleted_at: string | null
          details: string | null
          id: string
          matched_invoice_id: string | null
          payment_method: string | null
          received_from: string | null
          received_from_contact_id: string | null
          sars_category: string | null
          source: string | null
          tax_jar_amount: number | null
          transaction_date: string
          updated_at: string | null
          user_id: string
          vat_amount: number
          vat_rate: number | null
          what_for: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string | null
          deleted_at?: string | null
          details?: string | null
          id?: string
          matched_invoice_id?: string | null
          payment_method?: string | null
          received_from?: string | null
          received_from_contact_id?: string | null
          sars_category?: string | null
          source?: string | null
          tax_jar_amount?: number | null
          transaction_date: string
          updated_at?: string | null
          user_id: string
          vat_amount?: number
          vat_rate?: number | null
          what_for?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string | null
          deleted_at?: string | null
          details?: string | null
          id?: string
          matched_invoice_id?: string | null
          payment_method?: string | null
          received_from?: string | null
          received_from_contact_id?: string | null
          sars_category?: string | null
          source?: string | null
          tax_jar_amount?: number | null
          transaction_date?: string
          updated_at?: string | null
          user_id?: string
          vat_amount?: number
          vat_rate?: number | null
          what_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_received_from_contact_id_fkey"
            columns: ["received_from_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          permissions: Json
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          permissions?: Json
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permissions?: Json
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          business_id: string
          client_contact_id: string | null
          client_name: string
          converted_from_quote_id: string | null
          created_at: string | null
          deleted_at: string | null
          deposit_received: number | null
          doc_number: string
          due_date: string | null
          id: string
          invoice_amount: number
          issue_date: string
          line_items: Json
          next_run_date: string | null
          paid_date: string | null
          recurrence: string
          recurrence_parent_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          balance_due?: number
          business_id: string
          client_contact_id?: string | null
          client_name: string
          converted_from_quote_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deposit_received?: number | null
          doc_number: string
          due_date?: string | null
          id?: string
          invoice_amount?: number
          issue_date: string
          line_items?: Json
          next_run_date?: string | null
          paid_date?: string | null
          recurrence?: string
          recurrence_parent_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          balance_due?: number
          business_id?: string
          client_contact_id?: string | null
          client_name?: string
          converted_from_quote_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deposit_received?: number | null
          doc_number?: string
          due_date?: string | null
          id?: string
          invoice_amount?: number
          issue_date?: string
          line_items?: Json
          next_run_date?: string | null
          paid_date?: string | null
          recurrence?: string
          recurrence_parent_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_converted_from_quote_id_fkey"
            columns: ["converted_from_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          business_id: string
          created_at: string | null
          deleted_at: string | null
          entry_date: string
          id: string
          ledger_type: string
          note: string | null
          paid_date: string | null
          party_contact_id: string | null
          party_name: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string | null
          deleted_at?: string | null
          entry_date: string
          id?: string
          ledger_type: string
          note?: string | null
          paid_date?: string | null
          party_contact_id?: string | null
          party_name: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string | null
          deleted_at?: string | null
          entry_date?: string
          id?: string
          ledger_type?: string
          note?: string | null
          paid_date?: string | null
          party_contact_id?: string | null
          party_name?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_party_contact_id_fkey"
            columns: ["party_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_trips: {
        Row: {
          business_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          km_travelled: number
          odometer_end: number
          odometer_start: number
          purpose: string | null
          sars_deduction: number | null
          trip_date: string
          trip_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          km_travelled: number
          odometer_end: number
          odometer_start: number
          purpose?: string | null
          sars_deduction?: number | null
          trip_date: string
          trip_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          km_travelled?: number
          odometer_end?: number
          odometer_start?: number
          purpose?: string | null
          sars_deduction?: number | null
          trip_date?: string
          trip_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mileage_trips_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_runs: {
        Row: {
          allowances_amount: number | null
          approved_at: string | null
          approved_by: string | null
          base_rate: number | null
          business_id: string
          created_at: string | null
          gross_wages: number
          id: string
          leave_days: number | null
          leave_type: string | null
          loan_deducted: number | null
          net_pay: number
          other_deduction_desc: string | null
          other_deductions: number | null
          overtime_amount: number | null
          pay_date: string
          pay_period: string
          paye: number | null
          sdl: number | null
          staff_id: string | null
          status: string
          uif_employee: number | null
          uif_employer: number | null
          uif_total: number | null
          units_worked: number | null
          updated_at: string | null
          user_id: string
          worker_name: string
        }
        Insert: {
          allowances_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          base_rate?: number | null
          business_id: string
          created_at?: string | null
          gross_wages?: number
          id?: string
          leave_days?: number | null
          leave_type?: string | null
          loan_deducted?: number | null
          net_pay?: number
          other_deduction_desc?: string | null
          other_deductions?: number | null
          overtime_amount?: number | null
          pay_date: string
          pay_period: string
          paye?: number | null
          sdl?: number | null
          staff_id?: string | null
          status?: string
          uif_employee?: number | null
          uif_employer?: number | null
          uif_total?: number | null
          units_worked?: number | null
          updated_at?: string | null
          user_id: string
          worker_name: string
        }
        Update: {
          allowances_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          base_rate?: number | null
          business_id?: string
          created_at?: string | null
          gross_wages?: number
          id?: string
          leave_days?: number | null
          leave_type?: string | null
          loan_deducted?: number | null
          net_pay?: number
          other_deduction_desc?: string | null
          other_deductions?: number | null
          overtime_amount?: number | null
          pay_date?: string
          pay_period?: string
          paye?: number | null
          sdl?: number | null
          staff_id?: string | null
          status?: string
          uif_employee?: number | null
          uif_employer?: number | null
          uif_total?: number | null
          units_worked?: number | null
          updated_at?: string | null
          user_id?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_register"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          business_id: string
          created_at: string | null
          deleted_at: string | null
          doc_number: string
          id: string
          issue_date: string
          line_items: Json
          requested_delivery: string | null
          status: string
          supplier_contact_id: string | null
          supplier_name: string
          total_amount: number
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          deleted_at?: string | null
          doc_number: string
          id?: string
          issue_date: string
          line_items?: Json
          requested_delivery?: string | null
          status?: string
          supplier_contact_id?: string | null
          supplier_name: string
          total_amount?: number
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          deleted_at?: string | null
          doc_number?: string
          id?: string
          issue_date?: string
          line_items?: Json
          requested_delivery?: string | null
          status?: string
          supplier_contact_id?: string | null
          supplier_name?: string
          total_amount?: number
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          business_id: string
          client_contact_id: string | null
          client_name: string
          converted_to_invoice_id: string | null
          created_at: string | null
          deleted_at: string | null
          deposit_requested: number | null
          doc_number: string
          id: string
          issue_date: string
          line_items: Json
          status: string
          total_amount: number
          updated_at: string | null
          user_id: string
          valid_until: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          business_id: string
          client_contact_id?: string | null
          client_name: string
          converted_to_invoice_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deposit_requested?: number | null
          doc_number: string
          id?: string
          issue_date: string
          line_items?: Json
          status?: string
          total_amount?: number
          updated_at?: string | null
          user_id: string
          valid_until?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          business_id?: string
          client_contact_id?: string | null
          client_name?: string
          converted_to_invoice_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deposit_requested?: number | null
          doc_number?: string
          id?: string
          issue_date?: string
          line_items?: Json
          status?: string
          total_amount?: number
          updated_at?: string | null
          user_id?: string
          valid_until?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotes_converted_invoice"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          business_id: string
          cost_per_serving: number | null
          created_at: string | null
          deleted_at: string | null
          dish_name: string
          id: string
          ingredients: Json
          markup_pct: number | null
          servings: number
          suggested_price: number | null
          total_cost: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          cost_per_serving?: number | null
          created_at?: string | null
          deleted_at?: string | null
          dish_name: string
          id?: string
          ingredients?: Json
          markup_pct?: number | null
          servings?: number
          suggested_price?: number | null
          total_cost?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          cost_per_serving?: number | null
          created_at?: string | null
          deleted_at?: string | null
          dish_name?: string
          id?: string
          ingredients?: Json
          markup_pct?: number | null
          servings?: number
          suggested_price?: number | null
          total_cost?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_register: {
        Row: {
          business_id: string
          contact_number: string | null
          contract_end_date: string | null
          created_at: string | null
          daily_wage: number | null
          days_per_week: number | null
          deleted_at: string | null
          employment_type: string
          first_name: string
          full_name: string
          hourly_rate: number | null
          hours_per_day: number | null
          id: string
          id_number: string | null
          is_contractor: boolean
          last_name: string
          monthly_salary: number | null
          pay_type: string
          start_date: string | null
          tax_number: string | null
          trading_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          contact_number?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          daily_wage?: number | null
          days_per_week?: number | null
          deleted_at?: string | null
          employment_type?: string
          first_name: string
          full_name: string
          hourly_rate?: number | null
          hours_per_day?: number | null
          id?: string
          id_number?: string | null
          is_contractor?: boolean
          last_name: string
          monthly_salary?: number | null
          pay_type?: string
          start_date?: string | null
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          contact_number?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          daily_wage?: number | null
          days_per_week?: number | null
          deleted_at?: string | null
          employment_type?: string
          first_name?: string
          full_name?: string
          hourly_rate?: number | null
          hours_per_day?: number | null
          id?: string
          id_number?: string | null
          is_contractor?: boolean
          last_name?: string
          monthly_salary?: number | null
          pay_type?: string
          start_date?: string | null
          tax_number?: string | null
          trading_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_register_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          business_id: string
          cost_price: number | null
          created_at: string | null
          deleted_at: string | null
          id: string
          margin_pct: number | null
          name: string
          qty: number
          reorder_level: number | null
          sell_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          cost_price?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          margin_pct?: number | null
          name: string
          qty?: number
          reorder_level?: number | null
          sell_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          cost_price?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          margin_pct?: number | null
          name?: string
          qty?: number
          reorder_level?: number | null
          sell_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          balance_due: number
          business_id: string
          created_at: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          invoice_amount: number
          issue_date: string
          line_items: Json
          linked_po_id: string | null
          paid_amount: number | null
          paid_date: string | null
          status: string
          supplier_contact_id: string | null
          supplier_name: string
          supplier_ref_number: string | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          balance_due?: number
          business_id: string
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_amount?: number
          issue_date: string
          line_items?: Json
          linked_po_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          status?: string
          supplier_contact_id?: string | null
          supplier_name: string
          supplier_ref_number?: string | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          balance_due?: number
          business_id?: string
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_amount?: number
          issue_date?: string
          line_items?: Json
          linked_po_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          status?: string
          supplier_contact_id?: string | null
          supplier_name?: string
          supplier_ref_number?: string | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_linked_po_id_fkey"
            columns: ["linked_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_filings: {
        Row: {
          amount: number
          business_id: string
          created_at: string | null
          filed_date: string
          filing_type: string
          id: string
          period_label: string
          user_id: string
        }
        Insert: {
          amount?: number
          business_id: string
          created_at?: string | null
          filed_date?: string
          filing_type: string
          id?: string
          period_label: string
          user_id: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string | null
          filed_date?: string
          filing_type?: string
          id?: string
          period_label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_filings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_records: {
        Row: {
          amount: number
          business_id: string
          created_at: string | null
          entry_date: string
          id: string
          notes: string | null
          period: string | null
          record_type: string
          tax_year: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string | null
          entry_date: string
          id?: string
          notes?: string | null
          period?: string | null
          record_type: string
          tax_year?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          period?: string | null
          record_type?: string
          tax_year?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          amount_to_bill: number | null
          bill_type: string
          business_id: string
          client_contact_id: string | null
          client_name: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          entry_date: string
          hourly_rate: number | null
          hours_worked: number
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_to_bill?: number | null
          bill_type?: string
          business_id: string
          client_contact_id?: string | null
          client_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          entry_date: string
          hourly_rate?: number | null
          hours_worked: number
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_to_bill?: number | null
          bill_type?: string
          business_id?: string
          client_contact_id?: string | null
          client_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          entry_date?: string
          hourly_rate?: number | null
          hours_worked?: number
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      worker_leave: {
        Row: {
          business_id: string
          created_at: string | null
          days: number
          id: string
          leave_type: string
          note: string | null
          staff_id: string | null
          start_date: string
          user_id: string
          worker_name: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          days: number
          id?: string
          leave_type: string
          note?: string | null
          staff_id?: string | null
          start_date: string
          user_id: string
          worker_name: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          days?: number
          id?: string
          leave_type?: string
          note?: string | null
          staff_id?: string | null
          start_date?: string
          user_id?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_leave_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_leave_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_register"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_loans: {
        Row: {
          amount: number
          business_id: string
          created_at: string | null
          entry_date: string
          id: string
          loan_type: string
          note: string | null
          staff_id: string | null
          user_id: string
          worker_name: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string | null
          entry_date?: string
          id?: string
          loan_type: string
          note?: string | null
          staff_id?: string | null
          user_id: string
          worker_name: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string | null
          entry_date?: string
          id?: string
          loan_type?: string
          note?: string | null
          staff_id?: string | null
          user_id?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_loans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_loans_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_register"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      convert_quote_to_invoice: {
        Args: {
          p_deposit_received: number
          p_doc_number: string
          p_due_date: string
          p_invoice_amount: number
          p_issue_date: string
          p_line_items: Json
          p_quote_id: string
          p_vat_amount: number
          p_vat_rate: number
        }
        Returns: {
          balance_due: number
          business_id: string
          client_contact_id: string | null
          client_name: string
          converted_from_quote_id: string | null
          created_at: string | null
          deleted_at: string | null
          deposit_received: number | null
          doc_number: string
          due_date: string | null
          id: string
          invoice_amount: number
          issue_date: string
          line_items: Json
          next_run_date: string | null
          paid_date: string | null
          recurrence: string
          recurrence_parent_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_pay_run: {
        Args: {
          p_allowances_amount: number
          p_base_rate: number
          p_business_id: string
          p_gross_wages: number
          p_leave_days: number
          p_leave_type: string
          p_loan_deducted: number
          p_net_pay: number
          p_other_deduction_desc: string
          p_other_deductions: number
          p_overtime_amount: number
          p_pay_date: string
          p_pay_period: string
          p_paye: number
          p_sdl: number
          p_staff_id: string
          p_status: string
          p_uif_employee: number
          p_uif_employer: number
          p_units_worked: number
          p_worker_name: string
        }
        Returns: {
          allowances_amount: number | null
          approved_at: string | null
          approved_by: string | null
          base_rate: number | null
          business_id: string
          created_at: string | null
          gross_wages: number
          id: string
          leave_days: number | null
          leave_type: string | null
          loan_deducted: number | null
          net_pay: number
          other_deduction_desc: string | null
          other_deductions: number | null
          overtime_amount: number | null
          pay_date: string
          pay_period: string
          paye: number | null
          sdl: number | null
          staff_id: string | null
          status: string
          uif_employee: number | null
          uif_employer: number | null
          uif_total: number | null
          units_worked: number | null
          updated_at: string | null
          user_id: string
          worker_name: string
        }
        SetofOptions: {
          from: "*"
          to: "pay_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_recurring_invoices: { Args: never; Returns: number }
      get_business_members: {
        Args: { target_business_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          permissions: Json
          role: string
          user_id: string
        }[]
      }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          business_name: string
          invite_email: string
          is_accepted: boolean
          is_expired: boolean
          role: string
        }[]
      }
      has_tool_access: {
        Args: { p_business_id: string; p_min_level: string; p_tool: string }
        Returns: boolean
      }
      is_business_member: {
        Args: { target_business_id: string }
        Returns: boolean
      }
      recurrence_next: {
        Args: { p_from: string; p_recurrence: string }
        Returns: string
      }
      tool_access_rank: { Args: { p_level: string }; Returns: number }
      update_business_plan: {
        Args: { new_plan: string; target_business_id: string }
        Returns: undefined
      }
      update_member_permissions: {
        Args: { new_permissions: Json; target_member_id: string }
        Returns: undefined
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

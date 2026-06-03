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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          date: string
          id: number
          organization_id: string
          schedule_id: number | null
          student_id: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: number
          organization_id: string
          schedule_id?: number | null
          student_id: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: number
          organization_id?: string
          schedule_id?: number | null
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          billing_day_of_month: number | null
          currency: string
          description: string | null
          features: string[] | null
          id: number
          name: string
          organization_id: string | null
          period: Database["public"]["Enums"]["billing_period"]
          price: number
          setup_fee: number
          status: string
        }
        Insert: {
          billing_day_of_month?: number | null
          currency?: string
          description?: string | null
          features?: string[] | null
          id?: number
          name: string
          organization_id?: string | null
          period: Database["public"]["Enums"]["billing_period"]
          price: number
          setup_fee?: number
          status: string
        }
        Update: {
          billing_day_of_month?: number | null
          currency?: string
          description?: string | null
          features?: string[] | null
          id?: number
          name?: string
          organization_id?: string | null
          period?: Database["public"]["Enums"]["billing_period"]
          price?: number
          setup_fee?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          check_in_minutes_after: number | null
          check_in_minutes_before: number | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          slug: string
          stripe_account_id: string | null
          timezone: string | null
        }
        Insert: {
          address?: string | null
          check_in_minutes_after?: number | null
          check_in_minutes_before?: number | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          slug: string
          stripe_account_id?: string | null
          timezone?: string | null
        }
        Update: {
          address?: string | null
          check_in_minutes_after?: number | null
          check_in_minutes_before?: number | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
          stripe_account_id?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          failure_reason: string | null
          id: number
          organization_id: string
          refund_reason: string | null
          refunded_amount: number
          refunded_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          student_id: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          failure_reason?: string | null
          id?: number
          organization_id: string
          refund_reason?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          student_id?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          failure_reason?: string | null
          id?: number
          organization_id?: string
          refund_reason?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          student_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          id: string
          organization_id?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: number
          name: string
          organization_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: number
          name: string
          organization_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: number
          name?: string
          organization_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          belt: string | null
          birth_date: string | null
          city: string | null
          email: string | null
          id: number
          join_date: string
          membership_plan_id: number | null
          membership_status: string | null
          name: string
          organization_id: string | null
          phone: string | null
          state: string | null
          status: string
          stripe_customer_id: string | null
          stripes: number
          subscription_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          belt?: string | null
          birth_date?: string | null
          city?: string | null
          email?: string | null
          id?: number
          join_date: string
          membership_plan_id?: number | null
          membership_status?: string | null
          name: string
          organization_id?: string | null
          phone?: string | null
          state?: string | null
          status: string
          stripe_customer_id?: string | null
          stripes?: number
          subscription_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          belt?: string | null
          birth_date?: string | null
          city?: string | null
          email?: string | null
          id?: number
          join_date?: string
          membership_plan_id?: number | null
          membership_status?: string | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripes?: number
          subscription_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      billing_period:
        | "daily"
        | "weekly"
        | "monthly"
        | "quarterly"
        | "biannual"
        | "annual"
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

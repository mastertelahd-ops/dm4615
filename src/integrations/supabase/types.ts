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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          created_at: string
          is_active: boolean
          must_change_password: boolean
          role: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          must_change_password?: boolean
          role?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          must_change_password?: boolean
          role?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          outcome: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          outcome?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          outcome?: string
        }
        Relationships: []
      }
      customer_services: {
        Row: {
          created_at: string
          customer_id: string
          ended_at: string | null
          id: string
          onu_id: string | null
          service_plan_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          ended_at?: string | null
          id?: string
          onu_id?: string | null
          service_plan_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          ended_at?: string | null
          id?: string
          onu_id?: string | null
          service_plan_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_services_onu_id_fkey"
            columns: ["onu_id"]
            isOneToOne: false
            referencedRelation: "onus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_services_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json
          created_at: string
          document_number: string | null
          email: string | null
          external_code: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: Json
          created_at?: string
          document_number?: string | null
          email?: string | null
          external_code?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: Json
          created_at?: string
          document_number?: string | null
          email?: string | null
          external_code?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      olt_devices: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          management_host: string | null
          management_port: number
          model: string
          name: string
          updated_at: string
          vendor: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          management_host?: string | null
          management_port?: number
          model?: string
          name: string
          updated_at?: string
          vendor?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          management_host?: string | null
          management_port?: number
          model?: string
          name?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: []
      }
      onu_observations: {
        Row: {
          id: string
          observed_at: string
          observed_status: string
          olt_id: string | null
          onu_id: string | null
          pon_port_id: string | null
          raw_data: Json
          serial_number: string
        }
        Insert: {
          id?: string
          observed_at?: string
          observed_status: string
          olt_id?: string | null
          onu_id?: string | null
          pon_port_id?: string | null
          raw_data?: Json
          serial_number: string
        }
        Update: {
          id?: string
          observed_at?: string
          observed_status?: string
          olt_id?: string | null
          onu_id?: string | null
          pon_port_id?: string | null
          raw_data?: Json
          serial_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "onu_observations_olt_id_fkey"
            columns: ["olt_id"]
            isOneToOne: false
            referencedRelation: "olt_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onu_observations_onu_id_fkey"
            columns: ["onu_id"]
            isOneToOne: false
            referencedRelation: "onus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onu_observations_pon_port_id_fkey"
            columns: ["pon_port_id"]
            isOneToOne: false
            referencedRelation: "pon_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      onu_profiles: {
        Row: {
          config_template: Json
          created_at: string
          firmware_max: string | null
          firmware_min: string | null
          id: string
          is_active: boolean
          is_validated: boolean
          model: string | null
          name: string
          profile_type: string
          updated_at: string
          vendor: string
          version: number
        }
        Insert: {
          config_template?: Json
          created_at?: string
          firmware_max?: string | null
          firmware_min?: string | null
          id?: string
          is_active?: boolean
          is_validated?: boolean
          model?: string | null
          name: string
          profile_type: string
          updated_at?: string
          vendor: string
          version?: number
        }
        Update: {
          config_template?: Json
          created_at?: string
          firmware_max?: string | null
          firmware_min?: string | null
          id?: string
          is_active?: boolean
          is_validated?: boolean
          model?: string | null
          name?: string
          profile_type?: string
          updated_at?: string
          vendor?: string
          version?: number
        }
        Relationships: []
      }
      onus: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          last_seen_at: string | null
          metadata: Json
          olt_id: string | null
          onu_number: number | null
          pon_port_id: string | null
          profile_type: string | null
          serial_number: string
          service_plan_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          olt_id?: string | null
          onu_number?: number | null
          pon_port_id?: string | null
          profile_type?: string | null
          serial_number: string
          service_plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          olt_id?: string | null
          onu_number?: number | null
          pon_port_id?: string | null
          profile_type?: string | null
          serial_number?: string
          service_plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onus_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onus_olt_id_fkey"
            columns: ["olt_id"]
            isOneToOne: false
            referencedRelation: "olt_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onus_pon_port_id_fkey"
            columns: ["pon_port_id"]
            isOneToOne: false
            referencedRelation: "pon_ports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onus_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pon_ports: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          interface_name: string
          olt_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          interface_name: string
          olt_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          interface_name?: string
          olt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pon_ports_olt_id_fkey"
            columns: ["olt_id"]
            isOneToOne: false
            referencedRelation: "olt_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      provisioning_requests: {
        Row: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          executed_at: string | null
          failure_reason: string | null
          id: string
          onu_id: string
          profile_type: string
          request_payload: Json
          requested_by: string | null
          status: string
          target_pon_port_id: string | null
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          executed_at?: string | null
          failure_reason?: string | null
          id?: string
          onu_id: string
          profile_type: string
          request_payload?: Json
          requested_by?: string | null
          status?: string
          target_pon_port_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          executed_at?: string | null
          failure_reason?: string | null
          id?: string
          onu_id?: string
          profile_type?: string
          request_payload?: Json
          requested_by?: string | null
          status?: string
          target_pon_port_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_requests_onu_id_fkey"
            columns: ["onu_id"]
            isOneToOne: false
            referencedRelation: "onus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_requests_target_pon_port_id_fkey"
            columns: ["target_pon_port_id"]
            isOneToOne: false
            referencedRelation: "pon_ports"
            referencedColumns: ["id"]
          },
        ]
      }
      provisioning_steps: {
        Row: {
          command_name: string | null
          created_at: string
          finished_at: string | null
          id: string
          request_id: string
          result: Json
          started_at: string | null
          status: string
          step_name: string
          step_order: number
        }
        Insert: {
          command_name?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          request_id: string
          result?: Json
          started_at?: string | null
          status?: string
          step_name: string
          step_order: number
        }
        Update: {
          command_name?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          request_id?: string
          result?: Json
          started_at?: string | null
          status?: string
          step_name?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_steps_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "provisioning_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plans: {
        Row: {
          created_at: string
          download_mbps: number
          id: string
          is_active: boolean
          name: string
          price: number | null
          updated_at: string
          upload_mbps: number
        }
        Insert: {
          created_at?: string
          download_mbps: number
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          updated_at?: string
          upload_mbps: number
        }
        Update: {
          created_at?: string
          download_mbps?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          updated_at?: string
          upload_mbps?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_admin: { Args: never; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

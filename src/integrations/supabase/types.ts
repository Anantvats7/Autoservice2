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
          assigned_to: string | null
          checked_in_at: string | null
          created_at: string
          customer_id: string
          dropoff_code: string | null
          extra_service_ids: string[]
          id: string
          notes: string | null
          pickup_code: string | null
          priority: Database["public"]["Enums"]["booking_priority"]
          released_at: string | null
          scheduled_at: string
          service_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_cost: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_to?: string | null
          checked_in_at?: string | null
          created_at?: string
          customer_id: string
          dropoff_code?: string | null
          extra_service_ids?: string[]
          id?: string
          notes?: string | null
          pickup_code?: string | null
          priority?: Database["public"]["Enums"]["booking_priority"]
          released_at?: string | null
          scheduled_at: string
          service_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_cost?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_to?: string | null
          checked_in_at?: string | null
          created_at?: string
          customer_id?: string
          dropoff_code?: string | null
          extra_service_ids?: string[]
          id?: string
          notes?: string | null
          pickup_code?: string | null
          priority?: Database["public"]["Enums"]["booking_priority"]
          released_at?: string | null
          scheduled_at?: string
          service_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_cost?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          quantity: number
          reorder_level: number
          sku: string
          supplier: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          quantity?: number
          reorder_level?: number
          sku: string
          supplier?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          reorder_level?: number
          sku?: string
          supplier?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_history: {
        Row: {
          booking_id: string | null
          cost: number
          created_at: string
          customer_id: string
          id: string
          mileage_at_service: number | null
          notes: string | null
          parts_used: string | null
          service_date: string
          service_id: string
          technician_id: string | null
          vehicle_id: string
        }
        Insert: {
          booking_id?: string | null
          cost: number
          created_at?: string
          customer_id: string
          id?: string
          mileage_at_service?: number | null
          notes?: string | null
          parts_used?: string | null
          service_date?: string
          service_id: string
          technician_id?: string | null
          vehicle_id: string
        }
        Update: {
          booking_id?: string | null
          cost?: number
          created_at?: string
          customer_id?: string
          id?: string
          mileage_at_service?: number | null
          notes?: string | null
          parts_used?: string | null
          service_date?: string
          service_id?: string
          technician_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reminders: {
        Row: {
          acknowledged: boolean
          created_at: string
          customer_id: string
          due_date: string
          id: string
          message: string
          title: string
          vehicle_id: string
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          message: string
          title: string
          vehicle_id: string
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          message?: string
          title?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
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
          role: Database["public"]["Enums"]["app_role"]
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
      vehicles: {
        Row: {
          brand_logo_url: string | null
          color: string | null
          created_at: string
          fuel_type: string | null
          id: string
          make: string
          mileage: number
          model: string
          owner_id: string
          registration: string
          updated_at: string
          year: number
        }
        Insert: {
          brand_logo_url?: string | null
          color?: string | null
          created_at?: string
          fuel_type?: string | null
          id?: string
          make: string
          mileage?: number
          model: string
          owner_id: string
          registration: string
          updated_at?: string
          year: number
        }
        Update: {
          brand_logo_url?: string | null
          color?: string | null
          created_at?: string
          fuel_type?: string | null
          id?: string
          make?: string
          mileage?: number
          model?: string
          owner_id?: string
          registration?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
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
      app_role: "manager" | "employee" | "customer"
      booking_priority: "normal" | "express" | "priority"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "checked_in"
        | "ready_for_pickup"
        | "released"
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
      app_role: ["manager", "employee", "customer"],
      booking_priority: ["normal", "express", "priority"],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "checked_in",
        "ready_for_pickup",
        "released",
      ],
    },
  },
} as const

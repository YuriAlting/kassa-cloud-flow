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
      medewerkers: {
        Row: {
          actief: boolean | null
          id: string
          naam: string
          pincode: string
          restaurant_id: string
          rol: string | null
        }
        Insert: {
          actief?: boolean | null
          id?: string
          naam: string
          pincode: string
          restaurant_id: string
          rol?: string | null
        }
        Update: {
          actief?: boolean | null
          id?: string
          naam?: string
          pincode?: string
          restaurant_id?: string
          rol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medewerkers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          aangemaakt_op: string | null
          betaalwijze: string | null
          bron: string | null
          id: string
          items: Json
          korting: number | null
          korting_type: string | null
          medewerker_id: string | null
          restaurant_id: string | null
          status: string | null
          tafel_id: string | null
          totaal: number
        }
        Insert: {
          aangemaakt_op?: string | null
          betaalwijze?: string | null
          bron?: string | null
          id?: string
          items: Json
          korting?: number | null
          korting_type?: string | null
          medewerker_id?: string | null
          restaurant_id?: string | null
          status?: string | null
          tafel_id?: string | null
          totaal: number
        }
        Update: {
          aangemaakt_op?: string | null
          betaalwijze?: string | null
          bron?: string | null
          id?: string
          items?: Json
          korting?: number | null
          korting_type?: string | null
          medewerker_id?: string | null
          restaurant_id?: string | null
          status?: string | null
          tafel_id?: string | null
          totaal?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tafel_id_fkey"
            columns: ["tafel_id"]
            isOneToOne: false
            referencedRelation: "tafels"
            referencedColumns: ["id"]
          },
        ]
      }
      producten: {
        Row: {
          actief: boolean | null
          categorie: string
          id: string
          naam: string
          prijs: number
          restaurant_id: string
          volgorde: number | null
        }
        Insert: {
          actief?: boolean | null
          categorie: string
          id?: string
          naam: string
          prijs: number
          restaurant_id: string
          volgorde?: number | null
        }
        Update: {
          actief?: boolean | null
          categorie?: string
          id?: string
          naam?: string
          prijs?: number
          restaurant_id?: string
          volgorde?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producten_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          aangemaakt_op: string | null
          actief: boolean | null
          id: string
          naam: string
          printnode_api_key: string | null
          printnode_kassa_id: string | null
          printnode_keuken_1: string | null
          printnode_keuken_2: string | null
          printnode_keuken_3: string | null
          slug: string
        }
        Insert: {
          aangemaakt_op?: string | null
          actief?: boolean | null
          id?: string
          naam: string
          printnode_api_key?: string | null
          printnode_kassa_id?: string | null
          printnode_keuken_1?: string | null
          printnode_keuken_2?: string | null
          printnode_keuken_3?: string | null
          slug: string
        }
        Update: {
          aangemaakt_op?: string | null
          actief?: boolean | null
          id?: string
          naam?: string
          printnode_api_key?: string | null
          printnode_kassa_id?: string | null
          printnode_keuken_1?: string | null
          printnode_keuken_2?: string | null
          printnode_keuken_3?: string | null
          slug?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          id: string
          ingelogd_op: string | null
          medewerker_id: string | null
          restaurant_id: string | null
          uitgelogd_op: string | null
        }
        Insert: {
          id?: string
          ingelogd_op?: string | null
          medewerker_id?: string | null
          restaurant_id?: string | null
          uitgelogd_op?: string | null
        }
        Update: {
          id?: string
          ingelogd_op?: string | null
          medewerker_id?: string | null
          restaurant_id?: string | null
          uitgelogd_op?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tafels: {
        Row: {
          capaciteit: number | null
          id: string
          naam: string
          restaurant_id: string
          status: string | null
          volgorde: number | null
          zone: string
        }
        Insert: {
          capaciteit?: number | null
          id?: string
          naam: string
          restaurant_id: string
          status?: string | null
          volgorde?: number | null
          zone: string
        }
        Update: {
          capaciteit?: number | null
          id?: string
          naam?: string
          restaurant_id?: string
          status?: string | null
          volgorde?: number | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "tafels_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      app_role: "superadmin"
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
      app_role: ["superadmin"],
    },
  },
} as const

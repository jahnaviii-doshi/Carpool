export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean;
          reverify_after_days: number;
        };
        ComputedFields: never;
        Insert: {
          id?: boolean;
          reverify_after_days?: number;
        };
        Update: {
          id?: boolean;
          reverify_after_days?: number;
        };
        Relationships: [];
      };
      blocked_email_domains: {
        Row: {
          any_tld: boolean;
          pattern: string;
        };
        ComputedFields: never;
        Insert: {
          any_tld?: boolean;
          pattern: string;
        };
        Update: {
          any_tld?: boolean;
          pattern?: string;
        };
        Relationships: [];
      };
      college_domains: {
        Row: {
          college_id: string;
          domain: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          college_id: string;
          domain: string;
          id?: string;
        };
        Update: {
          college_id?: string;
          domain?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "college_domains_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
        ];
      };
      college_requests: {
        Row: {
          city: string;
          college_id: string | null;
          college_name: string;
          created_at: string;
          domains: unknown[];
          email: string;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["request_status"];
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          city: string;
          college_id?: string | null;
          college_name: string;
          created_at?: string;
          domains: unknown[];
          email: string;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          website?: string | null;
        };
        Update: {
          city?: string;
          college_id?: string | null;
          college_name?: string;
          created_at?: string;
          domains?: unknown[];
          email?: string;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "college_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
        ];
      };
      colleges: {
        Row: {
          campus_point: unknown;
          city: string;
          country_code: string;
          created_at: string;
          id: string;
          name: string;
          short_name: string;
          status: Database["public"]["Enums"]["college_status"];
        };
        ComputedFields: never;
        Insert: {
          campus_point?: unknown;
          city: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          name: string;
          short_name: string;
          status?: Database["public"]["Enums"]["college_status"];
        };
        Update: {
          campus_point?: unknown;
          city?: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          short_name?: string;
          status?: Database["public"]["Enums"]["college_status"];
        };
        Relationships: [];
      };
      private_contacts: {
        Row: {
          phone_e164: string;
          phone_verified: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          phone_e164: string;
          phone_verified?: boolean;
          user_id: string;
        };
        Update: {
          phone_e164?: string;
          phone_verified?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "private_contacts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "private_contacts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          college_id: string;
          created_at: string;
          email_verified_at: string | null;
          full_name: string | null;
          gender: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_banned: boolean;
          onboarded_at: string | null;
          rating_avg: number | null;
          rating_count: number;
          role: Database["public"]["Enums"]["user_role"] | null;
          terms_accepted_at: string | null;
          year_or_dept: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          college_id: string;
          created_at?: string;
          email_verified_at?: string | null;
          full_name?: string | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_banned?: boolean;
          onboarded_at?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          role?: Database["public"]["Enums"]["user_role"] | null;
          terms_accepted_at?: string | null;
          year_or_dept?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          college_id?: string;
          created_at?: string;
          email_verified_at?: string | null;
          full_name?: string | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          is_banned?: boolean;
          onboarded_at?: string | null;
          rating_avg?: number | null;
          rating_count?: number;
          role?: Database["public"]["Enums"]["user_role"] | null;
          terms_accepted_at?: string | null;
          year_or_dept?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
        ];
      };
      super_admins: {
        Row: {
          created_at: string;
          email: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null;
          college_id: string;
          first_name: string | null;
          id: string;
          rating_avg: number | null;
          rating_count: number;
          role: Database["public"]["Enums"]["user_role"] | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          college_id?: string | null;
          first_name?: never;
          id?: string | null;
          rating_avg?: number | null;
          rating_count?: number | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Update: {
          avatar_url?: string | null;
          college_id?: string | null;
          first_name?: never;
          id?: string | null;
          rating_avg?: number | null;
          rating_count?: number | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      approve_college_request: {
        Args: {
          p_campus_lat?: number;
          p_campus_lng?: number;
          p_city: string;
          p_country_code?: string;
          p_domains: string[];
          p_name: string;
          p_request_id: string;
          p_short_name: string;
        };
        Returns: string;
      };
      auth_college_id: { Args: Record<PropertyKey, never>; Returns: string };
      can_write: { Args: Record<PropertyKey, never>; Returns: boolean };
      check_signup_email: { Args: { p_email: string }; Returns: Json };
      college_for_email: { Args: { p_email: string }; Returns: string };
      complete_onboarding: {
        Args: {
          p_accept_terms?: boolean;
          p_full_name: string;
          p_gender?: Database["public"]["Enums"]["gender"];
          p_phone_e164: string;
          p_role: Database["public"]["Enums"]["user_role"];
          p_year_or_dept?: string;
        };
        Returns: undefined;
      };
      domain_matches: { Args: { p_domain: string; p_parent: string }; Returns: boolean };
      email_domain: { Args: { p_email: string }; Returns: string };
      hook_before_user_created: { Args: { event: Json }; Returns: Json };
      is_blocked_email_domain: { Args: { p_domain: string }; Returns: boolean };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      record_email_verification: { Args: Record<PropertyKey, never>; Returns: string };
      reject_college_request: { Args: { p_request_id: string }; Returns: undefined };
      submit_college_request: {
        Args: {
          p_city: string;
          p_college_name: string;
          p_domains: string[];
          p_email: string;
          p_website?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      college_status: "active" | "pending";
      gender: "female" | "male" | "other" | "prefer_not";
      request_status: "pending" | "approved" | "rejected";
      user_role: "student" | "staff";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      college_status: ["active", "pending"],
      gender: ["female", "male", "other", "prefer_not"],
      request_status: ["pending", "approved", "rejected"],
      user_role: ["student", "staff"],
    },
  },
} as const;

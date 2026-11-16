export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean;
          match_dest_radius_m: number;
          match_limit: number;
          match_pickup_radius_m: number;
          max_cost_per_km: number;
          max_distance_from_campus_m: number;
          max_posts_per_day: number;
          reverify_after_days: number;
          series_horizon_days: number;
        };
        ComputedFields: never;
        Insert: {
          id?: boolean;
          match_dest_radius_m?: number;
          match_limit?: number;
          match_pickup_radius_m?: number;
          max_cost_per_km?: number;
          max_distance_from_campus_m?: number;
          max_posts_per_day?: number;
          reverify_after_days?: number;
          series_horizon_days?: number;
        };
        Update: {
          id?: boolean;
          match_dest_radius_m?: number;
          match_limit?: number;
          match_pickup_radius_m?: number;
          max_cost_per_km?: number;
          max_distance_from_campus_m?: number;
          max_posts_per_day?: number;
          reverify_after_days?: number;
          series_horizon_days?: number;
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
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
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
          {
            foreignKeyName: "college_domains_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
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
          {
            foreignKeyName: "college_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
        ];
      };
      colleges: {
        Row: {
          campus_point: unknown;
          city: string;
          cost_sharing_enabled: boolean;
          country_code: string;
          created_at: string;
          currency: string;
          id: string;
          name: string;
          short_name: string;
          status: Database["public"]["Enums"]["college_status"];
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          campus_point?: unknown;
          city: string;
          cost_sharing_enabled?: boolean;
          country_code?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          name: string;
          short_name: string;
          status?: Database["public"]["Enums"]["college_status"];
          timezone?: string;
        };
        Update: {
          campus_point?: unknown;
          city?: string;
          cost_sharing_enabled?: boolean;
          country_code?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          name?: string;
          short_name?: string;
          status?: Database["public"]["Enums"]["college_status"];
          timezone?: string;
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
          {
            foreignKeyName: "profiles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
        ];
      };
      ride_offers: {
        Row: {
          college_id: string;
          cost_per_seat: number | null;
          created_at: string;
          depart_at: string;
          dest_area: string | null;
          dest_fuzzed: unknown;
          dest_label: string;
          dest_point: unknown;
          driver_id: string;
          flex_minutes: number;
          id: string;
          notes: string | null;
          origin_area: string | null;
          origin_fuzzed: unknown;
          origin_label: string;
          origin_point: unknown;
          recurring_days: number[] | null;
          recurring_until: string | null;
          route: unknown;
          seats_available: number;
          seats_total: number;
          series_id: string | null;
          status: Database["public"]["Enums"]["offer_status"];
          updated_at: string;
          vehicle_id: string;
          women_only: boolean;
        };
        ComputedFields: never;
        Insert: {
          college_id: string;
          cost_per_seat?: number | null;
          created_at?: string;
          depart_at: string;
          dest_area?: string | null;
          dest_fuzzed: unknown;
          dest_label: string;
          dest_point: unknown;
          driver_id: string;
          flex_minutes?: number;
          id?: string;
          notes?: string | null;
          origin_area?: string | null;
          origin_fuzzed: unknown;
          origin_label: string;
          origin_point: unknown;
          recurring_days?: number[] | null;
          recurring_until?: string | null;
          route?: unknown;
          seats_available: number;
          seats_total: number;
          series_id?: string | null;
          status?: Database["public"]["Enums"]["offer_status"];
          updated_at?: string;
          vehicle_id: string;
          women_only?: boolean;
        };
        Update: {
          college_id?: string;
          cost_per_seat?: number | null;
          created_at?: string;
          depart_at?: string;
          dest_area?: string | null;
          dest_fuzzed?: unknown;
          dest_label?: string;
          dest_point?: unknown;
          driver_id?: string;
          flex_minutes?: number;
          id?: string;
          notes?: string | null;
          origin_area?: string | null;
          origin_fuzzed?: unknown;
          origin_label?: string;
          origin_point?: unknown;
          recurring_days?: number[] | null;
          recurring_until?: string | null;
          route?: unknown;
          seats_available?: number;
          seats_total?: number;
          series_id?: string | null;
          status?: Database["public"]["Enums"]["offer_status"];
          updated_at?: string;
          vehicle_id?: string;
          women_only?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "ride_offers_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "my_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "offers_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "ride_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      ride_requests: {
        Row: {
          college_id: string;
          created_at: string;
          dest_area: string | null;
          dest_fuzzed: unknown;
          dest_label: string;
          dest_point: unknown;
          id: string;
          notes: string | null;
          pickup_area: string | null;
          pickup_fuzzed: unknown;
          pickup_label: string;
          pickup_point: unknown;
          recurring_days: number[] | null;
          recurring_until: string | null;
          rider_id: string;
          seats_needed: number;
          series_id: string | null;
          status: Database["public"]["Enums"]["ride_request_status"];
          updated_at: string;
          window_end: string;
          window_start: string;
          women_only_pref: boolean;
        };
        ComputedFields: never;
        Insert: {
          college_id: string;
          created_at?: string;
          dest_area?: string | null;
          dest_fuzzed: unknown;
          dest_label: string;
          dest_point: unknown;
          id?: string;
          notes?: string | null;
          pickup_area?: string | null;
          pickup_fuzzed: unknown;
          pickup_label: string;
          pickup_point: unknown;
          recurring_days?: number[] | null;
          recurring_until?: string | null;
          rider_id: string;
          seats_needed?: number;
          series_id?: string | null;
          status?: Database["public"]["Enums"]["ride_request_status"];
          updated_at?: string;
          window_end: string;
          window_start: string;
          women_only_pref?: boolean;
        };
        Update: {
          college_id?: string;
          created_at?: string;
          dest_area?: string | null;
          dest_fuzzed?: unknown;
          dest_label?: string;
          dest_point?: unknown;
          id?: string;
          notes?: string | null;
          pickup_area?: string | null;
          pickup_fuzzed?: unknown;
          pickup_label?: string;
          pickup_point?: unknown;
          recurring_days?: number[] | null;
          recurring_until?: string | null;
          rider_id?: string;
          seats_needed?: number;
          series_id?: string | null;
          status?: Database["public"]["Enums"]["ride_request_status"];
          updated_at?: string;
          window_end?: string;
          window_start?: string;
          women_only_pref?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "ride_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "my_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "requests_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "ride_requests";
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
      vehicle_plates: {
        Row: {
          plate_number: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          plate_number: string;
          vehicle_id: string;
        };
        Update: {
          plate_number?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_plates_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: true;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          college_id: string;
          color: string;
          created_at: string;
          id: string;
          is_active: boolean;
          make: string;
          model: string;
          owner_id: string;
          seats: number;
          type: Database["public"]["Enums"]["vehicle_type"];
        };
        ComputedFields: never;
        Insert: {
          college_id: string;
          color: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          make: string;
          model: string;
          owner_id: string;
          seats: number;
          type: Database["public"]["Enums"]["vehicle_type"];
        };
        Update: {
          college_id?: string;
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          make?: string;
          model?: string;
          owner_id?: string;
          seats?: number;
          type?: Database["public"]["Enums"]["vehicle_type"];
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      my_college: {
        Row: {
          campus_lat: number | null;
          campus_lng: number | null;
          city: string;
          cost_sharing_enabled: boolean;
          country_code: string;
          currency: string;
          id: string;
          name: string;
          short_name: string;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          campus_lat?: never;
          campus_lng?: never;
          city?: string | null;
          cost_sharing_enabled?: boolean | null;
          country_code?: string | null;
          currency?: string | null;
          id?: string | null;
          name?: string | null;
          short_name?: string | null;
          timezone?: string | null;
        };
        Update: {
          campus_lat?: never;
          campus_lng?: never;
          city?: string | null;
          cost_sharing_enabled?: boolean | null;
          country_code?: string | null;
          currency?: string | null;
          id?: string | null;
          name?: string | null;
          short_name?: string | null;
          timezone?: string | null;
        };
        Relationships: [];
      };
      my_offers: {
        Row: {
          college_id: string;
          cost_per_seat: number | null;
          created_at: string;
          depart_at: string;
          dest_area: string | null;
          dest_label: string;
          dest_lat: number | null;
          dest_lng: number | null;
          flex_minutes: number;
          id: string;
          notes: string | null;
          origin_area: string | null;
          origin_label: string;
          origin_lat: number | null;
          origin_lng: number | null;
          recurring_days: number[] | null;
          recurring_until: string | null;
          seats_available: number;
          seats_total: number;
          series_id: string | null;
          status: Database["public"]["Enums"]["offer_status"];
          vehicle_color: string;
          vehicle_id: string;
          vehicle_make: string;
          vehicle_model: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
          women_only: boolean;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "ride_offers_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "my_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "offers_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "ride_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      my_requests: {
        Row: {
          college_id: string;
          created_at: string;
          dest_area: string | null;
          dest_label: string;
          dest_lat: number | null;
          dest_lng: number | null;
          id: string;
          notes: string | null;
          pickup_area: string | null;
          pickup_label: string;
          pickup_lat: number | null;
          pickup_lng: number | null;
          recurring_days: number[] | null;
          recurring_until: string | null;
          seats_needed: number;
          series_id: string | null;
          status: Database["public"]["Enums"]["ride_request_status"];
          window_end: string;
          window_start: string;
          women_only_pref: boolean;
        };
        ComputedFields: never;
        Insert: {
          college_id?: string | null;
          created_at?: string | null;
          dest_area?: string | null;
          dest_label?: string | null;
          dest_lat?: never;
          dest_lng?: never;
          id?: string | null;
          notes?: string | null;
          pickup_area?: string | null;
          pickup_label?: string | null;
          pickup_lat?: never;
          pickup_lng?: never;
          recurring_days?: number[] | null;
          recurring_until?: string | null;
          seats_needed?: number | null;
          series_id?: string | null;
          status?: Database["public"]["Enums"]["ride_request_status"] | null;
          window_end?: string | null;
          window_start?: string | null;
          women_only_pref?: boolean | null;
        };
        Update: {
          college_id?: string | null;
          created_at?: string | null;
          dest_area?: string | null;
          dest_label?: string | null;
          dest_lat?: never;
          dest_lng?: never;
          id?: string | null;
          notes?: string | null;
          pickup_area?: string | null;
          pickup_label?: string | null;
          pickup_lat?: never;
          pickup_lng?: never;
          recurring_days?: number[] | null;
          recurring_until?: string | null;
          seats_needed?: number | null;
          series_id?: string | null;
          status?: Database["public"]["Enums"]["ride_request_status"] | null;
          window_end?: string | null;
          window_start?: string | null;
          women_only_pref?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "ride_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "my_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "requests_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "ride_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      offers_public: {
        Row: {
          college_id: string;
          cost_per_seat: number | null;
          depart_at: string;
          dest_area: string | null;
          dest_lat: number | null;
          dest_lng: number | null;
          driver_first_name: string | null;
          driver_id: string;
          driver_rating_avg: number | null;
          driver_rating_count: number;
          flex_minutes: number;
          id: string;
          is_recurring: boolean | null;
          notes: string | null;
          origin_area: string | null;
          origin_lat: number | null;
          origin_lng: number | null;
          seats_available: number;
          seats_total: number;
          status: Database["public"]["Enums"]["offer_status"];
          vehicle_color: string;
          vehicle_make: string;
          vehicle_model: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
          women_only: boolean;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "ride_offers_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_offers_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
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
          {
            foreignKeyName: "profiles_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
        ];
      };
      requests_public: {
        Row: {
          college_id: string;
          dest_area: string | null;
          dest_lat: number | null;
          dest_lng: number | null;
          id: string;
          is_recurring: boolean | null;
          notes: string | null;
          pickup_area: string | null;
          pickup_lat: number | null;
          pickup_lng: number | null;
          rider_first_name: string | null;
          rider_id: string;
          rider_rating_avg: number | null;
          rider_rating_count: number;
          seats_needed: number;
          status: Database["public"]["Enums"]["ride_request_status"];
          window_end: string;
          window_start: string;
          women_only_pref: boolean;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "ride_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "colleges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_college_id_fkey";
            columns: ["college_id"];
            isOneToOne: false;
            referencedRelation: "my_college";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ride_requests_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
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
      cancel_ride_offer: { Args: { p_id: string }; Returns: undefined };
      cancel_ride_request: { Args: { p_id: string }; Returns: undefined };
      check_post_rate_limit: { Args: { p_uid: string }; Returns: undefined };
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
      find_matches_for_offer: {
        Args: { p_offer_id: string };
        Returns: {
          dest_area: string;
          dest_lat: number;
          dest_lng: number;
          detour_m: number;
          is_recurring: boolean;
          notes: string;
          pickup_area: string;
          pickup_lat: number;
          pickup_lng: number;
          request_id: string;
          rider_first_name: string;
          rider_id: string;
          rider_rating_avg: number;
          rider_rating_count: number;
          seats_needed: number;
          time_gap_minutes: number;
          window_end: string;
          window_start: string;
          women_only_pref: boolean;
        }[];
      };
      find_matches_for_request: {
        Args: { p_request_id: string };
        Returns: {
          depart_at: string;
          dest_area: string;
          dest_lat: number;
          dest_lng: number;
          detour_m: number;
          driver_first_name: string;
          driver_id: string;
          driver_rating_avg: number;
          driver_rating_count: number;
          flex_minutes: number;
          is_recurring: boolean;
          notes: string;
          offer_id: string;
          origin_area: string;
          origin_lat: number;
          origin_lng: number;
          seats_available: number;
          time_gap_minutes: number;
          vehicle_color: string;
          vehicle_make: string;
          vehicle_model: string;
          vehicle_type: Database["public"]["Enums"]["vehicle_type"];
          women_only: boolean;
        }[];
      };
      fuzz_location: { Args: { p_owner: string; p_point: unknown }; Returns: unknown };
      hook_before_user_created: { Args: { event: Json }; Returns: Json };
      is_blocked_between: { Args: { p_a: string; p_b: string }; Returns: boolean };
      is_blocked_email_domain: { Args: { p_domain: string }; Returns: boolean };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      materialize_all_series: { Args: Record<PropertyKey, never>; Returns: number };
      materialize_offer_series: { Args: { p_template_id: string }; Returns: number };
      materialize_request_series: { Args: { p_template_id: string }; Returns: number };
      offer_line: {
        Args: { p_dest: unknown; p_origin: unknown; p_route: unknown };
        Returns: unknown;
      };
      record_email_verification: { Args: Record<PropertyKey, never>; Returns: string };
      reject_college_request: { Args: { p_request_id: string }; Returns: undefined };
      remove_vehicle: { Args: { p_id: string }; Returns: undefined };
      rounded_detour_m: { Args: { p_line: unknown; p_point: unknown }; Returns: number };
      route_fits: {
        Args: {
          p_dest_radius_m: number;
          p_dropoff: unknown;
          p_line: unknown;
          p_offer_dest: unknown;
          p_pickup: unknown;
          p_pickup_radius_m: number;
        };
        Returns: boolean;
      };
      save_ride_offer: {
        Args: {
          p_cost_per_seat?: number;
          p_depart_local: string;
          p_dest_area?: string;
          p_dest_label: string;
          p_dest_lat: number;
          p_dest_lng: number;
          p_flex_minutes?: number;
          p_id?: string;
          p_notes?: string;
          p_origin_area?: string;
          p_origin_label: string;
          p_origin_lat: number;
          p_origin_lng: number;
          p_recurring_days?: number[];
          p_recurring_until?: string;
          p_route_geojson?: string;
          p_seats_total: number;
          p_vehicle_id: string;
          p_women_only?: boolean;
        };
        Returns: string;
      };
      save_ride_request: {
        Args: {
          p_date: string;
          p_dest_area?: string;
          p_dest_label: string;
          p_dest_lat: number;
          p_dest_lng: number;
          p_id?: string;
          p_notes?: string;
          p_pickup_area?: string;
          p_pickup_label: string;
          p_pickup_lat: number;
          p_pickup_lng: number;
          p_recurring_days?: number[];
          p_recurring_until?: string;
          p_seats_needed?: number;
          p_window_end: string;
          p_window_start: string;
          p_women_only_pref?: boolean;
        };
        Returns: string;
      };
      save_vehicle: {
        Args: {
          p_color: string;
          p_id?: string;
          p_make: string;
          p_model: string;
          p_plate_number: string;
          p_seats: number;
          p_type: Database["public"]["Enums"]["vehicle_type"];
        };
        Returns: string;
      };
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
      time_fits: {
        Args: {
          p_depart: string;
          p_flex_minutes: number;
          p_window_end: string;
          p_window_start: string;
        };
        Returns: boolean;
      };
      time_gap_minutes: {
        Args: { p_depart: string; p_window_end: string; p_window_start: string };
        Returns: number;
      };
      validated_point: {
        Args: { p_college_id: string; p_lat: number; p_lng: number; p_what: string };
        Returns: unknown;
      };
      validated_recurrence: {
        Args: { p_days: number[]; p_first: string; p_until: string };
        Returns: number[];
      };
    };
    Enums: {
      college_status: "active" | "pending";
      gender: "female" | "male" | "other" | "prefer_not";
      offer_status: "open" | "full" | "departed" | "completed" | "cancelled";
      request_status: "pending" | "approved" | "rejected";
      ride_request_status: "open" | "matched" | "cancelled" | "expired";
      user_role: "student" | "staff";
      vehicle_type: "car" | "bike";
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
      offer_status: ["open", "full", "departed", "completed", "cancelled"],
      request_status: ["pending", "approved", "rejected"],
      ride_request_status: ["open", "matched", "cancelled", "expired"],
      user_role: ["student", "staff"],
      vehicle_type: ["car", "bike"],
    },
  },
} as const;

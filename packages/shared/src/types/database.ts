export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      announcement_attachments: {
        Row: {
          announcement_id: string;
          byte_size: number;
          checksum_sha256: string;
          created_at: string;
          created_by: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          storage_path: string;
          village_id: string;
        };
        Insert: {
          announcement_id: string;
          byte_size: number;
          checksum_sha256: string;
          created_at?: string;
          created_by?: string | null;
          file_name: string;
          id?: string;
          mime_type: string;
          storage_path: string;
          village_id: string;
        };
        Update: {
          announcement_id?: string;
          byte_size?: number;
          checksum_sha256?: string;
          created_at?: string;
          created_by?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string;
          storage_path?: string;
          village_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_attachments_parent_fkey";
            columns: ["announcement_id", "village_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id", "village_id"];
          },
          {
            foreignKeyName: "announcement_attachments_village_id_fkey";
            columns: ["village_id"];
            isOneToOne: false;
            referencedRelation: "villages";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          publish_at: string | null;
          status: Database["public"]["Enums"]["announcement_status"];
          title: string;
          updated_at: string;
          village_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          publish_at?: string | null;
          status?: Database["public"]["Enums"]["announcement_status"];
          title: string;
          updated_at?: string;
          village_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          publish_at?: string | null;
          status?: Database["public"]["Enums"]["announcement_status"];
          title?: string;
          updated_at?: string;
          village_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_village_id_fkey";
            columns: ["village_id"];
            isOneToOne: false;
            referencedRelation: "villages";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          action: string;
          created_at: string;
          description: string | null;
          id: string;
          key: string;
          resource: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          key: string;
          resource: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          key?: string;
          resource?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          created_at: string;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          created_at?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          created_at?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_system: boolean;
          key: string;
          name: string;
          village_id: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key: string;
          name: string;
          village_id?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string;
          name?: string;
          village_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roles_village_id_fkey";
            columns: ["village_id"];
            isOneToOne: false;
            referencedRelation: "villages";
            referencedColumns: ["id"];
          },
        ];
      };
      user_permissions: {
        Row: {
          effect: Database["public"]["Enums"]["permission_effect"];
          granted_at: string;
          granted_by: string | null;
          id: string;
          permission_id: string;
          user_id: string;
          village_id: string | null;
        };
        Insert: {
          effect?: Database["public"]["Enums"]["permission_effect"];
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          permission_id: string;
          user_id: string;
          village_id?: string | null;
        };
        Update: {
          effect?: Database["public"]["Enums"]["permission_effect"];
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          permission_id?: string;
          user_id?: string;
          village_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_permissions_village_id_fkey";
            columns: ["village_id"];
            isOneToOne: false;
            referencedRelation: "villages";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          role_id: string;
          user_id: string;
          village_id: string | null;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role_id: string;
          user_id: string;
          village_id?: string | null;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role_id?: string;
          user_id?: string;
          village_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_village_id_fkey";
            columns: ["village_id"];
            isOneToOne: false;
            referencedRelation: "villages";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          status: Database["public"]["Enums"]["user_status"];
          updated_at: string;
          username: string | null;
          village_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
          username?: string | null;
          village_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
          username?: string | null;
          village_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_village_id_fkey";
            columns: ["village_id"];
            isOneToOne: false;
            referencedRelation: "villages";
            referencedColumns: ["id"];
          },
        ];
      };
      villages: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          tier: Database["public"]["Enums"]["village_tier"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          tier?: Database["public"]["Enums"]["village_tier"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          tier?: Database["public"]["Enums"]["village_tier"];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      announcement_status_counts: {
        Args: { p_now?: string; p_village: string };
        Returns: {
          status: string;
          total: number;
        }[];
      };
      current_village_ids: { Args: { p_user?: string }; Returns: string[] };
      is_super_admin: { Args: { p_user?: string }; Returns: boolean };
      is_village_admin: {
        Args: { p_user?: string; p_village: string };
        Returns: boolean;
      };
      user_has_permission: {
        Args: { p_permission: string; p_user?: string; p_village?: string };
        Returns: boolean;
      };
      user_permission_keys: { Args: { p_village?: string }; Returns: string[] };
    };
    Enums: {
      announcement_status: "draft" | "published" | "archived";
      permission_effect: "allow" | "deny";
      user_status: "invited" | "active" | "suspended";
      village_tier: "free" | "tier_1";
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      announcement_status: ["draft", "published", "archived"],
      permission_effect: ["allow", "deny"],
      user_status: ["invited", "active", "suspended"],
      village_tier: ["free", "tier_1"],
    },
  },
} as const;

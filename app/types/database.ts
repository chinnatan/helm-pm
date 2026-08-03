export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          full_name: string | null;
          avatar_url: string | null;
          active_workspace_id: string | null;
          task_card_density: string;
          notification_preferences: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          active_workspace_id?: string | null;
          task_card_density?: string;
          notification_preferences?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          active_workspace_id?: string | null;
          task_card_density?: string;
          notification_preferences?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: string;
          job_role: string | null;
          weekly_capacity_hours: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: string;
          job_role?: string | null;
          weekly_capacity_hours?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: string;
          job_role?: string | null;
          weekly_capacity_hours?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      member_month_capacities: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          month_start: string;
          hours: number;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          month_start: string;
          hours: number;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          month_start?: string;
          hours?: number;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_month_calendars: {
        Row: {
          id: string;
          workspace_id: string;
          month_start: string;
          working_days: number | null;
          holiday_days: number;
          meeting_days: number;
          company_event_days: number;
          leave_days: number;
          hours_per_day: number;
          notes: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          month_start: string;
          working_days?: number | null;
          holiday_days?: number;
          meeting_days?: number;
          company_event_days?: number;
          leave_days?: number;
          hours_per_day?: number;
          notes?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          month_start?: string;
          working_days?: number | null;
          holiday_days?: number;
          meeting_days?: number;
          company_event_days?: number;
          leave_days?: number;
          hours_per_day?: number;
          notes?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          color: string;
          customer_id: string | null;
          owner_id: string | null;
          created_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          color?: string;
          customer_id?: string | null;
          owner_id?: string | null;
          created_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          description?: string | null;
          color?: string;
          customer_id?: string | null;
          owner_id?: string | null;
          created_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          company: string | null;
          contact_email: string | null;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          company?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          company?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          customer_id: string;
          title: string;
          met_at: string;
          summary: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          title: string;
          met_at?: string;
          summary?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          title?: string;
          met_at?: string;
          summary?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      requirements: {
        Row: {
          id: string;
          customer_id: string;
          meeting_id: string | null;
          title: string;
          description: string | null;
          status: string;
          task_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          meeting_id?: string | null;
          title: string;
          description?: string | null;
          status?: string;
          task_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          meeting_id?: string | null;
          title?: string;
          description?: string | null;
          status?: string;
          task_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      labels: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          assignee_id: string | null;
          tester_id: string | null;
          milestone_id: string | null;
          customer_id: string | null;
          created_by: string | null;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          due_date: string | null;
          start_date: string | null;
          estimate_hours: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          assignee_id?: string | null;
          tester_id?: string | null;
          milestone_id?: string | null;
          customer_id?: string | null;
          created_by?: string | null;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          start_date?: string | null;
          estimate_hours?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          assignee_id?: string | null;
          tester_id?: string | null;
          milestone_id?: string | null;
          customer_id?: string | null;
          created_by?: string | null;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          start_date?: string | null;
          estimate_hours?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          completed: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          title?: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      task_labels: {
        Row: { task_id: string; label_id: string };
        Insert: { task_id: string; label_id: string };
        Update: { task_id?: string; label_id?: string };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          task_id: string;
          user_id: string | null;
          action: string;
          field_name: string | null;
          old_value: string | null;
          new_value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id?: string | null;
          action: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string | null;
          action?: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_task_preferences: {
        Row: {
          user_id: string;
          task_id: string;
          is_pinned: boolean;
          scheduled_date: string | null;
          sort_order: number;
        };
        Insert: {
          user_id: string;
          task_id: string;
          is_pinned?: boolean;
          scheduled_date?: string | null;
          sort_order?: number;
        };
        Update: {
          user_id?: string;
          task_id?: string;
          is_pinned?: boolean;
          scheduled_date?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      task_dependencies: {
        Row: {
          id: string;
          task_id: string;
          depends_on_task_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          depends_on_task_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          depends_on_task_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          date: string;
          start_date: string;
          due_date: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          date?: string;
          start_date: string;
          due_date: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          date?: string;
          start_date?: string;
          due_date?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          type: string;
          message: string;
          read: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          type: string;
          message: string;
          read?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          type?: string;
          message?: string;
          read?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: string;
          notification_id: string;
          channel: string;
          status: string;
          error: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          notification_id: string;
          channel?: string;
          status: string;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          notification_id?: string;
          channel?: string;
          status?: string;
          error?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          task_id: string;
          uploaded_by: string;
          file_url: string;
          filename: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          uploaded_by: string;
          file_url: string;
          filename: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          uploaded_by?: string;
          file_url?: string;
          filename?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_invites: {
        Row: {
          id: string;
          workspace_id: string;
          token: string;
          invite_type: string;
          email: string | null;
          role: string;
          job_role: string | null;
          expires_at: string;
          created_by: string | null;
          created_at: string;
          revoked_at: string | null;
          accepted_at: string | null;
          accepted_by: string | null;
          max_uses: number;
          uses_count: number;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          token: string;
          invite_type: string;
          email?: string | null;
          role?: string;
          job_role?: string | null;
          expires_at: string;
          created_by?: string | null;
          created_at?: string;
          revoked_at?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          max_uses?: number;
          uses_count?: number;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          token?: string;
          invite_type?: string;
          email?: string | null;
          role?: string;
          job_role?: string | null;
          expires_at?: string;
          created_by?: string | null;
          created_at?: string;
          revoked_at?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          max_uses?: number;
          uses_count?: number;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          workspace_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          entity_label: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          entity_label?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          entity_label?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_workspace: {
        Args: { ws_name: string };
        Returns: string;
      };
      set_active_workspace: {
        Args: { ws_id: string };
        Returns: string;
      };
      create_workspace_invite: {
        Args: {
          p_workspace_id: string;
          p_invite_type: string;
          p_expires_at: string;
          p_role?: string;
          p_job_role?: string | null;
          p_email?: string | null;
          p_max_uses?: number;
        };
        Returns: Json;
      };
      get_invite_preview: {
        Args: { p_token: string };
        Returns: Json;
      };
      accept_workspace_invite: {
        Args: { p_token: string };
        Returns: string;
      };
      revoke_workspace_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

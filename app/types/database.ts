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
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: string;
          job_role?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: string;
          job_role?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          date?: string;
          start_date: string;
          due_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          date?: string;
          start_date?: string;
          due_date?: string;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          type: string;
          message: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          type?: string;
          message?: string;
          read?: boolean;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

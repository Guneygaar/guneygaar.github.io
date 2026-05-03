export type SortedRole = 'Admin' | 'Servicing' | 'Creative' | 'Client';

export interface AppUser {
  name: string | null;
  email: string | null;
  role: SortedRole | null;
  effectiveRole: SortedRole | null;
  previewRole: SortedRole | null;
  workspace_id?: string | null;
}

export interface AppWorkspace {
  id?: string;
  slug?: string;
  name?: string;
  ai_writer?: boolean;
  ai_qc?: boolean;
  ai_chat?: boolean;
  ai_email_brief?: boolean;
  [key: string]: unknown;
}

export interface SortedRoleReadyEvent extends CustomEvent {
  detail: {
    role: SortedRole | null;
    effectiveRole: SortedRole | null;
    email: string | null;
    name: string | null;
    workspace: AppWorkspace | null;
  };
}

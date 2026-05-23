// shared/types/user.ts
// User model for both customers and staff (installers, admins)

export type UserRole = 
  | 'customer' 
  | 'installer' 
  | 'project_manager' 
  | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  company_name?: string; // for commercial customers
}

export interface AuthUser extends User {
  token: string;
  refresh_token?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: UserRole;
}

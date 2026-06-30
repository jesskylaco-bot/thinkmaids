export type JobStatus = "Scheduled" | "In progress" | "Completed" | string;

export type Job = {
  id: number;
  job_number: string;
  description: string;
  status: JobStatus;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  service_type?: string;
  job_created_date?: string;
  job_scheduled_start: string;
  job_scheduled_end?: string;
  assigned_employee_raw?: string;
  assigned_user_id?: number | null;
  cleaner_name?: string;
  job_amount: number;
  due_amount: number;
  notes?: string;
  special_instructions?: string;
  tags?: string;
  is_recurring?: number;
  estimated_commission?: number;
  commission_percentage?: number;
};

export type Cleaner = {
  id: number;
  name: string;
  email: string;
  role?: string;
  active: number;
  created_at?: string;
  commission_percentage: number | null;
  job_count?: number;
};

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "cleaner";
};

import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'

export interface JobItem {
  product_name: string
  quantity: number
  move_id: number | null
}

export interface JobSummary {
  job_id: number
  odoo_reference: string
  sales_order_ref: string | null
  customer_name: string
  phone: string | null
  address: string | null
  warehouse: string
  scheduled_date: string
  status: string
  collection_required: boolean
  collection_method: string | null
  expected_collection_amount: number | null
  sync_status: string
}

export interface JobDetail extends JobSummary {
  delivery_notes: string | null
  additional_info: string | null
  account_no: string | null
  items: JobItem[]
  proof_of_delivery: any | null
  cash_collection: any | null
}

interface JobListResponse {
  jobs: JobSummary[]
  fetched_at: string
}

export function useJobs(scope: 'today' | 'pending' | 'recent' | 'all' | 'upcoming') {
  return useQuery({
    queryKey: ['jobs', scope],
    queryFn: () => apiRequest<JobListResponse>(`/me/jobs?scope=${scope}`),
    staleTime: 30_000,
  })
}

export function useJobsByDate(date: string) {
  // date format: "YYYY-MM-DD"
  return useQuery({
    queryKey: ['jobs', 'date', date],
    queryFn: async () => {
      // Fetch both pending and recent jobs, filter client-side by date
      const [pending, recent] = await Promise.all([
        apiRequest<JobListResponse>('/me/jobs?scope=pending'),
        apiRequest<JobListResponse>('/me/jobs?scope=recent'),
      ])
      const allJobs = [...pending.jobs, ...recent.jobs]
      return allJobs.filter((j) => j.scheduled_date.startsWith(date))
    },
    staleTime: 60_000,
  })
}

export function useJob(id: number) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => apiRequest<JobDetail>(`/jobs/${id}`),
  })
}

interface DriverStats {
  total_deliveries: number
  on_time_rate: number
  rating: number
}

export function useDriverStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => apiRequest<DriverStats>('/me/stats'),
    staleTime: 300_000, // 5 min cache
  })
}

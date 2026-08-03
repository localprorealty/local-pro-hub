import { api } from './api'

export interface CapProgress {
  has_cap: boolean
  cap_amount: number | null
  cap_paid: number
  production_paid: number
  credit_paid: number
  cap_remaining: number | null
  percent_complete: number
  capped_out: boolean
  commission_split: string | null
  monthly_fee: string | null
  cap_start_date: string | null
  next_anniversary: string | null
}

export interface Transaction {
  id: string
  address: string
  city: string
  state: string
  status: string
  closing_date: string | null
  price: number | string
  representing: string | null
  net_commission: number
  adjusted_basis: number
  paid_at: string | null
  payment_note: string | null
  commission_rows: string[]
}

export interface TransactionHistory {
  transactions: Transaction[]
  summary: {
    total_earned: number
    pending: number
    this_month: number
    total_transactions: number
    closed_count: number
  }
}

export async function getCapProgress(): Promise<CapProgress> {
  return api<CapProgress>('/brokermint/my-cap-progress')
}

export async function getMyHistory(): Promise<TransactionHistory> {
  return api<TransactionHistory>('/brokermint/my-history')
}

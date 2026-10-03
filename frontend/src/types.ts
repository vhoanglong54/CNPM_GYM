export type Role = 'OWNER' | 'RECEPTIONIST' | 'TRAINER' | 'MEMBER'

export interface User {
  id: string
  email: string
  fullName: string
  roles: Role[]
  memberProfileId?: string
  trainerProfileId?: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
}

export interface MembershipPlan {
  id: string
  name: string
  description?: string
  type: 'DURATION' | 'VISITS'
  price: string | number
  durationDays?: number
  visitLimit?: number
  isActive: boolean
}

export interface PtPackage {
  id: string
  name: string
  description?: string
  sessionCount: number
  price: string | number
  isActive: boolean
}

export interface Order {
  id: string
  orderNumber: string
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  totalAmount: string | number
  createdAt: string
  member: { id: string; fullName: string; email: string }
  items: Array<{ id: string; productName: string; productType: string; unitPrice: string | number }>
  payments: Array<{
    id: string
    method: 'CASH' | 'TRANSFER_DEMO'
    status: 'AWAITING_CONFIRMATION' | 'PAID' | 'REJECTED' | 'EXPIRED' | 'FAILED'
    requestedAt: string
    expiresAt?: string
    paidAt?: string
    confirmedAt?: string
    rejectedAt?: string
    rejectionReason?: string
    confirmedBy?: {
      id: string
      fullName: string
      email: string
      roles: Array<{ role: { code: Role } }>
    }
    receipt?: { receiptNumber: string }
  }>
}

export interface Profile {
  id: string
  email: string
  fullName: string
  phone?: string
  status: string
  memberProfile?: {
    id: string
    memberCode: string
    memberships: Array<{ id: string; startDate: string; visitsTotal?: number; visitsUsed: number; endDate?: string; isPaused: boolean; plan: MembershipPlan }>
    ptPackages: Array<{ id: string; sessionsTotal: number; sessionsUsed: number; sessionsReserved: number; expiresAt?: string; package: PtPackage }>
  }
  trainerProfile?: { id: string; trainerCode: string; specialties?: string }
}

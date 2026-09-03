/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'

import type {
  RedemptionRequest,
  PaymentRequest,
  AmountRequest,
  AffiliateTransferRequest,
  ApiResponse,
  TopupInfoResponse,
  RedemptionResponse,
  AmountResponse,
  PaymentResponse,
  StripePaymentResponse,
  AffiliateCodeResponse,
  AffiliateTransferResponse,
  BillingHistoryResponse,
  CompleteOrderRequest,
  AdminManualTopUpRequest,
  CreemPaymentRequest,
  CreemPaymentResponse,
  WaffoPaymentRequest,
  WaffoPaymentResponse,
  PaynicornPaymentRequest,
  PaynicornPaymentResponse,
  WaffoPancakePaymentRequest,
  WaffoPancakePaymentResponse,
} from './types'

// ============================================================================
// Wallet API Functions
// ============================================================================

/**
 * Check if API response is successful
 */
export function isApiSuccess(response: ApiResponse): boolean {
  return response.success === true || response.message === 'success'
}

/**
 * Get topup configuration info
 */
export async function getTopupInfo(): Promise<TopupInfoResponse> {
  const res = await api.get('/api/user/topup/info')
  return res.data
}

/**
 * Redeem a topup code
 */
export async function redeemTopupCode(
  request: RedemptionRequest
): Promise<RedemptionResponse> {
  const res = await api.post('/api/user/topup', request)
  return res.data
}

/**
 * Calculate payment amount for regular payment
 */
export async function calculateAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Stripe payment
 */
export async function calculateStripeAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/stripe/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request regular payment
 */
export async function requestPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  const res = await api.post('/api/user/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return {
    ...res.data,
    url: res.data.url || (res as unknown as { url?: string }).url,
  }
}

/**
 * Request Stripe payment
 */
export async function requestStripePayment(
  request: PaymentRequest
): Promise<StripePaymentResponse> {
  const res = await api.post('/api/user/stripe/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Creem payment
 */
export async function requestCreemPayment(
  request: CreemPaymentRequest
): Promise<CreemPaymentResponse> {
  const res = await api.post('/api/user/creem/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Waffo payment
 */
export async function requestWaffoPayment(
  request: WaffoPaymentRequest
): Promise<WaffoPaymentResponse> {
  const res = await api.post('/api/user/waffo/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Paynicorn payment
 */
export async function requestPaynicornPayment(
  request: PaynicornPaymentRequest
): Promise<PaynicornPaymentResponse> {
  const res = await api.post('/api/user/paynicorn/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Calculate payment amount for Waffo Pancake payment
 */
export async function calculateWaffoPancakeAmount(
  request: AmountRequest
): Promise<AmountResponse> {
  const res = await api.post('/api/user/waffo-pancake/amount', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Waffo Pancake payment
 */
export async function requestWaffoPancakePayment(
  request: WaffoPancakePaymentRequest
): Promise<WaffoPancakePaymentResponse> {
  const res = await api.post('/api/user/waffo-pancake/pay', request, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Create Wepay order (without executing payment)
 */
export async function createWepayOrder(
  amount: number
): Promise<ApiResponse<{ trade_no: string; amount: number }>> {
  const res = await api.post('/api/user/wepay/order', { amount }, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Request Wepay payment (SBP or MIR)
 */
export async function requestWepayPay(
  amount: number,
  paymentMethod: 'sbp' | 'mir',
  tradeNo: string
): Promise<ApiResponse<{ trade_no: string; code_url: string; code_img_url: string; pay_url: string; amount: number }>> {
  const res = await api.post('/api/user/wepay/pay', {
    amount,
    payment_method: paymentMethod,
    trade_no: tradeNo,
  }, {
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Query Wepay order status
 */
export async function queryWepayOrder(
  tradeNo: string,
  paymentMethod: 'sbp' | 'mir'
): Promise<ApiResponse<{ is_success: boolean }>> {
  const res = await api.get('/api/user/wepay/query', {
    params: { trade_no: tradeNo, payment_method: paymentMethod },
  })
  return res.data
}

/**
 * Get affiliate code
 */
export async function getAffiliateCode(): Promise<AffiliateCodeResponse> {
  const res = await api.get('/api/user/aff')
  return res.data
}

/**
 * Transfer affiliate quota to balance
 */
export async function transferAffiliateQuota(
  request: AffiliateTransferRequest
): Promise<AffiliateTransferResponse> {
  const res = await api.post('/api/user/aff_transfer', request)
  return res.data
}

/**
 * Get billing history for current user
 */
export async function getUserBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  const res = await api.get(`/api/user/topup/self?${params.toString()}`)
  return res.data
}

/**
 * Get billing history for all users (admin only)
 */
export async function getAllBillingHistory(
  page: number,
  pageSize: number,
  keyword?: string
): Promise<ApiResponse<BillingHistoryResponse>> {
  const params = new URLSearchParams({
    p: page.toString(),
    page_size: pageSize.toString(),
  })
  if (keyword) {
    params.append('keyword', keyword)
  }
  const res = await api.get(`/api/user/topup?${params.toString()}`)
  return res.data
}

/**
 * Complete a pending order (admin only)
 */
export async function completeOrder(
  request: CompleteOrderRequest
): Promise<ApiResponse> {
  const res = await api.post('/api/user/topup/complete', request)
  return res.data
}

/**
 * Admin manual top-up: directly adjust a user's balance (recharge or reversal)
 */
export async function adminTopup(
  request: AdminManualTopUpRequest
): Promise<ApiResponse> {
  const res = await api.post('/api/user/topup/admin', request)
  return res.data
}

/**
 * Create Silkroad (Gwiff Pay) order
 */
export async function createSilkroadOrder(
  amount: number,
  paymentMethod: string
): Promise<ApiResponse<{ trade_no: string; code_url: string; code_img_url: string; pay_url: string }>> {
  const res = await api.post('/api/user/silkroad/pay', {
    amount,
    payment_method: paymentMethod,
  })
  return res.data
}

/**
 * Query Silkroad (Gwiff Pay) order status
 */
export async function querySilkroadOrder(
  tradeNo: string
): Promise<ApiResponse<{ is_success: boolean }>> {
  const res = await api.get('/api/user/silkroad/query', {
    params: { trade_no: tradeNo },
  })
  return res.data
}

/**
 * Create USDT payment order
 */
export async function createUsdtOrder(
  amount: number,
  blockchainType: string
): Promise<ApiResponse<{ trade_no: string; wallet_address: string; usdt_amount: string; blockchain_type: string; expire_time: number }>> {
  const res = await api.post('/api/user/usdt/pay', {
    amount,
    blockchain_type: blockchainType,
  })
  return res.data
}

/**
 * Query USDT order status
 */
export async function queryUsdtOrderStatus(
  tradeNo: string
): Promise<ApiResponse<{ status: string }>> {
  const res = await api.get(`/api/user/usdt/status/${tradeNo}`)
  return res.data
}

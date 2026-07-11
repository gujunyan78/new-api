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
import { useState, useCallback, useRef } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { createSilkroadOrder, querySilkroadOrder, isApiSuccess } from '../api'

export type SilkroadView = 'select' | 'sbp_qr'

export interface SilkroadPaymentState {
  view: SilkroadView
  tradeNo: string
  codeUrl: string
  codeImgUrl: string
  paymentMethod: string
}

export function useSilkroadPayment() {
  const [state, setState] = useState<SilkroadPaymentState>({
    view: 'select',
    tradeNo: '',
    codeUrl: '',
    codeImgUrl: '',
    paymentMethod: '',
  })
  const [loading, setLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingCountRef = useRef(0)
  const MAX_POLLING_ATTEMPTS = 100

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    pollingCountRef.current = 0
  }, [])

  const startPolling = useCallback(
    (tradeNo: string, onSuccess: () => void) => {
      clearPolling()
      pollingRef.current = setInterval(async () => {
        try {
          pollingCountRef.current++
          if (pollingCountRef.current > MAX_POLLING_ATTEMPTS) {
            clearPolling()
            toast.error(i18next.t('Payment timeout. Please check order status later.'))
            return
          }
          const response = await querySilkroadOrder(tradeNo)
          if (isApiSuccess(response) && response.data?.is_success) {
            clearPolling()
            toast.success(i18next.t('Payment successful!'))
            onSuccess()
          }
        } catch (_error) {
          // polling error, ignore
        }
      }, 3000)
    },
    [clearPolling]
  )

  const createOrder = useCallback(
    async (amount: number, paymentMethod: string) => {
      setLoading(true)
      try {
        const response = await createSilkroadOrder(amount, paymentMethod)
        if (!isApiSuccess(response) || !response.data?.trade_no) {
          toast.error(response.message || i18next.t('Failed to create order'))
          return false
        }
        setState({
          view: 'select',
          tradeNo: response.data!.trade_no,
          codeUrl: response.data!.code_url || '',
          codeImgUrl: response.data!.code_img_url || '',
          paymentMethod,
        })
        return true
      } catch (_error) {
        toast.error(i18next.t('Failed to create order'))
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const payWithSbp = useCallback(
    async (onSuccess: () => void) => {
      if (!state.tradeNo) return
      setLoading(true)
      try {
        setState((prev) => ({ ...prev, view: 'sbp_qr' }))
        startPolling(state.tradeNo, onSuccess)
      } finally {
        setLoading(false)
      }
    },
    [state.tradeNo, startPolling]
  )

  const cancel = useCallback(() => {
    clearPolling()
    setState({
      view: 'select',
      tradeNo: '',
      codeUrl: '',
      codeImgUrl: '',
      paymentMethod: '',
    })
  }, [clearPolling])

  return {
    state,
    loading,
    createOrder,
    payWithSbp,
    cancel,
  }
}

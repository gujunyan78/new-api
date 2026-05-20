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
import { createWepayOrder, requestWepayPay, queryWepayOrder, isApiSuccess } from '../api'

export type WepayView = 'select' | 'sbp_qr' | 'mir_confirm'

export interface WepayPaymentState {
  view: WepayView
  tradeNo: string
  codeUrl: string
  codeImgUrl: string
  paymentUrl: string
}

export function useWepayPayment() {
  const [state, setState] = useState<WepayPaymentState>({
    view: 'select',
    tradeNo: '',
    codeUrl: '',
    codeImgUrl: '',
    paymentUrl: '',
  })
  const [loading, setLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (tradeNo: string, onSuccess: () => void) => {
      clearPolling()
      pollingRef.current = setInterval(async () => {
        try {
          const response = await queryWepayOrder(tradeNo, 'sbp')
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

  const createOrder = useCallback(async (amount: number) => {
    setLoading(true)
    try {
      const response = await createWepayOrder(amount)
      if (!isApiSuccess(response) || !response.data?.trade_no) {
        toast.error(response.message || i18next.t('Failed to create order'))
        return null
      }
      setState((prev) => ({
        ...prev,
        view: 'select',
        tradeNo: response.data!.trade_no,
      }))
      return response.data.trade_no
    } catch (_error) {
      toast.error(i18next.t('Failed to create order'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const payWithSbp = useCallback(
    async (tradeNo: string, amount: number, onSuccess: () => void) => {
      setLoading(true)
      try {
        const response = await requestWepayPay(amount, 'sbp', tradeNo)
        if (!isApiSuccess(response)) {
          toast.error(response.message || i18next.t('Failed to process payment'))
          return false
        }
        if (response.data) {
          setState((prev) => ({
            ...prev,
            view: 'sbp_qr',
            codeUrl: response.data!.code_url || '',
            codeImgUrl: response.data!.code_img_url || '',
          }))
          startPolling(tradeNo, onSuccess)
          return true
        }
        return false
      } catch (_error) {
        toast.error(i18next.t('Failed to process payment'))
        return false
      } finally {
        setLoading(false)
      }
    },
    [startPolling]
  )

  const payWithMir = useCallback(async (tradeNo: string, amount: number) => {
    setLoading(true)
    try {
      const response = await requestWepayPay(amount, 'mir', tradeNo)
      if (!isApiSuccess(response)) {
        toast.error(response.message || i18next.t('Failed to process payment'))
        return false
      }
      if (response.data?.pay_url) {
        setState((prev) => ({
          ...prev,
          view: 'mir_confirm',
          paymentUrl: response.data!.pay_url,
        }))
        return true
      }
      return false
    } catch (_error) {
      toast.error(i18next.t('Failed to process payment'))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => ({ ...prev, view: 'select' }))
  }, [])

  const cancel = useCallback(() => {
    clearPolling()
    setState({
      view: 'select',
      tradeNo: '',
      codeUrl: '',
      codeImgUrl: '',
      paymentUrl: '',
    })
  }, [clearPolling])

  return {
    state,
    loading,
    createOrder,
    payWithSbp,
    payWithMir,
    goBack,
    cancel,
  }
}
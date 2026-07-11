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
import { useState, useCallback, useRef, useEffect } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { createUsdtOrder, queryUsdtOrderStatus, isApiSuccess } from '../api'

export interface UsdtPaymentState {
  tradeNo: string
  walletAddress: string
  usdtAmount: string
  blockchainType: string
  expireTime: number
}

export function useUsdtPayment() {
  const [state, setState] = useState<UsdtPaymentState>({
    tradeNo: '',
    walletAddress: '',
    usdtAmount: '',
    blockchainType: '',
    expireTime: 0,
  })
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [expired, setExpired] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAll = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (state.expireTime <= 0) return
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = state.expireTime - now
      if (remaining <= 0) {
        setTimeLeft(0)
        setExpired(true)
        clearAll()
      } else {
        setTimeLeft(remaining)
      }
    }
    updateCountdown()
    timerRef.current = setInterval(updateCountdown, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state.expireTime, clearAll])

  // Poll order status
  useEffect(() => {
    if (!state.tradeNo || expired) return
    const poll = async () => {
      try {
        const response = await queryUsdtOrderStatus(state.tradeNo)
        if (isApiSuccess(response) && response.data?.status === 'success') {
          clearAll()
          toast.success(i18next.t('Payment successful!'))
        }
      } catch {
        // silent retry
      }
    }
    pollingRef.current = setInterval(poll, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [state.tradeNo, expired, clearAll])

  const createOrder = useCallback(
    async (amount: number, blockchainType: string) => {
      setLoading(true)
      setExpired(false)
      try {
        const response = await createUsdtOrder(amount, blockchainType)
        if (!isApiSuccess(response) || !response.data) {
          toast.error(response.message || i18next.t('Failed to create order'))
          return false
        }
        setState({
          tradeNo: response.data.trade_no,
          walletAddress: response.data.wallet_address,
          usdtAmount: response.data.usdt_amount,
          blockchainType: response.data.blockchain_type || blockchainType,
          expireTime: response.data.expire_time || 0,
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

  const cancel = useCallback(() => {
    clearAll()
    setState({
      tradeNo: '',
      walletAddress: '',
      usdtAmount: '',
      blockchainType: '',
      expireTime: 0,
    })
    setTimeLeft(0)
    setExpired(false)
  }, [clearAll])

  return {
    state,
    loading,
    timeLeft,
    expired,
    createOrder,
    cancel,
  }
}

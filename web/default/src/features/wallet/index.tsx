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
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getSelf } from '@/lib/api'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { SectionPageLayout } from '@/components/layout'
import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { BillingHistoryDialog } from './components/dialogs/billing-history-dialog'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { SilkroadPaymentModal } from './components/dialogs/silkroad-payment-modal'
import { UsdtPaymentModal } from './components/dialogs/usdt-payment-modal'
import { WepayPaymentModal } from './components/dialogs/wepay-payment-modal'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import { DEFAULT_DISCOUNT_RATE } from './constants'
import {
  useTopupInfo,
  usePayment,
  useAffiliate,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
  useWepayPayment,
  useSilkroadPayment,
  useUsdtPayment,
} from './hooks'
import {
  getDefaultPaymentType,
  getMinTopupAmount,
  isWaffoPancakePayment,
} from './lib'
import type {
  UserWalletData,
  PaymentMethod,
  PresetAmount,
  CreemProduct,
} from './types'

interface WalletProps {
  initialShowHistory?: boolean
}

export function Wallet(props: WalletProps) {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)
  const [silkroadDialogOpen, setSilkroadDialogOpen] = useState(false)
  const [usdtDialogOpen, setUsdtDialogOpen] = useState(false)
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(true)

  const { status } = useStatus()
  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  // Calculate effective exchange rate - when display type is USD, use rate of 1
  const effectiveUsdExchangeRate = useMemo(() => {
    return currency?.quotaDisplayType === 'USD'
      ? 1
      : currency?.usdExchangeRate || 1
  }, [currency?.quotaDisplayType, currency?.usdExchangeRate])
  const {
    amount: paymentAmount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
  } = usePayment()
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()
  const {
    state: wepayState,
    loading: wepayLoading,
    createOrder,
    payWithSbp,
    payWithMir,
    goBack: wepayGoBack,
    cancel: wepayCancel,
  } = useWepayPayment()
  const {
    state: silkroadState,
    loading: silkroadLoading,
    createOrder: createSilkroadOrder,
    payWithSbp: silkroadPayWithSbp,
    cancel: silkroadCancel,
  } = useSilkroadPayment()
  const {
    state: usdtState,
    loading: usdtLoading,
    timeLeft: usdtTimeLeft,
    expired: usdtExpired,
    createOrder: createUsdtOrderAction,
    cancel: usdtCancel,
  } = useUsdtPayment()

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (props.initialShowHistory) {
      setBillingDialogOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [props.initialShowHistory])

  // Initialize topup amount when topup info is loaded
  useEffect(() => {
    if (topupInfo && topupAmount === 0) {
      const minTopup = getMinTopupAmount(topupInfo)
      setTopupAmount(minTopup)

      // Calculate initial payment amount with default payment type
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      calculatePaymentAmount(minTopup, defaultPaymentType)
    }
  }, [topupInfo, topupAmount, calculatePaymentAmount])

  // Get current payment type (selected or default)
  const getCurrentPaymentType = useCallback(() => {
    return selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)
  }, [selectedPaymentMethod, topupInfo])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  // Handle topup amount change
  const handleTopupAmountChange = (amount: number) => {
    setTopupAmount(amount)
    setSelectedPreset(null)
    calculatePaymentAmount(amount, getCurrentPaymentType())
  }

  // Handle payment method selection
  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setPaymentLoading(method.type)

    try {
      const minTopup = getMinTopupAmount(topupInfo)
      if (topupAmount < minTopup) {
        return
      }

      if (method.type === 'wepay') {
        const tradeNo = await createOrder(topupAmount)
        if (!tradeNo) return
        return
      }

      await calculatePaymentAmount(topupAmount, method.type)
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleWepaySelectSbp = async () => {
    if (!wepayState.tradeNo) return
    setPaymentLoading('wepay')
    try {
      await payWithSbp(wepayState.tradeNo, topupAmount, fetchUser)
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleWepaySelectMir = async () => {
    if (!wepayState.tradeNo) return
    setPaymentLoading('wepay')
    try {
      await payWithMir(wepayState.tradeNo, topupAmount)
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleWepayCancel = () => {
    wepayCancel()
    setSelectedPaymentMethod(undefined)
  }

  const handleSilkroadMethodSelect = async () => {
    setPaymentLoading('silkroad')
    try {
      const success = await createSilkroadOrder(topupAmount, 'sbp')
      if (success) {
        setSilkroadDialogOpen(true)
      }
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleSilkroadSelectSbp = async () => {
    setPaymentLoading('silkroad')
    try {
      await silkroadPayWithSbp(fetchUser)
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleSilkroadCancel = () => {
    silkroadCancel()
    setSilkroadDialogOpen(false)
  }

  const handleUsdtMethodSelect = () => {
    setUsdtDialogOpen(true)
  }

  const handleUsdtSelectChain = async (chain: string) => {
    setPaymentLoading('usdt')
    try {
      await createUsdtOrderAction(topupAmount, chain)
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleUsdtCancel = () => {
    usdtCancel()
    setUsdtDialogOpen(false)
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return

    const isPancake = isWaffoPancakePayment(selectedPaymentMethod.type)
    const success = isPancake
      ? await processWaffoPancakePayment(topupAmount)
      : await processPayment(topupAmount, selectedPaymentMethod.type)

    if (success) {
      setConfirmDialogOpen(false)
      await fetchUser()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await fetchUser()
    }
  }

  // Handle transfer
  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  // Handle Creem product selection
  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  // Handle Creem payment confirmation
  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return

    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
      await fetchUser()
    }
  }

  const handleWaffoMethodSelect = async (_method: unknown, index: number) => {
    const loadingKey = `waffo-${index}`
    setPaymentLoading(loadingKey)

    try {
      await processWaffoPayment(topupAmount, index)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  const handleSubscriptionAvailabilityChange = useCallback(
    (available: boolean) => {
      setShowSubscriptionPanel(available)
    },
    []
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <WalletStatsCard user={user} loading={userLoading} />

            <div
              className={
                showSubscriptionPanel
                  ? 'grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start'
                  : 'grid gap-4'
              }
            >
              <div id='wallet-add-funds' className='scroll-mt-4'>
                <RechargeFormCard
                  topupInfo={topupInfo}
                  presetAmounts={presetAmounts}
                  selectedPreset={selectedPreset}
                  onSelectPreset={handleSelectPreset}
                  topupAmount={topupAmount}
                  onTopupAmountChange={handleTopupAmountChange}
                  paymentAmount={paymentAmount}
                  calculating={calculating}
                  onPaymentMethodSelect={handlePaymentMethodSelect}
                  paymentLoading={paymentLoading}
                  redemptionCode={redemptionCode}
                  onRedemptionCodeChange={setRedemptionCode}
                  onRedeem={handleRedeem}
                  redeeming={redeeming}
                  topupLink={topupInfo?.topup_link}
                  loading={topupLoading}
                  priceRatio={(status?.price as number) || 1}
                  usdExchangeRate={effectiveUsdExchangeRate}
                  onOpenBilling={() => setBillingDialogOpen(true)}
                  creemProducts={topupInfo?.creem_products}
                  enableCreemTopup={topupInfo?.enable_creem_topup}
                  onCreemProductSelect={handleCreemProductSelect}
                  enableWaffoTopup={topupInfo?.enable_waffo_topup}
                  waffoPayMethods={topupInfo?.waffo_pay_methods}
                  waffoMinTopup={topupInfo?.waffo_min_topup}
                  onWaffoMethodSelect={handleWaffoMethodSelect}
                  enableWaffoPancakeTopup={
                    topupInfo?.enable_waffo_pancake_topup
                  }
                  enableSilkroadTopup={topupInfo?.enable_silkroad_topup}
                  onSilkroadMethodSelect={handleSilkroadMethodSelect}
                  enableUsdtTopup={topupInfo?.enable_usdt_topup}
                  onUsdtMethodSelect={handleUsdtMethodSelect}
                  usdtMinTopup={topupInfo?.usdt_min_topup || 1}
                />
              </div>

              <SubscriptionPlansCard
                topupInfo={topupInfo}
                onAvailabilityChange={handleSubscriptionAvailabilityChange}
                userQuota={user?.quota}
                onPurchaseSuccess={fetchUser}
              />
            </div>

            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              loading={affiliateLoading}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={topupAmount}
        paymentAmount={paymentAmount}
        paymentMethod={selectedPaymentMethod}
        calculating={calculating}
        processing={processing || pancakeProcessing}
        discountRate={getDiscountRate()}
        usdExchangeRate={effectiveUsdExchangeRate}
      />

      <WepayPaymentModal
        open={wepayState.view !== 'select' || (wepayState.tradeNo !== '' && wepayState.view === 'select')}
        onOpenChange={(open) => {
          if (!open) handleWepayCancel()
        }}
        view={wepayState.view}
        tradeNo={wepayState.tradeNo}
        topupAmount={topupAmount}
        codeUrl={wepayState.codeUrl}
        codeImgUrl={wepayState.codeImgUrl}
        paymentUrl={wepayState.paymentUrl}
        sbpLogo={selectedPaymentMethod?.sbp_logo || selectedPaymentMethod?.icon || ''}
        mirLogo={selectedPaymentMethod?.mir_logo || ''}
        loading={wepayLoading}
        usdExchangeRate={effectiveUsdExchangeRate}
        onSelectSbp={handleWepaySelectSbp}
        onSelectMir={handleWepaySelectMir}
        onGoBack={wepayGoBack}
        onCancel={handleWepayCancel}
      />

      <SilkroadPaymentModal
        open={silkroadDialogOpen}
        onOpenChange={setSilkroadDialogOpen}
        view={silkroadState.view}
        tradeNo={silkroadState.tradeNo}
        topupAmount={topupAmount}
        codeUrl={silkroadState.codeUrl}
        codeImgUrl={silkroadState.codeImgUrl}
        loading={silkroadLoading}
        onSelectSbp={handleSilkroadSelectSbp}
        onCancel={handleSilkroadCancel}
      />

      {topupInfo?.enable_usdt_topup && (
        <UsdtPaymentModal
          open={usdtDialogOpen}
          onOpenChange={setUsdtDialogOpen}
          blockchainTypes={topupInfo?.usdt_blockchain_types || ['tron', 'ethereum']}
          loading={usdtLoading}
          timeLeft={usdtTimeLeft}
          expired={usdtExpired}
          walletAddress={usdtState.walletAddress}
          usdtAmount={usdtState.usdtAmount}
          blockchainType={usdtState.blockchainType}
          onSelectChain={handleUsdtSelectChain}
          onCancel={handleUsdtCancel}
        />
      )}

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />
    </>
  )
}

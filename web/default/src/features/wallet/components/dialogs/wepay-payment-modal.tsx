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
import { ArrowLeftIcon, Loader2, ExternalLinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatLocalCurrencyAmount } from '@/lib/currency'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { WepayView } from '../../hooks/use-wepay-payment'

interface WepayPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: WepayView
  tradeNo: string
  topupAmount: number
  codeUrl: string
  codeImgUrl: string
  paymentUrl: string
  sbpLogo: string
  mirLogo: string
  loading: boolean
  usdExchangeRate?: number
  onSelectSbp: () => void
  onSelectMir: () => void
  onGoBack: () => void
  onCancel: () => void
}

export function WepayPaymentModal({
  open,
  onOpenChange,
  view,
  tradeNo,
  topupAmount,
  codeUrl,
  codeImgUrl,
  paymentUrl,
  sbpLogo,
  mirLogo,
  loading,
  usdExchangeRate = 1,
  onSelectSbp,
  onSelectMir,
  onGoBack,
  onCancel,
}: WepayPaymentModalProps) {
  const { t } = useTranslation()

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      onCancel()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-lg'>
        {view === 'select' && (
          <SelectView
            tradeNo={tradeNo}
            topupAmount={topupAmount}
            sbpLogo={sbpLogo}
            mirLogo={mirLogo}
            loading={loading}
            usdExchangeRate={usdExchangeRate}
            onSelectSbp={onSelectSbp}
            onSelectMir={onSelectMir}
            onCancel={onCancel}
          />
        )}
        {view === 'sbp_qr' && (
          <SbpQrView
            tradeNo={tradeNo}
            topupAmount={topupAmount}
            codeUrl={codeUrl}
            codeImgUrl={codeImgUrl}
            sbpLogo={sbpLogo}
            loading={loading}
            usdExchangeRate={usdExchangeRate}
            onGoBack={onGoBack}
            onCancel={onCancel}
          />
        )}
        {view === 'mir_confirm' && (
          <MirConfirmView
            tradeNo={tradeNo}
            topupAmount={topupAmount}
            paymentUrl={paymentUrl}
            mirLogo={mirLogo}
            loading={loading}
            usdExchangeRate={usdExchangeRate}
            onGoBack={onGoBack}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface SelectViewProps {
  tradeNo: string
  topupAmount: number
  sbpLogo: string
  mirLogo: string
  loading: boolean
  usdExchangeRate: number
  onSelectSbp: () => void
  onSelectMir: () => void
  onCancel: () => void
}

function SelectView({
  tradeNo,
  topupAmount,
  sbpLogo,
  mirLogo,
  loading,
  usdExchangeRate,
  onSelectSbp,
  onSelectMir,
  onCancel,
}: SelectViewProps) {
  const { t } = useTranslation()

  return (
    <>
      <DialogHeader>
        <DialogTitle className='text-xl font-semibold'>
          {t('Wepay Payment')}
        </DialogTitle>
        <DialogDescription>
          {t('Choose Payment Method')}
        </DialogDescription>
      </DialogHeader>

      <div className='space-y-5 py-4'>
        <div className='bg-muted/50 rounded-xl border p-4 space-y-3'>
          <div className='text-sm font-medium text-muted-foreground'>
            {t('Order Summary')}
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-sm text-muted-foreground'>
              {t('Order Number')}
            </span>
            <span className='font-mono text-sm font-medium'>{tradeNo}</span>
          </div>
          <div className='flex items-center justify-between border-t pt-3'>
            <span className='text-sm text-muted-foreground'>
              {t('Amount')}
            </span>
            <span className='text-lg font-bold'>
              {formatLocalCurrencyAmount(topupAmount * usdExchangeRate, {
                digitsLarge: 2,
                digitsSmall: 2,
                abbreviate: false,
              })}
            </span>
          </div>
        </div>

        <div className='space-y-3'>
          <div className='text-sm font-medium text-muted-foreground'>
            {t('Choose Payment Method')}
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <button
              type='button'
              disabled={loading}
              onClick={onSelectSbp}
              className='flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-primary hover:bg-accent hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {sbpLogo ? (
                <img
                  src={sbpLogo}
                  alt='SBP'
                  className='h-16 w-auto object-contain'
                />
              ) : (
                <div className='flex h-16 w-16 items-center justify-center rounded-full bg-[#4F7DCA]/10'>
                  <span className='text-xl font-bold text-[#4F7DCA]'>SBP</span>
                </div>
              )}
            </button>
            <button
              type='button'
              disabled={loading}
              onClick={onSelectMir}
              className='flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-primary hover:bg-accent hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {mirLogo ? (
                <img
                  src={mirLogo}
                  alt='MIR'
                  className='h-16 w-auto object-contain'
                />
              ) : (
                <div className='flex h-16 w-16 items-center justify-center rounded-full bg-[#FF6B35]/10'>
                  <span className='text-xl font-bold text-[#FF6B35]'>MIR</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className='flex justify-end'>
        <Button variant='outline' onClick={onCancel} disabled={loading}>
          {t('Cancel Payment')}
        </Button>
      </div>
    </>
  )
}

interface SbpQrViewProps {
  tradeNo: string
  topupAmount: number
  codeUrl: string
  codeImgUrl: string
  sbpLogo: string
  loading: boolean
  usdExchangeRate: number
  onGoBack: () => void
  onCancel: () => void
}

function SbpQrView({
  tradeNo,
  topupAmount,
  codeUrl,
  codeImgUrl,
  sbpLogo,
  loading,
  usdExchangeRate,
  onGoBack,
  onCancel,
}: SbpQrViewProps) {
  const { t } = useTranslation()
  const qrImageUrl = codeImgUrl || codeUrl

  return (
    <>
      <DialogHeader>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onGoBack}
            disabled={loading}
            className='h-8 w-8'
          >
            <ArrowLeftIcon className='h-4 w-4' />
          </Button>
          <DialogTitle className='text-xl font-semibold'>
            {t('Wepay Payment')}
          </DialogTitle>
        </div>
        <DialogDescription>
          {t('Scan with your banking app to pay')}
        </DialogDescription>
      </DialogHeader>

      <div className='space-y-5 py-4'>
        <div className='bg-muted/50 rounded-xl border p-4 space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-sm text-muted-foreground'>
              {t('Order Number')}
            </span>
            <span className='font-mono text-sm font-medium'>{tradeNo}</span>
          </div>
          <div className='flex items-center justify-between border-t pt-2'>
            <span className='text-sm text-muted-foreground'>
              {t('Amount')}
            </span>
            <span className='text-base font-bold'>
              {formatLocalCurrencyAmount(topupAmount * usdExchangeRate, {
                digitsLarge: 2,
                digitsSmall: 2,
                abbreviate: false,
              })}
            </span>
          </div>
        </div>

        <div className='flex justify-center'>
          {sbpLogo ? (
            <img
              src={sbpLogo}
              alt='SBP'
              className='h-10 object-contain'
            />
          ) : (
            <span className='text-xl font-bold text-[#4F7DCA]'>SBP</span>
          )}
        </div>

        <div className='flex justify-center'>
          {loading ? (
            <Skeleton className='h-[220px] w-[220px] rounded-xl' />
          ) : qrImageUrl ? (
            <div className='relative'>
              <img
                src={qrImageUrl}
                alt='QR Code'
                className='h-[220px] w-[220px] rounded-xl border-2 border-border'
              />
            </div>
          ) : (
            <div className='bg-muted flex h-[220px] w-[220px] items-center justify-center rounded-xl border-2 border-dashed'>
              <span className='text-muted-foreground text-sm'>
                {t('QR code failed to load')}
              </span>
            </div>
          )}
        </div>

        <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' />
          <span>{t('Waiting for payment...')}</span>
        </div>
      </div>

      <div className='flex justify-end'>
        <Button variant='outline' onClick={onCancel} disabled={loading}>
          {t('Cancel Payment')}
        </Button>
      </div>
    </>
  )
}

interface MirConfirmViewProps {
  tradeNo: string
  topupAmount: number
  paymentUrl: string
  mirLogo: string
  loading: boolean
  usdExchangeRate: number
  onGoBack: () => void
  onCancel: () => void
}

function MirConfirmView({
  tradeNo,
  topupAmount,
  paymentUrl,
  mirLogo,
  loading,
  usdExchangeRate,
  onGoBack,
  onCancel,
}: MirConfirmViewProps) {
  const { t } = useTranslation()

  const handleProceed = () => {
    if (paymentUrl) {
      window.open(paymentUrl, '_blank')
    }
  }

  return (
    <>
      <DialogHeader>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onGoBack}
            disabled={loading}
            className='h-8 w-8'
          >
            <ArrowLeftIcon className='h-4 w-4' />
          </Button>
          <DialogTitle className='text-xl font-semibold'>
            {t('Wepay Payment')}
          </DialogTitle>
        </div>
        <DialogDescription>
          {t('You will be redirected to MIR payment page')}
        </DialogDescription>
      </DialogHeader>

      <div className='space-y-5 py-4'>
        <div className='bg-muted/50 rounded-xl border p-4 space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-sm text-muted-foreground'>
              {t('Order Number')}
            </span>
            <span className='font-mono text-sm font-medium'>{tradeNo}</span>
          </div>
          <div className='flex items-center justify-between border-t pt-2'>
            <span className='text-sm text-muted-foreground'>
              {t('Amount')}
            </span>
            <span className='text-base font-bold'>
              {formatLocalCurrencyAmount(topupAmount * usdExchangeRate, {
                digitsLarge: 2,
                digitsSmall: 2,
                abbreviate: false,
              })}
            </span>
          </div>
        </div>

        <div className='flex justify-center py-4'>
          {mirLogo ? (
            <img
              src={mirLogo}
              alt='MIR'
              className='h-20 object-contain'
            />
          ) : (
            <span className='text-3xl font-bold text-[#FF6B35]'>MIR</span>
          )}
        </div>

        <Button
          className='w-full'
          size='lg'
          onClick={handleProceed}
          disabled={loading || !paymentUrl}
        >
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          <ExternalLinkIcon className='mr-2 h-4 w-4' />
          {t('Proceed to Pay')}
        </Button>
      </div>

      <div className='flex justify-end'>
        <Button variant='outline' onClick={onCancel} disabled={loading}>
          {t('Cancel Payment')}
        </Button>
      </div>
    </>
  )
}
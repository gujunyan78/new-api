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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { SilkroadView } from '../../hooks/use-silkroad-payment'

interface SilkroadPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: SilkroadView
  tradeNo: string
  topupAmount: number
  codeUrl: string
  codeImgUrl: string
  loading: boolean
  onSelectSbp: () => void
  onCancel: () => void
}

export function SilkroadPaymentModal({
  open,
  onOpenChange,
  view,
  tradeNo,
  topupAmount,
  codeUrl,
  codeImgUrl,
  loading,
  onSelectSbp,
  onCancel,
}: SilkroadPaymentModalProps) {
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
            loading={loading}
            onSelectSbp={onSelectSbp}
            onCancel={onCancel}
          />
        )}
        {view === 'sbp_qr' && (
          <SbpQrView
            tradeNo={tradeNo}
            topupAmount={topupAmount}
            codeUrl={codeUrl}
            codeImgUrl={codeImgUrl}
            loading={loading}
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
  loading: boolean
  onSelectSbp: () => void
  onCancel: () => void
}

function SelectView({
  tradeNo,
  topupAmount,
  loading,
  onSelectSbp,
  onCancel,
}: SelectViewProps) {
  const { t } = useTranslation()

  return (
    <>
      <DialogHeader>
        <DialogTitle className='text-xl font-semibold'>
          {t('Gwiff Pay')}
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
              {topupAmount.toFixed(2)} RUB
            </span>
          </div>
        </div>

        <div className='space-y-3'>
          <div className='text-sm font-medium text-muted-foreground'>
            {t('Choose Payment Method')}
          </div>
          <div className='grid gap-4'>
            <button
              type='button'
              disabled={loading}
              onClick={onSelectSbp}
              className='flex items-center justify-center rounded-xl border-2 border-border bg-card p-8 transition-all hover:border-primary hover:bg-accent hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
            >
              <img
                src='/custom/sbp.png'
                alt='SBP'
                className='h-16 w-auto object-contain'
              />
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
  loading: boolean
  onCancel: () => void
}

function SbpQrView({
  tradeNo,
  topupAmount,
  codeUrl,
  codeImgUrl,
  loading,
  onCancel,
}: SbpQrViewProps) {
  const { t } = useTranslation()
  const qrImageUrl = codeImgUrl || codeUrl

  return (
    <>
      <DialogHeader>
        <DialogTitle className='text-xl font-semibold'>
          {t('Gwiff Pay')}
        </DialogTitle>
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
              {topupAmount.toFixed(2)} RUB
            </span>
          </div>
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

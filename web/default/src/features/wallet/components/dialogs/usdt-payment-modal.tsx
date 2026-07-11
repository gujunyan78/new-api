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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface UsdtPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blockchainTypes: string[]
  loading: boolean
  timeLeft: number
  expired: boolean
  walletAddress: string
  usdtAmount: string
  blockchainType: string
  onSelectChain: (chain: string) => void
  onCancel: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const TronIcon = () => (
  <svg width='20' height='20' viewBox='0 0 24 24' fill='none'>
    <path d='M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z' fill='#FF060A' />
    <path d='M12 6L16 10L12 14L8 10L12 6Z' fill='white' />
    <path d='M12 10L14 12L12 14L10 12L12 10Z' fill='#FF060A' />
  </svg>
)

const EthereumIcon = () => (
  <svg width='20' height='20' viewBox='0 0 24 24' fill='none'>
    <path d='M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z' fill='#627EEA' />
    <path d='M12.373 3V9.652L17.996 12.165L12.373 3Z' fill='white' fillOpacity='0.602' />
    <path d='M12.373 3L6.75 12.165L12.373 9.652V3Z' fill='white' />
    <path d='M12.373 16.476V20.996L18 13.212L12.373 16.476Z' fill='white' fillOpacity='0.602' />
    <path d='M12.373 20.996V16.475L6.75 13.212L12.373 20.996Z' fill='white' />
    <path d='M12.373 15.429L17.996 12.165L12.373 9.654V15.429Z' fill='white' fillOpacity='0.2' />
    <path d='M6.75 12.165L12.373 15.429V9.654L6.75 12.165Z' fill='white' fillOpacity='0.602' />
  </svg>
)

function chainLabel(type: string): { name: string; icon: React.ReactNode } {
  const labels: Record<string, { name: string; icon: React.ReactNode }> = {
    tron: { name: 'Tron (TRC-20)', icon: <TronIcon /> },
    ethereum: { name: 'Ethereum (ERC-20)', icon: <EthereumIcon /> },
  }
  return labels[type?.toLowerCase()] || { name: type, icon: <div className='h-5 w-5 rounded-full bg-muted' /> }
}

export function UsdtPaymentModal({
  open,
  onOpenChange,
  blockchainTypes,
  loading,
  timeLeft,
  expired,
  walletAddress,
  usdtAmount,
  blockchainType,
  onSelectChain,
  onCancel,
}: UsdtPaymentModalProps) {
  const { t } = useTranslation()
  const isUrgent = timeLeft > 0 && timeLeft < 300
  const hasOrder = !!walletAddress

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('Copied successfully'))
    } catch {
      toast.warning(t('Please copy the address manually'))
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      onCancel()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        {!hasOrder ? (
          <>
            <DialogHeader>
              <DialogTitle className='text-xl font-semibold'>
                USDT {t('Top Up')}
              </DialogTitle>
              <DialogDescription>
                {t('Select blockchain network')}
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-3 py-4'>
              {blockchainTypes.map((chain) => {
                const info = chainLabel(chain)
                return (
                  <Button
                    key={chain}
                    variant='outline'
                    className='w-full justify-start gap-3 h-14 rounded-xl'
                    onClick={() => onSelectChain(chain)}
                    disabled={loading}
                  >
                    {info.icon}
                    <span className='font-medium'>{info.name}</span>
                  </Button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className='text-xl font-semibold'>
                USDT {t('Top Up')}
              </DialogTitle>
              <DialogDescription>
                {t('Transfer the exact amount to the address below')}
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4 py-4'>
              {/* Countdown */}
              <div className='text-center'>
                {expired ? (
                  <Alert variant='destructive'>
                    <AlertDescription>
                      {t('Order has expired. Please create a new order.')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className='flex items-center justify-center gap-2'>
                    <Clock className='h-4 w-4' />
                    <span
                      className={`text-lg font-bold ${isUrgent ? 'text-destructive animate-pulse' : ''}`}
                    >
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className='text-center'>
                <p className='text-muted-foreground text-sm'>
                  {t('Please transfer the exact amount')}
                </p>
                <p className='text-destructive text-2xl font-bold my-1'>
                  {usdtAmount} USDT
                </p>
                <p className='text-muted-foreground text-xs'>
                  {chainLabel(blockchainType).icon}
                  <span className='ml-1'>{chainLabel(blockchainType).name}</span>
                </p>
              </div>

              {/* QR Code */}
              <div className='flex justify-center'>
                <div
                  className='p-4 bg-white rounded-xl'
                  style={{ opacity: expired ? 0.3 : 1 }}
                >
                  <QRCodeSVG
                    value={walletAddress}
                    size={200}
                    level='M'
                  />
                </div>
              </div>

              {/* Wallet Address */}
              <div className='text-center space-y-2'>
                <p className='font-mono text-sm break-all leading-relaxed'>
                  {walletAddress}
                </p>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={expired}
                  onClick={() => handleCopy(walletAddress)}
                >
                  <Copy className='mr-1 h-3 w-3' />
                  {t('Copy address')}
                </Button>
              </div>

              {/* Loading indicator */}
              {loading && (
                <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <span>{t('Creating order...')}</span>
                </div>
              )}

              {/* Warnings */}
              {!loading && (
                <Alert variant='default' className='border-amber-200 bg-amber-50'>
                  <AlertDescription>
                    <div className='space-y-1.5 text-xs'>
                      <div className='flex items-start gap-1.5'>
                        <AlertTriangle className='h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600' />
                        <span>
                          {t('Please transfer the exact amount, otherwise the system cannot confirm automatically')}
                        </span>
                      </div>
                      <div className='flex items-start gap-1.5'>
                        <AlertTriangle className='h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600' />
                        <span>
                          {t('Do not send funds to addresses not shown on this page')}
                        </span>
                      </div>
                      <div className='flex items-start gap-1.5'>
                        <CheckCircle className='h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-600' />
                        <span>
                          {t('Please wait patiently for system confirmation after transfer')}
                        </span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className='flex justify-end'>
              <Button variant='outline' onClick={onCancel} disabled={loading}>
                {t('Cancel Payment')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

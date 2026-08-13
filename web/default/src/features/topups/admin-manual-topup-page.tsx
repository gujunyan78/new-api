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
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionPageLayout } from '@/components/layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { getAllBillingHistory, completeOrder, isApiSuccess } from '@/features/wallet/api'
import type { TopupRecord } from '@/features/wallet/types'
import { AdminManualTopUpModal } from './admin-manual-topup-modal'

const PAGE_SIZE = 20

export function AdminManualTopUpPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [showTopupModal, setShowTopupModal] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-topups', page, keyword],
    queryFn: async () => {
      const response = await getAllBillingHistory(page, PAGE_SIZE, keyword || undefined)
      if (isApiSuccess(response) && response.data) {
        return response.data
      }
      return { items: [], total: 0 }
    },
  })

  const completeMutation = useMutation({
    mutationFn: (tradeNo: string) => completeOrder({ trade_no: tradeNo }),
    onSuccess: (response) => {
      if (isApiSuccess(response)) {
        toast.success(t('Order completed successfully'))
        queryClient.invalidateQueries({ queryKey: ['admin-topups'] })
      } else {
        toast.error(response.message || t('Failed to complete order'))
      }
    },
    onError: () => toast.error(t('Failed to complete order')),
  })

  // Reset page when keyword changes
  useEffect(() => {
    setPage(1)
  }, [keyword])

  const handleSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      refetch()
    }
  }, [refetch])

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant='default' className='bg-green-500'>{t('Success')}</Badge>
      case 'pending':
        return <Badge variant='secondary'>{t('Pending')}</Badge>
      case 'expired':
        return <Badge variant='destructive'>{t('Expired')}</Badge>
      default:
        return <Badge variant='outline'>{status}</Badge>
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Top-up Management')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
          <div className='flex items-center gap-3'>
            <Input
              placeholder={t('Search by trade number or user ID')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleSearch}
              className='max-w-sm'
            />
            <Button variant='outline' onClick={() => refetch()}>
              {t('Search')}
            </Button>
            <button
              type='button'
              onClick={() => {
                document.title = 'CLICKED at ' + Date.now();
                setShowTopupModal(true);
              }}
              style={{ border: '1px solid #ccc', borderRadius: 4, padding: '8px 12px', cursor: 'pointer' }}
            >
              {t('新建手工充值')}
            </button>
            <span style={{fontSize:20,fontWeight:'bold',color:(showTopupModal?'green':'red')}}>
              OPEN={String(showTopupModal)}
            </span>
          </div>

          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ID')}</TableHead>
                  <TableHead>{t('User ID')}</TableHead>
                  <TableHead>{t('Trade No.')}</TableHead>
                  <TableHead>{t('Amount')}</TableHead>
                  <TableHead>{t('Payment')}</TableHead>
                  <TableHead>{t('Payment Method')}</TableHead>
                  <TableHead>{t('Created')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead className='text-right'>{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className='text-center py-8'>
                      <Loader2 className='h-6 w-6 animate-spin mx-auto' />
                    </TableCell>
                  </TableRow>
                ) : data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className='text-muted-foreground text-center py-8'>
                      {t('No records found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map((record: TopupRecord) => (
                    <TableRow key={record.id}>
                      <TableCell className='font-mono text-xs'>{record.id}</TableCell>
                      <TableCell>{record.user_id}</TableCell>
                      <TableCell className='font-mono text-xs'>{record.trade_no}</TableCell>
                      <TableCell>{record.amount.toLocaleString()}</TableCell>
                      <TableCell>{record.money || '-'}</TableCell>
                      <TableCell>{record.payment_method}</TableCell>
                      <TableCell className='text-xs'>
                        {record.create_time
                          ? new Date(record.create_time * 1000).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell>{statusBadge(record.status)}</TableCell>
                      <TableCell className='text-right'>
                        {record.status === 'pending' && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => completeMutation.mutate(record.trade_no)}
                            disabled={completeMutation.isPending}
                          >
                            <CheckCircle className='mr-1 h-3 w-3' />
                            {t('Complete')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
                  .map((p, idx, arr) => (
                    <PaginationItem key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 ? (
                        <span className='px-2'>...</span>
                      ) : null}
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </SectionPageLayout.Content>
      <AdminManualTopUpModal
        open={showTopupModal}
        onOpenChange={setShowTopupModal}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-topups'] })
          refetch()
        }}
      />
    </SectionPageLayout>
  )
}

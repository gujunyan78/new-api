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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface DomainBranding {
  id: number
  domain: string
  system_name: string
  logo: string
  docs_link: string
  home_page_content: string
  about: string
  footer: string
  header_analytics: string
  body_analytics: string
  default_user_group: string
  usable_groups: string
  created_at?: string
  updated_at?: string
}

type DomainBrandingForm = Omit<
  DomainBranding,
  'id' | 'created_at' | 'updated_at'
>

const emptyForm: DomainBrandingForm = {
  domain: '',
  system_name: '',
  logo: '',
  docs_link: '',
  home_page_content: '',
  about: '',
  footer: '',
  header_analytics: '',
  body_analytics: '',
  default_user_group: '',
  usable_groups: '',
}

const monoStyle = { fontFamily: 'JetBrains Mono, Consolas' } as const

export function DomainBrandingSettingsSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<DomainBrandingForm>(emptyForm)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['domain-brandings'],
    queryFn: async () => {
      const res = await api.get('/api/domain-branding/')
      return (res.data?.data ?? []) as DomainBranding[]
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['domain-brandings'] })

  const saveMutation = useMutation({
    mutationFn: async (values: DomainBrandingForm) => {
      const res = editingId
        ? await api.put(`/api/domain-branding/${editingId}`, values)
        : await api.post('/api/domain-branding/', values)
      return res.data
    },
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(
          editingId
            ? t('Domain branding updated')
            : t('Domain branding created')
        )
        setModalOpen(false)
        invalidate()
      } else if (res?.message) {
        toast.error(res.message)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/api/domain-branding/${id}`)
      return res.data
    },
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('Domain branding deleted'))
        invalidate()
      } else if (res?.message) {
        toast.error(res.message)
      }
      setDeletingId(null)
    },
    onError: () => setDeletingId(null),
  })

  // Reset the form whenever the dialog opens for create/edit.
  useEffect(() => {
    if (!modalOpen) return
    if (editingId != null) {
      const record = data?.find((item) => item.id === editingId)
      if (record) {
        setForm({
          domain: record.domain ?? '',
          system_name: record.system_name ?? '',
          logo: record.logo ?? '',
          docs_link: record.docs_link ?? '',
          home_page_content: record.home_page_content ?? '',
          about: record.about ?? '',
          footer: record.footer ?? '',
          header_analytics: record.header_analytics ?? '',
          body_analytics: record.body_analytics ?? '',
          default_user_group: record.default_user_group ?? '',
          usable_groups: record.usable_groups ?? '',
        })
      }
    } else {
      setForm(emptyForm)
    }
  }, [modalOpen, editingId, data])

  const openCreate = () => {
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (record: DomainBranding) => {
    setEditingId(record.id)
    setModalOpen(true)
  }

  const setField = (key: keyof DomainBrandingForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    if (!form.domain.trim()) {
      toast.error(t('Please enter a domain'))
      return
    }
    saveMutation.mutate(form)
  }

  const records = data ?? []
  const fallback = (
    <span className='text-muted-foreground'>{t('Use global default')}</span>
  )

  return (
    <section className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <p className='text-muted-foreground max-w-3xl text-sm'>
          {t(
            'Configure independent branding for different domains. Empty fields fall back to the global default settings.'
          )}
        </p>
        <Button onClick={openCreate}>
          <Plus className='mr-1 h-4 w-4' />
          {t('Add domain branding')}
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Domain')}</TableHead>
              <TableHead>{t('System Name')}</TableHead>
              <TableHead>{t('Logo Image URL')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className='py-8 text-center'>
                  <Loader2 className='mx-auto h-6 w-6 animate-spin' />
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground py-8 text-center'
                >
                  {t('No domain branding configured')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className='font-medium'>{record.domain}</TableCell>
                  <TableCell>{record.system_name || fallback}</TableCell>
                  <TableCell className='max-w-xs truncate'>
                    {record.logo || fallback}
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => openEdit(record)}
                      >
                        <Pencil className='mr-1 h-3 w-3' />
                        {t('Edit')}
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-destructive hover:text-destructive'
                        onClick={() => setDeletingId(record.id)}
                      >
                        <Trash2 className='mr-1 h-3 w-3' />
                        {t('Delete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={
          editingId
            ? t('Edit domain branding')
            : t('Add domain branding')
        }
        bodyClassName='space-y-4'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => setModalOpen(false)}
              disabled={saveMutation.isPending}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              {t('Confirm')}
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>{t('Domain')}</Label>
            <Input
              placeholder={t('e.g. api.example.com')}
              value={form.domain}
              onChange={(e) => setField('domain', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('System Name')}</Label>
            <Input
              placeholder={t('Leave blank to use the global default')}
              value={form.system_name}
              onChange={(e) => setField('system_name', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Logo Image URL')}</Label>
            <Input
              placeholder={t('Leave blank to use the global default')}
              value={form.logo}
              onChange={(e) => setField('logo', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Docs Link')}</Label>
            <Input
              placeholder={t(
                'Leave blank to use the global default, e.g. https://docs.example.com'
              )}
              value={form.docs_link}
              onChange={(e) => setField('docs_link', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Home Page Content')}</Label>
            <Textarea
              rows={3}
              style={monoStyle}
              placeholder={t('Leave blank to use the global default')}
              value={form.home_page_content}
              onChange={(e) => setField('home_page_content', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('About')}</Label>
            <Textarea
              rows={3}
              style={monoStyle}
              placeholder={t('Leave blank to use the global default')}
              value={form.about}
              onChange={(e) => setField('about', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Footer')}</Label>
            <Textarea
              rows={3}
              style={monoStyle}
              placeholder={t('Leave blank to use the global default')}
              value={form.footer}
              onChange={(e) => setField('footer', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Default User Group for New Users')}</Label>
            <Input
              placeholder={t(
                'The default user group for new users registered on this domain. Leave blank to use default'
              )}
              value={form.default_user_group}
              onChange={(e) => setField('default_user_group', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Usable Resource Groups (comma-separated)')}</Label>
            <Input
              placeholder={t(
                'Whitelist of resource groups selectable in the model market and for tokens on this domain, e.g. default,vip. Leave blank for no restriction'
              )}
              value={form.usable_groups}
              onChange={(e) => setField('usable_groups', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Page Analytics Code (HEAD)')}</Label>
            <Textarea
              rows={3}
              style={monoStyle}
              placeholder={t(
                'Analytics code inserted into the home page <head>, e.g. Google Analytics / Umami. Leave blank to skip'
              )}
              value={form.header_analytics}
              onChange={(e) => setField('header_analytics', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('Page Analytics Code (BODY)')}</Label>
            <Textarea
              rows={3}
              style={monoStyle}
              placeholder={t(
                'Analytics code inserted before the home page </body>, e.g. noscript pixel. Leave blank to skip'
              )}
              value={form.body_analytics}
              onChange={(e) => setField('body_analytics', e.target.value)}
            />
          </div>
        </div>
      </Dialog>

      <AlertDialog
        open={deletingId != null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Delete this domain branding?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId != null) deleteMutation.mutate(deletingId)
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {t('Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

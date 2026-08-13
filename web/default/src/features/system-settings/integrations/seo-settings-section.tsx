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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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

import { useUpdateOption } from '../hooks/use-update-option'
import { getOptionValue, useSystemOptions } from '../hooks/use-system-options'

interface PageSEO {
  page: string
  title: string
  description: string
  keywords: string
}

const emptyForm: PageSEO = { page: '', title: '', description: '', keywords: '' }

function parseSettings(raw: string | undefined): PageSEO[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.pages)) return parsed.pages
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

export function SEOSettingsSection() {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const { data: options, isLoading } = useSystemOptions()

  const rawValue = useMemo(() => {
    const settings = getOptionValue(options?.data ?? [], {
      SEOSettings: '' as string | unknown[],
    })
    const v = settings.SEOSettings
    return typeof v === 'string' ? v : Array.isArray(v) ? JSON.stringify(v) : ''
  }, [options])

  const defaultPages = useMemo(() => parseSettings(rawValue), [rawValue])

  const [pages, setPages] = useState<PageSEO[]>([])
  const [dirty, setDirty] = useState(false)

  // Sync local state when system options load
  useEffect(() => {
    if (!dirty) {
      setPages(defaultPages)
    }
  }, [defaultPages, dirty])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [form, setForm] = useState<PageSEO>(emptyForm)
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (!modalOpen) return
    if (editingIdx != null && editingIdx < pages.length) {
      setForm({ ...pages[editingIdx] })
    } else {
      setForm(emptyForm)
    }
  }, [modalOpen, editingIdx, pages])

  const openCreate = () => {
    setEditingIdx(null)
    setModalOpen(true)
  }

  const openEdit = (idx: number) => {
    setEditingIdx(idx)
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!form.page.trim()) {
      toast.error(t('Please enter the page path'))
      return
    }
    const updated = [...pages]
    if (editingIdx != null && editingIdx < updated.length) {
      updated[editingIdx] = { ...form }
    } else {
      updated.push({ ...form })
    }
    setPages(updated)
    setDirty(true)
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (deletingIdx != null && deletingIdx < pages.length) {
      const updated = pages.filter((_, i) => i !== deletingIdx)
      setPages(updated)
      setDirty(true)
    }
    setDeletingIdx(null)
  }

  const handleSaveAll = async () => {
    const payload = JSON.stringify({ pages })
    updateOption.mutate(
      { key: 'SEOSettings', value: payload },
      {
        onSuccess: () => {
          setDirty(false)
          toast.success(t('SEO settings saved'))
        },
      }
    )
  }

  const setField = (key: keyof PageSEO, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='text-muted-foreground text-sm'>
            {t('Configure SEO meta tags (title, description, keywords) for each public page.')}
          </p>
          {dirty && (
            <p className='text-amber-500 mt-1 text-xs font-medium'>
              {t('Unsaved changes')}
            </p>
          )}
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={openCreate}>
            <Plus className='mr-1 h-4 w-4' />
            {t('Add page')}
          </Button>
          <Button onClick={handleSaveAll} disabled={updateOption.isPending || !dirty}>
            {updateOption.isPending && (
              <Loader2 className='mr-1 h-4 w-4 animate-spin' />
            )}
            {t('Save all')}
          </Button>
        </div>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-44'>{t('Page path')}</TableHead>
              <TableHead>{t('Title')}</TableHead>
              <TableHead className='hidden md:table-cell'>{t('Description')}</TableHead>
              <TableHead className='w-28 text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className='py-8 text-center'>
                  <Loader2 className='mx-auto h-6 w-6 animate-spin' />
                </TableCell>
              </TableRow>
            ) : pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className='text-muted-foreground py-8 text-center'>
                  {t('No SEO configuration yet. Add a page to get started.')}
                </TableCell>
              </TableRow>
            ) : (
              pages.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className='font-mono text-xs font-medium'>
                    {item.page}
                  </TableCell>
                  <TableCell className='max-w-xs truncate'>{item.title}</TableCell>
                  <TableCell className='text-muted-foreground hidden max-w-xs truncate md:table-cell'>
                    {item.description || '-'}
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-1'>
                      <Button variant='ghost' size='sm' onClick={() => openEdit(idx)}>
                        <Pencil className='h-3.5 w-3.5' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-destructive hover:text-destructive'
                        onClick={() => setDeletingIdx(idx)}
                      >
                        <Trash2 className='h-3.5 w-3.5' />
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
        title={editingIdx != null ? t('Edit SEO') : t('Add SEO')}
        bodyClassName='space-y-4'
        footer={
          <>
            <Button variant='outline' onClick={() => setModalOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSubmit}>{t('Confirm')}</Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>{t('Page path')}</Label>
            <Input
              placeholder={t('e.g. /about, /pricing, /sign-up')}
              value={form.page}
              onChange={(e) => setField('page', e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Title')}</Label>
            <Input
              placeholder={t('Page <title> tag content')}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Description')}</Label>
            <Textarea
              rows={2}
              placeholder={t('Meta description')}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Keywords')}</Label>
            <Textarea
              rows={2}
              placeholder={t('Meta keywords, comma-separated')}
              value={form.keywords}
              onChange={(e) => setField('keywords', e.target.value)}
            />
          </div>
        </div>
      </Dialog>

      <AlertDialog
        open={deletingIdx != null}
        onOpenChange={(open) => {
          if (!open) setDeletingIdx(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Delete this page SEO configuration?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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

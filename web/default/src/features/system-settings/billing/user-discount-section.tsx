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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import type { ComboboxInputOption } from '@/components/ui/combobox-input'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { getUsers, getGroups } from '@/features/users/api'
import { api } from '@/lib/api'

export type UserDiscountItem = {
  id: number
  user_id: number
  group: string
  model_id: string
  discount: number
  enabled: boolean
  created_at: number
  updated_at: number
}

type UserDiscountListResponse = {
  success: boolean
  message: string
  data: UserDiscountItem[]
}

type UserDiscountMutateResponse = {
  success: boolean
  message: string
  data?: UserDiscountItem
}

async function fetchUserDiscounts() {
  const res = await api.get<UserDiscountListResponse>('/api/user_discount/')
  return res.data
}

async function createUserDiscount(item: {
  user_id: number
  group: string
  model_id: string
  discount: number
}) {
  const res = await api.post<UserDiscountMutateResponse>(
    '/api/user_discount/',
    item
  )
  return res.data
}

async function updateUserDiscount(
  id: number,
  item: {
    user_id: number
    group: string
    model_id: string
    discount: number
    enabled: boolean
  }
) {
  const res = await api.put<UserDiscountMutateResponse>(
    `/api/user_discount/${id}`,
    item
  )
  return res.data
}

async function deleteUserDiscount(id: number) {
  const res = await api.delete<UserDiscountMutateResponse>(
    `/api/user_discount/${id}`
  )
  return res.data
}

type FormData = {
  user_id: string
  group: string
  model_id: string
  discount: string
  enabled: boolean
}

const emptyForm: FormData = {
  user_id: '',
  group: '',
  model_id: '',
  discount: '1',
  enabled: true,
}

export function UserDiscountSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers({ p: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => getGroups(),
    staleTime: 60_000,
  })

  const userOptions: ComboboxInputOption[] = useMemo(() => {
    const items = usersData?.data?.items ?? []
    return items.map((u) => ({
      value: String(u.id),
      label: `#${u.id} ${u.username}`,
    }))
  }, [usersData])

  const groupOptions: ComboboxInputOption[] = useMemo(() => {
    const groups = groupsData?.data ?? []
    return groups.map((g) => ({ value: g, label: g }))
  }, [groupsData])

  const userNameMap = useMemo(() => {
    const items = usersData?.data?.items ?? []
    const map = new Map<number, string>()
    for (const u of items) {
      map.set(u.id, u.username)
    }
    return map
  }, [usersData])

  const { data, isLoading } = useQuery({
    queryKey: ['user-discounts'],
    queryFn: fetchUserDiscounts,
  })

  const discounts = data?.data ?? []

  const createMutation = useMutation({
    mutationFn: createUserDiscount,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Discount rule created'))
        queryClient.invalidateQueries({ queryKey: ['user-discounts'] })
        setDialogOpen(false)
        resetForm()
      } else {
        toast.error(res.message)
      }
    },
    onError: () => toast.error(t('Failed to create discount rule')),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...item
    }: {
      id: number
      user_id: number
      group: string
      model_id: string
      discount: number
      enabled: boolean
    }) => updateUserDiscount(id, item),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Discount rule updated'))
        queryClient.invalidateQueries({ queryKey: ['user-discounts'] })
        setDialogOpen(false)
        resetForm()
      } else {
        toast.error(res.message)
      }
    },
    onError: () => toast.error(t('Failed to update discount rule')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUserDiscount,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Discount rule deleted'))
        queryClient.invalidateQueries({ queryKey: ['user-discounts'] })
      } else {
        toast.error(res.message)
      }
      setDeleteId(null)
    },
    onError: () => toast.error(t('Failed to delete discount rule')),
  })

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function openAdd() {
    resetForm()
    setDialogOpen(true)
  }

  function openEdit(item: UserDiscountItem) {
    setEditingId(item.id)
    setForm({
      user_id: item.user_id !== 0 ? String(item.user_id) : '',
      group: item.group,
      model_id: item.model_id,
      discount: String(item.discount),
      enabled: item.enabled,
    })
    setDialogOpen(true)
  }

  function handleSave() {
    const discountVal = parseFloat(form.discount)
    if (Number.isNaN(discountVal) || discountVal < 0 || discountVal > 1) {
      toast.error(t('Discount must be between 0 and 1'))
      return
    }
    const payload = {
      user_id: form.user_id ? parseInt(form.user_id, 10) : 0,
      group: form.group,
      model_id: form.model_id,
      discount: discountVal,
    }
    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        ...payload,
        enabled: form.enabled,
      })
    } else {
      createMutation.mutate(payload)
    }
  }

  function formatDiscount(val: number) {
    return `${Math.round(val * 100)}%`
  }

  function formatTarget(item: UserDiscountItem) {
    const parts: string[] = []
    if (item.user_id !== 0) {
      const name = userNameMap.get(item.user_id)
      parts.push(
        name ? `${t('User')} #${item.user_id} (${name})` : `${t('User')} #${item.user_id}`
      )
    }
    if (item.group) parts.push(`${t('Group')}: ${item.group}`)
    if (item.model_id) parts.push(`${t('Model')}: ${item.model_id}`)
    return parts.length > 0 ? parts.join(', ') : t('All')
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Configure discount rates for specific users, groups, or models. More specific rules take priority.'
          )}
        </p>
        <Button onClick={openAdd} size='sm'>
          <Plus className='mr-1.5 h-4 w-4' />
          {t('Add Discount Rule')}
        </Button>
      </div>

      {isLoading ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          {t('Loading...')}
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[100px]'>ID</TableHead>
                <TableHead>{t('Target')}</TableHead>
                <TableHead className='w-[120px]'>{t('Discount')}</TableHead>
                <TableHead className='w-[100px]'>{t('Enabled')}</TableHead>
                <TableHead className='w-[100px]'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {t('No discount rules configured')}
                  </TableCell>
                </TableRow>
              ) : (
                discounts.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='font-mono text-xs'>
                      {item.id}
                    </TableCell>
                    <TableCell>{formatTarget(item)}</TableCell>
                    <TableCell>
                      <span className='font-medium text-green-600 dark:text-green-400'>
                        {formatDiscount(item.discount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.enabled
                        ? t('Enabled')
                        : t('Disabled')}
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className='h-4 w-4 text-destructive' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm()
          setDialogOpen(open)
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {editingId !== null
                ? t('Edit Discount Rule')
                : t('Add Discount Rule')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Leave fields empty to apply to all. For example, set only User ID for a user-wide discount, or set only Model ID for a model-wide discount.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='grid gap-2'>
              <Label htmlFor='user_id'>{t('User ID')}</Label>
              <Combobox
                id='user_id'
                options={userOptions}
                value={form.user_id}
                onValueChange={(v) =>
                  setForm({ ...form, user_id: v ?? '' })
                }
                placeholder={t('All users')}
                searchPlaceholder={t('Search users...')}
                emptyText={t('No users found')}
                allowCustomValue
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='group'>{t('Group')}</Label>
              <Combobox
                id='group'
                options={groupOptions}
                value={form.group}
                onValueChange={(v) =>
                  setForm({ ...form, group: v ?? '' })
                }
                placeholder={t('All groups')}
                searchPlaceholder={t('Search groups...')}
                emptyText={t('No groups found')}
                allowCustomValue
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='model_id'>{t('Model ID')}</Label>
              <Input
                id='model_id'
                placeholder={t('Leave empty for all models, or use gpt-* for prefix match')}
                value={form.model_id}
                onChange={(e) =>
                  setForm({ ...form, model_id: e.target.value })
                }
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='discount'>{t('Discount')}</Label>
              <Input
                id='discount'
                type='number'
                step='0.01'
                min='0'
                max='1'
                placeholder='0.8'
                value={form.discount}
                onChange={(e) =>
                  setForm({ ...form, discount: e.target.value })
                }
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  '0.8 means 20% off (multiplied by 0.8). 1 means no discount.'
                )}
              </p>
            </div>
            {editingId !== null && (
              <div className='flex items-center gap-2'>
                <Switch
                  id='enabled'
                  checked={form.enabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, enabled: checked })
                  }
                />
                <Label htmlFor='enabled'>{t('Enabled')}</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setDialogOpen(false)
                resetForm()
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? t('Saving...')
                : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Delete Discount Rule')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Are you sure you want to delete this discount rule? This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId !== null) deleteMutation.mutate(deleteId)
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t('Deleting...')
                : t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
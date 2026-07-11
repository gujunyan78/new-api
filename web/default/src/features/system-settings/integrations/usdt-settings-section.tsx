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
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SettingsSwitchField } from '../components/settings-form-layout'

export interface UsdtWallet {
  address: string
  blockchain_type: 'tron' | 'ethereum'
  priority: number
  enabled: boolean
}

export interface UsdtSettingsValues {
  UsdtEnabled: boolean
  UsdtMinTopUp: number
  TronGridApiKey: string
  EtherscanApiKey: string
}

type UsdtFieldValues = UsdtSettingsValues

interface Props {
  values: UsdtSettingsValues
  onValueChange: <K extends keyof UsdtFieldValues>(
    key: K,
    value: UsdtFieldValues[K]
  ) => void
  wallets: UsdtWallet[]
  onWalletsChange: (wallets: UsdtWallet[]) => void
}

function validateWalletAddress(
  address: string,
  blockchainType: 'tron' | 'ethereum'
): string {
  if (blockchainType === 'tron') {
    if (!address.startsWith('T') || address.length !== 34) {
      return 'Tron address must start with T and be 34 characters long'
    }
  } else if (blockchainType === 'ethereum') {
    if (!address.startsWith('0x') || address.length !== 42) {
      return 'Ethereum address must start with 0x and be 42 characters long'
    }
  }
  return ''
}

export function UsdtSettingsSection({
  values,
  onValueChange,
  wallets,
  onWalletsChange,
}: Props) {
  const { t } = useTranslation()
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState(-1)
  const [walletForm, setWalletForm] = useState<UsdtWallet>({
    address: '',
    blockchain_type: 'tron',
    priority: 100,
    enabled: true,
  })

  const openAddWallet = useCallback(() => {
    setEditingIndex(-1)
    setWalletForm({
      address: '',
      blockchain_type: 'tron',
      priority: 100,
      enabled: true,
    })
    setWalletDialogOpen(true)
  }, [])

  const openEditWallet = useCallback(
    (index: number) => {
      setEditingIndex(index)
      setWalletForm({ ...wallets[index] })
      setWalletDialogOpen(true)
    },
    [wallets]
  )

  const saveWallet = useCallback(() => {
    const trimmedAddress = walletForm.address.trim()
    if (!trimmedAddress) {
      toast.error(t('Wallet address cannot be empty'))
      return
    }
    const validationError = validateWalletAddress(
      trimmedAddress,
      walletForm.blockchain_type
    )
    if (validationError) {
      toast.error(t(validationError))
      return
    }
    const newWallet: UsdtWallet = {
      address: trimmedAddress,
      blockchain_type: walletForm.blockchain_type,
      priority: walletForm.priority ?? 100,
      enabled: walletForm.enabled,
    }
    if (editingIndex === -1) {
      onWalletsChange([...wallets, newWallet])
    } else {
      const updated = [...wallets]
      updated[editingIndex] = newWallet
      onWalletsChange(updated)
    }
    setWalletDialogOpen(false)
  }, [walletForm, editingIndex, wallets, onWalletsChange, t])

  const deleteWallet = useCallback(
    (index: number) => {
      onWalletsChange(wallets.filter((_, i) => i !== index))
    },
    [wallets, onWalletsChange]
  )

  return (
    <>
      <div className='space-y-4 pt-4'>
        <div>
          <h3 className='text-lg font-medium'>{t('USDT Payment')}</h3>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Configure USDT cryptocurrency payments supporting Tron (TRC-20) and Ethereum (ERC-20) networks. API keys are required for automatic transaction verification.'
            )}
          </p>
        </div>

        <Alert>
          <AlertDescription className='text-xs'>
            {t(
              'Configure USDT payment settings to accept cryptocurrency payments. You need to configure blockchain API keys to verify transactions automatically.'
            )}
          </AlertDescription>
        </Alert>

        <SettingsSwitchField
          checked={values.UsdtEnabled}
          onCheckedChange={(v) => onValueChange('UsdtEnabled', v)}
          label={t('Enable USDT Payment')}
          className='border-b-0 py-0'
        />

        <div className='grid gap-1.5'>
          <Label>{t('Minimum Top-up Amount')}</Label>
          <Input
            type='number'
            min={1}
            step={1}
            value={values.UsdtMinTopUp}
            onChange={(event) =>
              onValueChange(
                'UsdtMinTopUp',
                event.target.value === '' ? 1 : Number(event.target.value)
              )
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('Minimum USDT top-up amount, default 1')}
          </p>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('TronGrid API Key')}</Label>
            <Input
              type='password'
              value={values.TronGridApiKey}
              onChange={(event) =>
                onValueChange('TronGridApiKey', event.target.value)
              }
              placeholder={t('For querying USDT transactions on Tron chain')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Etherscan API Key')}</Label>
            <Input
              type='password'
              value={values.EtherscanApiKey}
              onChange={(event) =>
                onValueChange('EtherscanApiKey', event.target.value)
              }
              placeholder={t(
                'For querying USDT transactions on Ethereum chain'
              )}
            />
          </div>
        </div>

        <Separator />

        <div className='flex items-center justify-between'>
          <h4 className='font-medium'>{t('Receiving Wallet Addresses')}</h4>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={openAddWallet}
          >
            <Plus className='mr-1 h-3 w-3' />
            {t('Add wallet address')}
          </Button>
        </div>

        <p className='text-muted-foreground text-xs'>
          {t(
            'Manage USDT receiving wallet addresses. The system selects enabled wallets by priority for receiving transfers.'
          )}
        </p>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Wallet Address')}</TableHead>
                <TableHead>{t('Blockchain')}</TableHead>
                <TableHead>{t('Priority')}</TableHead>
                <TableHead>{t('Enabled')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {t('No wallet addresses configured')}
                  </TableCell>
                </TableRow>
              ) : (
                wallets.map((wallet, idx) => (
                  <TableRow key={idx}>
                    <TableCell className='font-mono text-xs'>
                      {wallet.address}
                    </TableCell>
                    <TableCell>
                      {wallet.blockchain_type === 'tron'
                        ? 'Tron (TRC-20)'
                        : 'Ethereum (ERC-20)'}
                    </TableCell>
                    <TableCell>{wallet.priority}</TableCell>
                    <TableCell>
                      {wallet.enabled ? t('Yes') : t('No')}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() => openEditWallet(idx)}
                        >
                          <Pencil className='h-3 w-3' />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() => deleteWallet(idx)}
                        >
                          <Trash2 className='h-3 w-3' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex === -1
                ? t('Add wallet address')
                : t('Edit wallet address')}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='grid gap-1.5'>
              <Label>{t('Blockchain')} *</Label>
              <Select
                value={walletForm.blockchain_type}
                onValueChange={(val) =>
                  setWalletForm((prev) => ({
                    ...prev,
                    blockchain_type: val as 'tron' | 'ethereum',
                    address: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='tron'>Tron (TRC-20)</SelectItem>
                  <SelectItem value='ethereum'>
                    Ethereum (ERC-20)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Wallet Address')} *</Label>
              <Input
                value={walletForm.address}
                onChange={(e) =>
                  setWalletForm((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder={
                  walletForm.blockchain_type === 'tron' ? 'T...' : '0x...'
                }
                className='font-mono'
              />
              <p className='text-muted-foreground text-xs'>
                {walletForm.blockchain_type === 'tron'
                  ? t('Tron address starts with T, length 34 characters')
                  : t(
                      'Ethereum address starts with 0x, length 42 characters'
                    )}
              </p>
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Priority')}</Label>
              <Input
                type='number'
                min={0}
                step={1}
                value={walletForm.priority}
                onChange={(e) =>
                  setWalletForm((prev) => ({
                    ...prev,
                    priority:
                      e.target.value === '' ? 0 : Number(e.target.value),
                  }))
                }
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Higher values mean higher priority. The system uses the highest priority wallet first.'
                )}
              </p>
            </div>
            <div className='flex items-center justify-between'>
              <Label>{t('Enabled')}</Label>
              <Switch
                checked={walletForm.enabled}
                onCheckedChange={(checked) =>
                  setWalletForm((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setWalletDialogOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='button' onClick={saveWallet}>
              {t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

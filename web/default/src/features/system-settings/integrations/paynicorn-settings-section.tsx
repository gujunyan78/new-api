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
import { useUpdateOption } from '../hooks/use-update-option'
import { SettingsSection } from '../components/settings-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Info } from 'lucide-react'
import { toast } from 'sonner'

export type PaynicornSettingsValues = {
  PaynicornEnabled: boolean
  PaynicornSandbox: boolean
  PaynicornGatewayUrl: string
  PaynicornSandboxUrl: string
  PaynicornMerchantId: string
  PaynicornAppKey: string
  PaynicornAppSecret: string
  PaynicornCurrency: string
  PaynicornNotifyUrl: string
  PaynicornReturnUrl: string
  PaynicornMinUnit: number
  PaynicornCountryCode: string
}

type Props = {
  defaultValues: PaynicornSettingsValues
}

export function PaynicornSettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)
  const [formValues, setFormValues] = useState<PaynicornSettingsValues>(
    props.defaultValues
  )

  const handleSave = async () => {
    setLoading(true)
    try {
      const options = [
        {
          key: 'PaynicornEnabled',
          value: formValues.PaynicornEnabled ? 'true' : 'false',
        },
        {
          key: 'PaynicornSandbox',
          value: formValues.PaynicornSandbox ? 'true' : 'false',
        },
        {
          key: 'PaynicornGatewayUrl',
          value: formValues.PaynicornGatewayUrl.replace(/\/$/, ''),
        },
        {
          key: 'PaynicornSandboxUrl',
          value: formValues.PaynicornSandboxUrl.replace(/\/$/, ''),
        },
        { key: 'PaynicornMerchantId', value: formValues.PaynicornMerchantId },
        { key: 'PaynicornAppKey', value: formValues.PaynicornAppKey },
        { key: 'PaynicornAppSecret', value: formValues.PaynicornAppSecret },
        {
          key: 'PaynicornCurrency',
          value: formValues.PaynicornCurrency || 'USD',
        },
        { key: 'PaynicornNotifyUrl', value: formValues.PaynicornNotifyUrl },
        { key: 'PaynicornReturnUrl', value: formValues.PaynicornReturnUrl },
        {
          key: 'PaynicornMinUnit',
          value: String(formValues.PaynicornMinUnit || 100),
        },
        { key: 'PaynicornCountryCode', value: formValues.PaynicornCountryCode },
      ]

      await Promise.all(
        options.map((opt) => updateOption.mutateAsync(opt))
      )
      toast.success(t('Saved successfully'))
    } catch {
      toast.error(t('Failed to save'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection title={t('Paynicorn Payment')}>
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Info className='w-4 h-4 text-gray-400' />
            <span>{t('Enable Paynicorn')}</span>
          </div>
          <Switch
            checked={formValues.PaynicornEnabled}
            onCheckedChange={(checked) =>
              setFormValues((prev) => ({ ...prev, PaynicornEnabled: checked }))
            }
          />
        </div>

        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Info className='w-4 h-4 text-gray-400' />
            <span>{t('Enable Sandbox Mode')}</span>
          </div>
          <Switch
            checked={formValues.PaynicornSandbox}
            onCheckedChange={(checked) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornSandbox: checked,
              }))
            }
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>
            {t('Payment Gateway URL')}
          </label>
          <Input
            value={formValues.PaynicornGatewayUrl}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornGatewayUrl: e.target.value,
              }))
            }
            placeholder='https://api.paynicorn.com'
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>
            {t('Sandbox Gateway URL')}
          </label>
          <Input
            value={formValues.PaynicornSandboxUrl}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornSandboxUrl: e.target.value,
              }))
            }
            placeholder='https://sandbox-api.paynicorn.com'
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('Merchant ID')}</label>
          <Input
            value={formValues.PaynicornMerchantId}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornMerchantId: e.target.value,
              }))
            }
            placeholder={t('Merchant identifier')}
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('APP Key')}</label>
          <Input
            value={formValues.PaynicornAppKey}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornAppKey: e.target.value,
              }))
            }
            placeholder={t('Application key')}
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('APP Secret')}</label>
          <Input
            type='password'
            value={formValues.PaynicornAppSecret}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornAppSecret: e.target.value,
              }))
            }
            placeholder={t('Application secret')}
          />
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>{t('Currency')}</label>
            <Input
              value={formValues.PaynicornCurrency}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  PaynicornCurrency: e.target.value,
                }))
              }
              placeholder='USD'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>
              {t('Country Code')}
            </label>
            <Input
              value={formValues.PaynicornCountryCode}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  PaynicornCountryCode: e.target.value,
                }))
              }
              placeholder='US'
            />
          </div>
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>
            {t('Min Unit of Local Currency')}
          </label>
          <Input
            type='number'
            min={1}
            value={formValues.PaynicornMinUnit}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornMinUnit: Number(e.target.value),
              }))
            }
            placeholder='100'
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>
            {t('Async Notify URL')}
          </label>
          <Input
            value={formValues.PaynicornNotifyUrl}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornNotifyUrl: e.target.value,
              }))
            }
            placeholder='https://yourdomain.com/api/payment/paynicorn/notify'
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>
            {t('Frontend Payment Result URL')}
          </label>
          <Input
            value={formValues.PaynicornReturnUrl}
            onChange={(e) =>
              setFormValues((prev) => ({
                ...prev,
                PaynicornReturnUrl: e.target.value,
              }))
            }
            placeholder='https://yourdomain.com/payment/result'
          />
        </div>

        <Button
          variant='default'
          onClick={handleSave}
          disabled={loading}
          className='w-full'
        >
          {loading ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
    </SettingsSection>
  )
}

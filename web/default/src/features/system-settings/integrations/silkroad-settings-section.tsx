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
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSwitchField } from '../components/settings-form-layout'

export interface SilkroadSettingsValues {
  pay_silkroad_enable: boolean
  pay_silkroad_sandbox: boolean
  pay_silkroad_mch_id: string
  pay_silkroad_app_id: string
  pay_silkroad_gateway_url: string
  pay_silkroad_sandbox_url: string
  pay_silkroad_notify_url: string
  pay_silkroad_private_key: string
  pay_silkroad_platform_public_key: string
  pay_silkroad_payment_method: string
  pay_silkroad_category: number
  pay_silkroad_currency: string
  pay_silkroad_serial_no: string
}

type SilkroadFieldValues = Omit<
  SilkroadSettingsValues,
  'pay_silkroad_payment_method' | 'pay_silkroad_category'
>

interface Props {
  values: SilkroadSettingsValues
  onValueChange: <K extends keyof SilkroadFieldValues>(
    key: K,
    value: SilkroadFieldValues[K]
  ) => void
  onPaymentMethodChange: (value: string) => void
  onCategoryChange: (value: number) => void
}

export function SilkroadSettingsSection({
  values,
  onValueChange,
  onPaymentMethodChange,
  onCategoryChange,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className='space-y-4 pt-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('Gwiff Pay Gateway')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Gwiff Pay payment platform configuration. Signature algorithm: RSA-SHA256.'
          )}
        </p>
      </div>

      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Configure Gwiff Pay settings for processing payment transactions.'
          )}
        </AlertDescription>
      </Alert>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SettingsSwitchField
          checked={values.pay_silkroad_enable}
          onCheckedChange={(v) => onValueChange('pay_silkroad_enable', v)}
          label={t('Enable Gwiff Pay')}
          className='border-b-0 py-0'
        />
        <SettingsSwitchField
          checked={values.pay_silkroad_sandbox}
          onCheckedChange={(v) => onValueChange('pay_silkroad_sandbox', v)}
          label={t('Sandbox mode')}
          className='border-b-0 py-0'
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Merchant ID')}</Label>
          <Input
            value={values.pay_silkroad_mch_id}
            onChange={(event) =>
              onValueChange('pay_silkroad_mch_id', event.target.value)
            }
            placeholder={t('Platform-assigned unique merchant ID')}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Application ID')}</Label>
          <Input
            value={values.pay_silkroad_app_id}
            onChange={(event) =>
              onValueChange('pay_silkroad_app_id', event.target.value)
            }
            placeholder={t('Platform-assigned application ID')}
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Production Gateway URL')}</Label>
          <Input
            value={values.pay_silkroad_gateway_url}
            onChange={(event) =>
              onValueChange('pay_silkroad_gateway_url', event.target.value)
            }
            placeholder='https://api.gwiff.com'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Sandbox Gateway URL')}</Label>
          <Input
            value={values.pay_silkroad_sandbox_url}
            onChange={(event) =>
              onValueChange('pay_silkroad_sandbox_url', event.target.value)
            }
            placeholder='https://sandbox.gwiff.com'
          />
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label>{t('Async Callback URL')}</Label>
        <Input
          value={values.pay_silkroad_notify_url}
          onChange={(event) =>
            onValueChange('pay_silkroad_notify_url', event.target.value)
          }
          placeholder='https://yourdomain.com/api/silkroad/notify'
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Merchant Private Key')}</Label>
          <Textarea
            rows={4}
            value={values.pay_silkroad_private_key}
            onChange={(event) =>
              onValueChange('pay_silkroad_private_key', event.target.value)
            }
            placeholder={t('PEM format private key, encrypted storage')}
            className='font-mono text-xs'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Platform Public Key')}</Label>
          <Textarea
            rows={4}
            value={values.pay_silkroad_platform_public_key}
            onChange={(event) =>
              onValueChange(
                'pay_silkroad_platform_public_key',
                event.target.value
              )
            }
            placeholder={t('PEM format platform public key, for signature verification')}
            className='font-mono text-xs'
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Payment Method')}</Label>
          <Select
            value={values.pay_silkroad_payment_method}
            onValueChange={onPaymentMethodChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='SOLID_BANK'>SOLID_BANK</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Certificate Serial Number')}</Label>
          <Input
            value={values.pay_silkroad_serial_no}
            onChange={(event) =>
              onValueChange('pay_silkroad_serial_no', event.target.value)
            }
            placeholder={t('Merchant certificate serial number')}
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Transaction Category')}</Label>
          <Select
            value={String(values.pay_silkroad_category)}
            onValueChange={(v) => onCategoryChange(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1'>{t('Physical goods')}</SelectItem>
              <SelectItem value='2'>{t('Services')}</SelectItem>
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-xs'>
            {t('1 - Physical goods, 2 - Services')}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Currency')}</Label>
          <Input
            value={values.pay_silkroad_currency}
            onChange={(event) =>
              onValueChange('pay_silkroad_currency', event.target.value)
            }
            placeholder='RUB'
          />
        </div>
      </div>
    </div>
  )
}

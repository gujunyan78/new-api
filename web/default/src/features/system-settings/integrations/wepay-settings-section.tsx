/*
Copyright (C) 2025 QuantumNous

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

export type WepaySettingsValues = {
  WepayEnabled: boolean
  WepaySandbox: boolean
  WepayMerchantId: string
  SbpPrivateKey: string
  SbpPublicKey: string
  SbpCallbackUrl: string
  SbpNotifyUrl: string
  SbpPlatformUrl: string
  SbpSandboxUrl: string
  SbpLogo: string
  MirPrivateKey: string
  MirPublicKey: string
  MirCallbackUrl: string
  MirNotifyUrl: string
  MirPlatformUrl: string
  MirSandboxUrl: string
  MirLogo: string
}

type Props = {
  defaultValues: WepaySettingsValues
}

export function WepaySettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)
  const [formValues, setFormValues] = useState<WepaySettingsValues>(props.defaultValues)

  const handleSave = async () => {
    setLoading(true)
    try {
      const options = [
        { key: 'WepayEnabled', value: formValues.WepayEnabled ? 'true' : 'false' },
        { key: 'WepaySandbox', value: formValues.WepaySandbox ? 'true' : 'false' },
        { key: 'WepayMerchantId', value: formValues.WepayMerchantId },
        { key: 'SbpPrivateKey', value: formValues.SbpPrivateKey },
        { key: 'SbpPublicKey', value: formValues.SbpPublicKey },
        { key: 'SbpCallbackUrl', value: formValues.SbpCallbackUrl },
        { key: 'SbpNotifyUrl', value: formValues.SbpNotifyUrl },
        { key: 'SbpPlatformUrl', value: formValues.SbpPlatformUrl.replace(/\/$/, '') },
        { key: 'SbpSandboxUrl', value: formValues.SbpSandboxUrl.replace(/\/$/, '') },
        { key: 'SbpLogo', value: formValues.SbpLogo },
        { key: 'MirPrivateKey', value: formValues.MirPrivateKey },
        { key: 'MirPublicKey', value: formValues.MirPublicKey },
        { key: 'MirCallbackUrl', value: formValues.MirCallbackUrl },
        { key: 'MirNotifyUrl', value: formValues.MirNotifyUrl },
        { key: 'MirPlatformUrl', value: formValues.MirPlatformUrl.replace(/\/$/, '') },
        { key: 'MirSandboxUrl', value: formValues.MirSandboxUrl.replace(/\/$/, '') },
        { key: 'MirLogo', value: formValues.MirLogo },
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
    <SettingsSection
      title={t('Wepay Payment')}
      description={t('Configure Wepay payment gateway (SBP + MIR) for Russian region payments')}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-gray-400" />
            <span>{t('Enable Wepay')}</span>
          </div>
          <Switch
            checked={formValues.WepayEnabled}
            onCheckedChange={(checked) =>
              setFormValues((prev) => ({ ...prev, WepayEnabled: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-gray-400" />
            <span>{t('Enable Sandbox Mode')}</span>
          </div>
          <Switch
            checked={formValues.WepaySandbox}
            onCheckedChange={(checked) =>
              setFormValues((prev) => ({ ...prev, WepaySandbox: checked }))
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('Merchant ID')}</label>
          <Input
            value={formValues.WepayMerchantId}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, WepayMerchantId: e.target.value }))
            }
            placeholder={t('Merchant identifier')}
          />
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="text-base font-semibold mb-3">{t('SBP Settings')}</h4>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('SBP Payment Platform URL')}</label>
              <Input
                value={formValues.SbpPlatformUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, SbpPlatformUrl: e.target.value }))
                }
                placeholder="https://api.sbp.ru"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('SBP Sandbox URL')}</label>
              <Input
                value={formValues.SbpSandboxUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, SbpSandboxUrl: e.target.value }))
                }
                placeholder="https://sandbox.sbp.ru"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('SBP Merchant PrivateKey')}</label>
              <Input
                value={formValues.SbpPrivateKey}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, SbpPrivateKey: e.target.value }))
                }
                placeholder={t('Merchant private key')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('SBP Platform PublicKey')}</label>
              <Input
                value={formValues.SbpPublicKey}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, SbpPublicKey: e.target.value }))
                }
                placeholder={t('Platform public key')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('SBP Callback URL')}</label>
              <Input
                value={formValues.SbpCallbackUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, SbpCallbackUrl: e.target.value }))
                }
                placeholder="https://yourdomain.com/api/payment/callback"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('SBP Notify URL')}</label>
              <Input
                value={formValues.SbpNotifyUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, SbpNotifyUrl: e.target.value }))
                }
                placeholder="https://yourdomain.com/api/payment/notify"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('SBP Frontend Logo URL')}</label>
              <Input
                value={formValues.SbpLogo}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, SbpLogo: e.target.value }))
                }
                placeholder={t('Logo image URL for frontend display')}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="text-base font-semibold mb-3">{t('MIR Settings')}</h4>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('MIR Payment Platform URL')}</label>
              <Input
                value={formValues.MirPlatformUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, MirPlatformUrl: e.target.value }))
                }
                placeholder="https://api.mir.ru"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('MIR Sandbox URL')}</label>
              <Input
                value={formValues.MirSandboxUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, MirSandboxUrl: e.target.value }))
                }
                placeholder="https://sandbox.mir.ru"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('MIR Merchant PrivateKey')}</label>
              <Input
                value={formValues.MirPrivateKey}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, MirPrivateKey: e.target.value }))
                }
                placeholder={t('Merchant private key')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('MIR Platform PublicKey')}</label>
              <Input
                value={formValues.MirPublicKey}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, MirPublicKey: e.target.value }))
                }
                placeholder={t('Platform public key')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('MIR Callback URL')}</label>
              <Input
                value={formValues.MirCallbackUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, MirCallbackUrl: e.target.value }))
                }
                placeholder="https://yourdomain.com/api/payment/callback"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('MIR Notify URL')}</label>
              <Input
                value={formValues.MirNotifyUrl}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, MirNotifyUrl: e.target.value }))
                }
                placeholder="https://yourdomain.com/api/payment/notify"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('MIR Frontend Logo URL')}</label>
              <Input
                value={formValues.MirLogo}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, MirLogo: e.target.value }))
                }
                placeholder={t('Logo image URL for frontend display')}
              />
            </div>
          </div>
        </div>

        <Button
          variant="default"
          onClick={handleSave}
          disabled={loading}
          className="w-full"
        >
          {loading ? t('Saving...') : t('Save Settings')}
        </Button>
      </div>
    </SettingsSection>
  )
}
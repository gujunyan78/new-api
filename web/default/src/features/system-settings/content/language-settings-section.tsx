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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const languageSettingsSchema = z.object({
  defaultLanguage: z.string().min(1),
  availableLanguages: z.string().min(1),
  disableLanguageSwitch: z.boolean(),
})

type LanguageSettingsFormValues = z.infer<typeof languageSettingsSchema>

// 表单字段到系统配置键的映射，字段本身保持扁平以兼容 react-hook-form 路径类型
const OPTION_KEY_MAP = {
  defaultLanguage: 'console_setting.default_language',
  availableLanguages: 'console_setting.available_languages',
  disableLanguageSwitch: 'console_setting.disable_language_switch',
} as const

type LanguageSettingsSectionProps = {
  defaultValues: LanguageSettingsFormValues
}

export function LanguageSettingsSection({
  defaultValues,
}: LanguageSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<LanguageSettingsFormValues>({
    resolver: zodResolver(languageSettingsSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (values: LanguageSettingsFormValues) => {
    const changed = (
      Object.keys(OPTION_KEY_MAP) as Array<keyof LanguageSettingsFormValues>
    ).filter((field) => values[field] !== defaultValues[field])

    for (const field of changed) {
      await updateOption.mutateAsync({
        key: OPTION_KEY_MAP[field],
        value: values[field],
      })
    }
  }

  const languageOptions = form
    .watch('availableLanguages')
    .split(',')
    .map((lang) => lang.trim())
    .filter(Boolean)

  return (
    <SettingsSection title={t('Language')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <FormField
            control={form.control}
            name='defaultLanguage'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Default language')}</FormLabel>
                <Select
                  items={languageOptions.map((lang) => ({
                    value: lang,
                    label: lang,
                  }))}
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select a language')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {languageOptions.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('Language used when a visitor has no saved preference')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='availableLanguages'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Available languages')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder='en,zh,fr,ru,ja,vi' />
                </FormControl>
                <FormDescription>
                  {t('Comma-separated language codes shown in the switcher')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='disableLanguageSwitch'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Disable language switch')}</FormLabel>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

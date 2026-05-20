/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { getSystemOptions } from '@/features/system-settings/api'

export function useLanguageSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ['language-settings'],
    queryFn: getSystemOptions,
    staleTime: 5 * 60 * 1000,
  })

  const defaultLanguage =
    data?.data?.find((opt) => opt.key === 'DefaultLanguage')?.value || 'en'
  const availableLanguagesStr =
    data?.data?.find((opt) => opt.key === 'AvailableLanguages')?.value ||
    'en,zh,fr,ru,ja,vi'
  const disableLanguageSwitch =
    data?.data?.find((opt) => opt.key === 'DisableLanguageSwitch')?.value ===
    'true'

  const availableLanguages = availableLanguagesStr
    .split(',')
    .map((lang) => lang.trim())
    .filter((lang) => lang)

  return {
    defaultLanguage,
    availableLanguages,
    disableLanguageSwitch,
    isLoading,
  }
}

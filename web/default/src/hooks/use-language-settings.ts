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
import { useStatus } from '@/hooks/use-status'

const DEFAULT_LANGUAGE = 'en'
const DEFAULT_AVAILABLE_LANGUAGES = 'en,zh,fr,ru,ja,vi'

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

/**
 * 语言配置对所有用户公开，随 /api/status 下发，无需管理员权限。
 */
export function useLanguageSettings() {
  const { status, loading } = useStatus()

  const data = status?.data
  const defaultLanguage = readString(data?.default_language, DEFAULT_LANGUAGE)
  const availableLanguagesStr = readString(
    data?.available_languages,
    DEFAULT_AVAILABLE_LANGUAGES
  )
  const disableLanguageSwitch = data?.disable_language_switch === true

  const availableLanguages = availableLanguagesStr
    .split(',')
    .map((lang) => lang.trim())
    .filter((lang) => lang)

  return {
    defaultLanguage,
    availableLanguages,
    disableLanguageSwitch,
    isLoading: loading,
  }
}

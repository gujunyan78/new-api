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
import { useEffect, useMemo } from 'react'

import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'

export interface PageMeta {
  title: string
  description: string
  keywords: string
}

export interface SEOConfig {
  pages: Array<PageMeta & { page: string }>
}

const DEFAULT_SEO: SEOConfig = { pages: [] }

/**
 * Parse the raw SEOSettings option value into a structured SEOConfig.
 */
export function parseSEOSettings(raw: string | undefined): SEOConfig {
  if (!raw) return DEFAULT_SEO
  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.pages)) {
      return parsed as SEOConfig
    }
    if (Array.isArray(parsed)) {
      return { pages: parsed }
    }
    return DEFAULT_SEO
  } catch {
    return DEFAULT_SEO
  }
}

/**
 * Hook that loads SEO configuration from backend system options.
 */
export function useSEOSettings(): SEOConfig {
  const { data: res } = useSystemOptions()

  const raw = useMemo(() => {
    const settings = getOptionValue(res?.data ?? [], {
      SEOSettings: '' as string | unknown[],
    })
    const v = settings.SEOSettings
    return typeof v === 'string' ? v : ''
  }, [res])

  return useMemo(() => parseSEOSettings(raw), [raw])
}

/**
 * Cleanup and reset DOM meta tags to defaults.
 */
function resetMeta() {
  const metaNames = ['description', 'keywords']
  metaNames.forEach((name) => {
    const el = document.querySelector(`meta[name="${name}"]`)
    if (el) el.remove()
  })
}

/**
 * Apply SEO meta tags for the given page path.
 *
 * Call this in route components. If no matching config is found, the
 * title/meta are left as-is (the root layout provides fallback values).
 *
 * @param pagePath - Route path to look up, e.g. "/about", "/pricing"
 * @param overrides - Optional values that take precedence over config
 */
export function usePageMeta(
  pagePath?: string,
  overrides?: Partial<PageMeta>
) {
  const seoConfig = useSEOSettings()

  useEffect(() => {
    const entry = pagePath
      ? seoConfig.pages.find((p) => p.page === pagePath)
      : undefined

    const title = overrides?.title || entry?.title || ''
    const description = overrides?.description || entry?.description || ''
    const keywords = overrides?.keywords || entry?.keywords || ''

    if (title) {
      document.title = title
    }

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`)
      if (content) {
        if (!el) {
          el = document.createElement('meta')
          el.setAttribute('name', name)
          document.head.appendChild(el)
        }
        el.setAttribute('content', content)
      } else {
        if (el) el.remove()
      }
    }

    setMeta('description', description)
    setMeta('keywords', keywords)

    return () => {
      resetMeta()
    }
  }, [seoConfig, pagePath, overrides?.title, overrides?.description, overrides?.keywords])
}

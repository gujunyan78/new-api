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

import { useMemo } from 'react';

  //const DEFAULT_DEFAULT_LANGUAGE = 'ru'; //'zh-CN'
  const DEFAULT_DEFAULT_LANGUAGE = 'zh-CN';

//const DEFAULT_AVAILABLE_LANGUAGES = [ 'ru','en'];  // ['zh-CN', 'zh-TW', 'en', 'fr', 'ru', 'ja', 'vi']
const DEFAULT_AVAILABLE_LANGUAGES =['zh-CN', 'zh-TW', 'en', 'fr', 'ru', 'ja', 'vi'];
const DEFAULT_DISABLE_LANGUAGE_SWITCH = false;

export const useLanguageSettings = () => {
  const languageOptions = useMemo(() => {

    const allLanguages = {
      'zh-CN': { code: 'zh-CN', label: '简体中文' },
      'zh-TW': { code: 'zh-TW', label: '繁體中文' },
      'en': { code: 'en', label: 'English' },
      'fr': { code: 'fr', label: 'Français' },
      'ru': { code: 'ru', label: 'Русский' },
      'ja': { code: 'ja', label: '日本語' },
      'vi': { code: 'vi', label: 'Tiếng Việt' },
    };

/*
     const allLanguages = {
      'ru': { code: 'ru', label: 'Русский' },
      'en': { code: 'en', label: 'English' },
    };

 */
    return DEFAULT_AVAILABLE_LANGUAGES
      .map(code => allLanguages[code])
      .filter(Boolean);
  }, []);

  return {
    defaultLanguage: DEFAULT_DEFAULT_LANGUAGE,
    availableLanguages: DEFAULT_AVAILABLE_LANGUAGES,
    languageOptions,
    disableLanguageSwitch: DEFAULT_DISABLE_LANGUAGE_SWITCH,
    isLoading: false,
  };
};

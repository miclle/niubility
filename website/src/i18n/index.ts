import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

// Import dayjs locales
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'

// Extend dayjs with plugins
dayjs.extend(relativeTime)

// Import all translation namespaces
import zhCNCommon from './locales/zh-CN/common.json'
import zhCNNav from './locales/zh-CN/nav.json'
import zhCNHome from './locales/zh-CN/home.json'
import zhCNContent from './locales/zh-CN/content.json'
import zhCNEditor from './locales/zh-CN/editor.json'
import zhCNProfile from './locales/zh-CN/profile.json'
import zhCNSettings from './locales/zh-CN/settings.json'
import zhCNAdmin from './locales/zh-CN/admin.json'
import zhCNComments from './locales/zh-CN/comments.json'
import zhCNAuth from './locales/zh-CN/auth.json'

import enCommon from './locales/en/common.json'
import enNav from './locales/en/nav.json'
import enHome from './locales/en/home.json'
import enContent from './locales/en/content.json'
import enEditor from './locales/en/editor.json'
import enProfile from './locales/en/profile.json'
import enSettings from './locales/en/settings.json'
import enAdmin from './locales/en/admin.json'
import enComments from './locales/en/comments.json'
import enAuth from './locales/en/auth.json'

const STORAGE_KEY = 'i18nextLng'

// Language detection: localStorage -> browser -> default zh-CN
function detectLanguage(): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh-CN' || stored === 'en') {
    return stored
  }
  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en'
}

const initialLang = detectLanguage()

// Set initial dayjs locale
dayjs.locale(initialLang === 'en' ? 'en' : 'zh-cn')

;(i18n as any).use(initReactI18next).init({
  resources: {
    'zh-CN': {
      common: zhCNCommon,
      nav: zhCNNav,
      home: zhCNHome,
      content: zhCNContent,
      editor: zhCNEditor,
      profile: zhCNProfile,
      settings: zhCNSettings,
      admin: zhCNAdmin,
      comments: zhCNComments,
      auth: zhCNAuth,
    },
    en: {
      common: enCommon,
      nav: enNav,
      home: enHome,
      content: enContent,
      editor: enEditor,
      profile: enProfile,
      settings: enSettings,
      admin: enAdmin,
      comments: enComments,
      auth: enAuth,
    },
  },
  lng: initialLang,
  fallbackLng: 'zh-CN',
  defaultNS: 'common',
  ns: ['common', 'nav', 'home', 'content', 'editor', 'profile', 'settings', 'admin', 'comments', 'auth'],
  nsMode: 'fallback',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

// Sync dayjs locale and document lang on language change
i18n.on('languageChanged', (lng) => {
  dayjs.locale(lng === 'en' ? 'en' : 'zh-cn')
  document.documentElement.lang = lng
})

export default i18n

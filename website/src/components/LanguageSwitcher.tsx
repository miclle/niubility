import { useTranslation } from 'react-i18next'

// LanguageSwitcher allows users to switch between zh-CN and en languages.
export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const currentLang = i18n.language

  const toggle = () => {
    const next = currentLang === 'zh-CN' ? 'en' : 'zh-CN'
    i18n.changeLanguage(next)
    localStorage.setItem('i18nextLng', next)
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors hover:bg-black/5 cursor-pointer border-0 bg-transparent"
      style={{ color: '#0f0f0f' }}
      title={currentLang === 'zh-CN' ? 'Switch to English' : '切换到中文'}
    >
      {currentLang === 'zh-CN' ? 'EN' : '中'}
    </button>
  )
}

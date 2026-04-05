import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

// NotFound displays the 404 error page.
function NotFound() {
  const { t } = useTranslation('common')

  return (
    <div className="mesh-gradient min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="relative z-10 text-center">
        <h1 className="text-[10rem] leading-none font-black gradient-text animate-float mb-4">404</h1>
        <p className="text-lg text-zinc-500 mb-8">{t('common:notFound')}</p>
        <Link to="/" className="glow-button">{t('common:backToHome')}</Link>
      </div>
    </div>
  )
}

export default NotFound

import { NavLink } from 'react-router-dom'
import { Home, Play, FileText, BookOpen, GraduationCap, Heart, Star, Lightbulb, Trophy, Coffee, Briefcase, Globe, Flame, UserCheck, ImageIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Category } from 'src/types/content'
import { useAppContext } from 'src/context/app'

// iconMap maps icon name strings to Lucide icon components.
const iconMap: Record<string, LucideIcon> = {
  Home,
  Play,
  FileText,
  BookOpen,
  GraduationCap,
  Heart,
  Star,
  Lightbulb,
  Trophy,
  Coffee,
  Briefcase,
  Globe,
  Flame,
}

// SidebarNavProps defines the props for SidebarNav component.
interface SidebarNavProps {
  category: string
  typeFilter: string
  isHome: boolean
  currentUser: { username: string } | null
  categories: Category[]
  locationPathname: string
}

// SidebarNav renders the sidebar navigation content.
export default function SidebarNav({ category, typeFilter, isHome, currentUser, categories, locationPathname }: SidebarNavProps) {
  const { t } = useTranslation('nav')
  const { siteConfig } = useAppContext()
  const copyright = siteConfig?.copyright?.trim() || 'Niubility'
  const siteVersion = siteConfig?.version?.trim() || ''

  // Render main nav items (Home + Following)
  const renderMainNav = () => (
    <div className="px-3">
      <NavLink
        to="/"
        end
        className={() =>
          `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
            isHome && !typeFilter && !category ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
          }`
        }
        style={{ color: '#0f0f0f' }}
      >
        <Home size={24} />
        <span className="text-sm">{t('nav:home')}</span>
      </NavLink>
      {currentUser && (
        <NavLink
          to="/following"
          className={() =>
            `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
              locationPathname === '/following' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
            }`
          }
          style={{ color: '#0f0f0f' }}
        >
          <UserCheck size={24} />
          <span className="text-sm">{t('nav:following')}</span>
        </NavLink>
      )}
    </div>
  )

  // Render type filter nav items
  const renderTypeFilterNav = () => (
    <div className="px-3">
      <div className="flex items-center justify-between px-3 py-1 mb-1">
        <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>{t('nav:types')}</span>
      </div>
      <NavLink
        to="/videos"
        className={`flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${typeFilter === 'video' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'}`}
        style={{ color: '#0f0f0f' }}
      >
        <Play size={24} />
        <span className="text-sm">{t('nav:video')}</span>
      </NavLink>
      <NavLink
        to="/galleries"
        className={`flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${typeFilter === 'gallery' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'}`}
        style={{ color: '#0f0f0f' }}
      >
        <ImageIcon size={24} />
        <span className="text-sm">{t('nav:gallery')}</span>
      </NavLink>
      <NavLink
        to="/articles"
        className={`flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${typeFilter === 'article' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'}`}
        style={{ color: '#0f0f0f' }}
      >
        <FileText size={24} />
        <span className="text-sm">{t('nav:article')}</span>
      </NavLink>
    </div>
  )

  // Render category nav items
  const renderCategoryNav = () => (
    <div className="px-3">
      {categories.map((cat) => {
        const IconComponent = iconMap[cat.icon] || Home
        return (
          <NavLink
            key={cat.slug}
            to={`/${cat.slug}`}
            className={() =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                category === cat.slug ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <IconComponent size={24} />
            <span className="text-sm">{cat.name}</span>
          </NavLink>
        )
      })}
    </div>
  )

  return (
    <nav className="py-3 overflow-y-auto flex flex-col" style={{ height: 'calc(100% - 56px)' }}>
      {renderMainNav()}
      <div className="my-3 mx-3 h-px" style={{ background: '#e5e5e5' }} />
      {renderTypeFilterNav()}
      <div className="my-3 mx-3 h-px" style={{ background: '#e5e5e5' }} />
      {renderCategoryNav()}
      <div className="mt-auto px-6 py-4 space-y-1 text-xs" style={{ color: '#909090' }}>
        <div>&copy; {new Date().getFullYear()} {copyright}</div>
        {siteVersion && <div>{siteVersion}</div>}
      </div>
    </nav>
  )
}

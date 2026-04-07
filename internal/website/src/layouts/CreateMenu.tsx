import { Link } from 'react-router-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Play, FileText, ImageIcon, Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { contentNewPath } from 'src/lib/content-url'

// CreateMenu renders the create content dropdown button.
export default function CreateMenu() {
  const { t } = useTranslation('nav')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border-0"
            style={{ background: '#0f0f0f', color: '#ffffff' }}
          >
            <Plus size={16} />
            {t('nav:create')}
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link to={contentNewPath('video')} />}>
          <Play size={16} />
          {t('nav:video')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to={contentNewPath('gallery')} />}>
          <ImageIcon size={16} />
          {t('nav:gallery')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to={contentNewPath('article')} />}>
          <FileText size={16} />
          {t('nav:article')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to={contentNewPath('podcast')} />}>
          <Mic size={16} />
          {t('nav:podcast')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

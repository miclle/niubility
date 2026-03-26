import { Link } from 'react-router-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Play, FileText, ImageIcon } from 'lucide-react'

import { contentNewPath } from 'src/lib/content-url'

// CreateMenu renders the create content dropdown button.
export default function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border-0"
            style={{ background: '#0f0f0f', color: '#ffffff' }}
          >
            <Plus size={16} />
            创建
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link to={contentNewPath('video')} />}>
          <Play size={16} />
          视频
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to={contentNewPath('gallery')} />}>
          <ImageIcon size={16} />
          图集
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to={contentNewPath('article')} />}>
          <FileText size={16} />
          文章
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

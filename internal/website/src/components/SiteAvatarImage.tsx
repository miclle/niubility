import type * as React from 'react'

import { AvatarImage } from '@/components/ui/avatar'

import { useAppContext } from 'src/context/app'
import { getStyledAvatar } from 'src/lib/content-assets'

// SiteAvatarImage applies the configured avatar image style before rendering.
function SiteAvatarImage({ src, ...props }: React.ComponentProps<typeof AvatarImage>) {
  const { siteConfig } = useAppContext()

  return <AvatarImage src={getStyledAvatar(src || '', siteConfig)} {...props} />
}

export default SiteAvatarImage

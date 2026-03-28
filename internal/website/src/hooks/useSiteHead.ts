import { useEffect } from 'react'
import type { SiteConfig } from 'src/types/user'
import { siteResourceURL } from 'src/api/upload'

// useSiteHead updates the document head (title, favicon, meta) based on site config.
export function useSiteHead(siteConfig: SiteConfig | null) {
  useEffect(() => {
    // Update title
    const title = siteConfig?.title || 'Niubility'
    document.title = title

    // Update meta description
    const description = siteConfig?.description || ''
    updateMetaTag('description', description)

    // Update meta keywords
    const keywords = siteConfig?.keywords || ''
    updateMetaTag('keywords', keywords)

    // Update application name
    updateMetaTag('application-name', title)

    // Update favicon
    if (siteConfig?.favicon_url) {
      updateFavicon(siteResourceURL(siteConfig.favicon_url))
    } else {
      updateFavicon('/favicon.ico')
    }
  }, [siteConfig])
}

// updateMetaTag creates or updates a meta tag by name.
function updateMetaTag(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  meta.content = content
}

// updateFavicon updates the favicon link.
function updateFavicon(href: string) {
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
}

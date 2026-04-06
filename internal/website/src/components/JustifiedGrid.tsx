import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { fileURL } from 'src/api/upload'
import { useAppContext } from 'src/context/app'
import type { Attachment } from 'src/types/content'

// JustifiedGridProps defines the props for the JustifiedGrid component.
interface JustifiedGridProps {
  items: Attachment[]
  targetRowHeight?: number
  gap?: number
  onImageClick: (index: number) => void
}

// DEFAULT_ASPECT_RATIO is used for items missing width/height data (4:3).
const DEFAULT_ASPECT_RATIO = 4 / 3

// LayoutItem represents a computed position for a single image in the grid.
interface LayoutItem {
  index: number
  width: number
  height: number
  top: number
  left: number
}

// computeLayout calculates the justified grid layout given container width and items.
function computeLayout(
  items: Attachment[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
): { items: LayoutItem[]; totalHeight: number } {
  if (containerWidth <= 0 || items.length === 0) return { items: [], totalHeight: 0 }

  const result: LayoutItem[] = []
  let currentRow: { index: number; aspect: number }[] = []
  let top = 0

  const flush = (row: { index: number; aspect: number }[], isLast: boolean) => {
    if (row.length === 0) return

    const totalAspect = row.reduce((sum, r) => sum + r.aspect, 0)
    const totalGap = (row.length - 1) * gap
    const availableWidth = containerWidth - totalGap

    // Compute the actual row height that makes all images fill the row
    let rowHeight = availableWidth / totalAspect

    // For the last row, don't stretch beyond target height
    if (isLast && rowHeight > targetRowHeight * 1.2) {
      rowHeight = targetRowHeight
    }

    let left = 0
    row.forEach((item, i) => {
      const width = Math.round(item.aspect * rowHeight)
      result.push({ index: item.index, width, height: Math.round(rowHeight), top, left: Math.round(left) })
      left += width + gap

      // Fix rounding: last item in non-last row stretches to fill
      if (!isLast && i === row.length - 1) {
        const last = result[result.length - 1]
        last.width = Math.round(containerWidth - last.left)
      }
    })

    top += Math.round(rowHeight) + gap
  }

  items.forEach((item, index) => {
    const aspect = item.width && item.height ? item.width / item.height : DEFAULT_ASPECT_RATIO
    currentRow.push({ index, aspect })

    // Check if this row exceeds container width at target height
    const totalAspect = currentRow.reduce((sum, r) => sum + r.aspect, 0)
    const totalGap = (currentRow.length - 1) * gap
    const rowWidth = totalAspect * targetRowHeight + totalGap

    if (rowWidth >= containerWidth) {
      flush(currentRow, false)
      currentRow = []
    }
  })

  // Flush last row
  flush(currentRow, true)

  return { items: result, totalHeight: top > 0 ? top - gap : 0 }
}

// JustifiedGrid renders images in a justified (equal-height rows, variable-width) grid layout.
function JustifiedGrid({ items, targetRowHeight = 220, gap = 4, onImageClick }: JustifiedGridProps) {
  const { t } = useTranslation('common')
  const { siteConfig } = useAppContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth)
    }
  }, [])

  useEffect(() => {
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [updateWidth])

  const layout = computeLayout(items, containerWidth, targetRowHeight, gap)

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: layout.totalHeight || 'auto' }}>
      {layout.items.map((item) => {
        const attachment = items[item.index]
        const src = attachment.type === 'video'
          ? fileURL(attachment.url)
          : fileURL(attachment.url, siteConfig?.gallery_detail_image_style)
        return (
          <div
            key={attachment.id || item.index}
            className="absolute overflow-hidden rounded-sm cursor-pointer group"
            style={{ top: item.top, left: item.left, width: item.width, height: item.height }}
            onClick={() => onImageClick(item.index)}
          >
            {attachment.type === 'video' ? (
              <video src={src} className="w-full h-full object-cover" muted preload="metadata" />
            ) : (
              <img src={src} alt={attachment.title || ''} className="w-full h-full object-cover" loading="lazy" />
            )}
            <div className="absolute inset-0 transition-colors group-hover:bg-black/10" />
            {attachment.type === 'video' && (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                {t('common:video')}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default JustifiedGrid

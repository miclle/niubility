import { Monitor, MoonStar, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { useTheme, type ThemePreference } from 'src/context/theme'

interface ThemeDropdownProps {
  align?: 'start' | 'center' | 'end'
  variant?: 'ghost' | 'outline'
  className?: string
}

const optionIcons = {
  system: Monitor,
  light: Sun,
  dark: MoonStar,
} satisfies Record<ThemePreference, typeof Monitor>

export default function ThemeDropdown({
  align = 'end',
  variant = 'ghost',
  className,
}: ThemeDropdownProps) {
  const { t } = useTranslation('nav')
  const { theme, resolvedTheme, setTheme } = useTheme()

  const TriggerIcon = theme === 'system'
    ? resolvedTheme === 'dark'
      ? MoonStar
      : Sun
    : optionIcons[theme]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t('nav:theme')}
            title={t('nav:theme')}
            className={cn(
              'theme-icon-button',
              variant === 'outline' && 'theme-icon-button-outline',
              className,
            )}
          >
            <TriggerIcon size={18} />
          </button>
        }
      />
      <DropdownMenuContent align={align} className="min-w-44">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as ThemePreference)}
        >
          <DropdownMenuRadioItem value="system">
            <Monitor size={16} />
            {t('nav:themeSystem')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun size={16} />
            {t('nav:themeLight')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonStar size={16} />
            {t('nav:themeDark')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

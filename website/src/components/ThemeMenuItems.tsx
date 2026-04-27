import { Monitor, MoonStar, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'

import { useTheme, type ThemePreference } from 'src/context/theme'

const optionIcons = {
  system: Monitor,
  light: Sun,
  dark: MoonStar,
} satisfies Record<ThemePreference, typeof Monitor>

export default function ThemeMenuItems() {
  const { t } = useTranslation('nav')
  const { theme, resolvedTheme, setTheme } = useTheme()

  const TriggerIcon = theme === 'system'
    ? resolvedTheme === 'dark'
      ? MoonStar
      : Sun
    : optionIcons[theme]

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <TriggerIcon size={16} />
        {t('nav:theme')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent alignOffset={-4} className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('nav:theme')}</DropdownMenuLabel>
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
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

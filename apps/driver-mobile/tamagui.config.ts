import { createTamagui } from 'tamagui'
import { config } from '@tamagui/config/v3'

const tamaguiConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      background: '#F5F5F7',
      backgroundStrong: '#FFFFFF',
      color: '#0F172A',
      colorSubtle: '#64748B',
      borderColor: '#E2E8F0',
      primary: '#2563EB',
      danger: '#EF4444',
      success: '#22C55E',
      warning: '#F59E0B',
      muted: '#94A3B8',
      surfaceHover: '#F0F0F2',
      textSecondary: '#64748B',
    },
    dark: {
      ...config.themes.dark,
      background: '#050505',
      backgroundStrong: '#111111',
      color: '#EDEDEF',
      colorSubtle: '#8B8D94',
      borderColor: 'rgba(255,255,255,0.08)',
      primary: '#2563EB',
      danger: '#EF4444',
      success: '#22C55E',
      warning: '#F59E0B',
      muted: '#5C5E66',
      surfaceHover: '#1A1A1A',
      textSecondary: '#8B8D94',
    },
  },
})

export type AppConfig = typeof tamaguiConfig
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
export default tamaguiConfig

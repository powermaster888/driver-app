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
      danger: '#DC2626',
      success: '#16A34A',
      warning: '#F59E0B',
    },
    dark: {
      ...config.themes.dark,
      background: '#0A0A0A',
      backgroundStrong: '#1A1A1A',
      color: '#F7F8F8',
      colorSubtle: '#8A8F98',
      borderColor: 'rgba(255,255,255,0.08)',
      primary: '#3B82F6',
      danger: '#EF4444',
      success: '#4ADE80',
      warning: '#FBBF24',
    },
  },
})

export type AppConfig = typeof tamaguiConfig
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
export default tamaguiConfig

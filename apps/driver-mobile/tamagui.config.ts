import { createTamagui } from 'tamagui'
import { config } from '@tamagui/config/v3'

const tamaguiConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      background: '#f5f5f7',
      backgroundStrong: '#ffffff',
      color: '#111111',
      colorSubtle: '#6b7280',
      primary: '#2563eb',
      danger: '#dc2626',
      success: '#22c55e',
    },
    dark: {
      ...config.themes.dark,
      background: '#0c1222',
      backgroundStrong: 'rgba(255,255,255,0.04)',
      color: '#f1f5f9',
      colorSubtle: '#64748b',
      primary: '#3b82f6',
      danger: '#ef4444',
      success: '#4ade80',
    },
  },
})

export type AppConfig = typeof tamaguiConfig
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
export default tamaguiConfig

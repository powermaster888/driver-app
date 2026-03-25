import { Slot } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TamaguiProvider, Theme } from 'tamagui'
import tamaguiConfig from '../tamagui.config'
import { useSettingsStore } from '../src/store/settings'

const queryClient = new QueryClient()

export default function RootLayout() {
  const theme = useSettingsStore((s) => s.theme)
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <Theme name={theme}>
        <QueryClientProvider client={queryClient}>
          <Slot />
        </QueryClientProvider>
      </Theme>
    </TamaguiProvider>
  )
}

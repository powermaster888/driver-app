import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TamaguiProvider, Theme } from 'tamagui'
import tamaguiConfig from '../tamagui.config'
import { useSettingsStore } from '../src/store/settings'
import { useAuthStore } from '../src/store/auth'
import { startSyncEngine, stopSyncEngine } from '../src/sync/engine'

const queryClient = new QueryClient()

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading, loadToken } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => { loadToken() }, [])

  useEffect(() => {
    if (token) startSyncEngine()
    return () => stopSyncEngine()
  }, [token])

  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === 'login'
    if (!token && !inAuthGroup) {
      router.replace('/login')
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/jobs')
    }
  }, [token, isLoading, segments])

  if (isLoading) return null
  return <>{children}</>
}

export default function RootLayout() {
  const theme = useSettingsStore((s) => s.theme)
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Theme name={theme}>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <Slot />
          </AuthGuard>
        </QueryClientProvider>
      </Theme>
    </TamaguiProvider>
  )
}

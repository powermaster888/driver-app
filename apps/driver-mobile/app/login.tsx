import { useState } from 'react'
import { KeyboardAvoidingView, Platform, View, StyleSheet } from 'react-native'
import { YStack, Text, Input, Button, Spinner, Card } from 'tamagui'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { login } from '../src/api/auth'
import { useAuthStore } from '../src/store/auth'
import { useSettingsStore } from '../src/store/settings'
import { Logo } from '../src/components/Logo'
import { showToast, triggerHaptic } from '../src/utils/feedback'

export default function LoginScreen() {
  const [phone, setPhone] = useState('+852')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const router = useRouter()
  const theme = useSettingsStore((s) => s.theme)
  const gradientColors: [string, string] = theme === 'dark' ? ['#1e40af', '#1e3a8a'] : ['#2563eb', '#1e40af']

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await login(phone, pin)
      await setAuth(result.token, result.driver)
      await triggerHaptic('success')
      showToast(`Welcome, ${result.driver.name}`, 'success')
      router.replace('/(tabs)/jobs')
    } catch (e: any) {
      await triggerHaptic('error')
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {/* Blue gradient top */}
        <LinearGradient colors={gradientColors} style={styles.gradientTop}>
          <YStack alignItems="center" justifyContent="center" flex={1}>
            <View style={styles.logoCard}>
              <Logo height={40} />
            </View>
            <Text fontSize={13} color="rgba(255,255,255,0.7)" marginTop="$3">Driver Portal</Text>
          </YStack>
        </LinearGradient>

        {/* White form card */}
        <View style={styles.formContainer}>
          <YStack gap="$4" padding="$5">
            <YStack gap="$1">
              <Text fontSize={11} fontWeight="600" color="#94a3b8" textTransform="uppercase" letterSpacing={1}>Phone Number</Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                size="$5"
                borderRadius={12}
                borderWidth={2}
                borderColor="#e2e8f0"
                backgroundColor="#fafafa"
                fontSize={16}
              />
            </YStack>
            <YStack gap="$1">
              <Text fontSize={11} fontWeight="600" color="#94a3b8" textTransform="uppercase" letterSpacing={1}>PIN Code</Text>
              <Input
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                size="$5"
                borderRadius={12}
                borderWidth={2}
                borderColor="#e2e8f0"
                backgroundColor="#fafafa"
                fontSize={16}
                placeholder="••••"
              />
            </YStack>

            {error ? <Text color="#dc2626" textAlign="center" fontSize={13}>{error}</Text> : null}

            <Button
              size="$5"
              backgroundColor="#2563eb"
              color="white"
              fontWeight="700"
              borderRadius={14}
              onPress={handleLogin}
              disabled={loading || !phone || !pin}
              pressStyle={{ opacity: 0.8 }}
              minHeight={56}
            >
              {loading ? <Spinner color="white" /> : 'Sign In'}
            </Button>
          </YStack>
          <Text fontSize={11} color="#cbd5e1" textAlign="center" marginTop="$2" marginBottom="$4">
            Healthy Living Medical Supplies Ltd
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradientTop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 8,
  },
  formContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -28,
    paddingTop: 8,
  },
})

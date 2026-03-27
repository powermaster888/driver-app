import { useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { YStack, XStack, Text, Input, Button, Spinner } from 'tamagui'
import { useRouter } from 'expo-router'
import { login } from '../src/api/auth'
import { Logo } from '../src/components/Logo'
import { useAuthStore } from '../src/store/auth'
import { showToast, triggerHaptic } from '../src/utils/feedback'

export default function LoginScreen() {
  const [phone, setPhone] = useState('+852')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const router = useRouter()

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
      <YStack flex={1} justifyContent="center" padding="$6" backgroundColor="$background" gap="$4">
        <YStack alignItems="center" marginBottom="$4">
          <Logo height={60} />
        </YStack>
        <Text fontSize={14} color="$colorSubtle" textAlign="center" marginBottom="$4" opacity={0.7}>Driver Login</Text>

        <Input
          placeholder="Phone (+852...)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          size="$5"
          borderRadius={14}
        />
        <Input
          placeholder="PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          size="$5"
          borderRadius={14}
        />

        {error ? <Text color="$danger" textAlign="center" fontSize={13}>{error}</Text> : null}

        <Button
          size="$5"
          backgroundColor="$primary"
          borderRadius={14}
          onPress={handleLogin}
          disabled={loading || !phone || !pin}
          pressStyle={{ opacity: 0.8 }}
          minHeight={56}
        >
          {loading ? <Spinner color="white" /> : <Text color="white" fontWeight="700" fontSize={16}>Login</Text>}
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  )
}

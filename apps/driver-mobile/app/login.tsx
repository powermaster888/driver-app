import { useState } from 'react'
import { KeyboardAvoidingView, Platform, View, StyleSheet } from 'react-native'
import { YStack, Text, Input, Button, Spinner } from 'tamagui'
import { useRouter } from 'expo-router'
import { login } from '../src/api/auth'
import { useAuthStore } from '../src/store/auth'
import { Logo } from '../src/components/Logo'
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
      <View style={styles.container}>
        {/* Logo area */}
        <YStack alignItems="center" justifyContent="center" flex={1} paddingTop={80}>
          <Logo height={40} />
          <Text fontSize={13} color={"#8A8F98" as any} marginTop="$3">Driver Portal</Text>
        </YStack>

        {/* Form card */}
        <View style={styles.formCard}>
          <YStack gap="$4" padding="$5">
            <YStack gap="$1">
              <Text fontSize={11} fontWeight="600" color="#8A8F98" textTransform="uppercase" letterSpacing={1}>Phone Number</Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                size="$5"
                borderRadius={10}
                borderWidth={1}
                borderColor="rgba(255,255,255,0.08)"
                backgroundColor="rgba(255,255,255,0.05)"
                color="#F7F8F8"
                fontSize={16}
              />
            </YStack>
            <YStack gap="$1">
              <Text fontSize={11} fontWeight="600" color="#8A8F98" textTransform="uppercase" letterSpacing={1}>PIN Code</Text>
              <Input
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                size="$5"
                borderRadius={10}
                borderWidth={1}
                borderColor="rgba(255,255,255,0.08)"
                backgroundColor="rgba(255,255,255,0.05)"
                color="#F7F8F8"
                fontSize={16}
                placeholder="••••"
                placeholderTextColor={"#8A8F98" as any}
              />
            </YStack>

            {error ? <Text color="#EF4444" textAlign="center" fontSize={13}>{error}</Text> : null}

            <Button
              size="$5"
              backgroundColor="#2563EB"
              borderRadius={10}
              onPress={handleLogin}
              disabled={loading || !phone || !pin}
              pressStyle={{ opacity: 0.8 }}
              minHeight={52}
            >
              {loading ? <Spinner color="white" /> : <Text color="white" fontWeight="700" fontSize={16}>Sign In</Text>}
            </Button>
          </YStack>
          <Text fontSize={11} color="#62666D" textAlign="center" marginTop="$2" marginBottom="$4">
            Healthy Living Medical Supplies Ltd
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  formCard: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: -28,
    paddingTop: 8,
  },
})

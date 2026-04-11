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
      setError(e.message || '登入失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$6">
          {/* Card */}
          <YStack width="100%" maxWidth={380} gap="$5">
            {/* Logo + Title */}
            <YStack alignItems="center" gap="$3" marginBottom="$4">
              <Logo height={36} />
              <Text fontSize={22} fontWeight="700" color="#EDEDEF" letterSpacing={-0.5}>
                Healthy Living Driver
              </Text>
              <Text fontSize={13} color="#5C5E66">
                盈康醫療用品 司機端
              </Text>
            </YStack>

            {/* Form */}
            <YStack gap="$4">
              <YStack gap="$2">
                <Text fontSize={13} fontWeight="500" color="#8B8D94">手機號碼</Text>
                <Input
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  size="$5"
                  borderRadius={8}
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.08)"
                  backgroundColor="#111111"
                  color="#EDEDEF"
                  fontSize={16}
                />
              </YStack>
              <YStack gap="$2">
                <Text fontSize={13} fontWeight="500" color="#8B8D94">密碼</Text>
                <Input
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  size="$5"
                  borderRadius={8}
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.08)"
                  backgroundColor="#111111"
                  color="#EDEDEF"
                  fontSize={16}
                  placeholder="••••••"
                  placeholderTextColor={"#5C5E66" as any}
                />
              </YStack>

              {error ? <Text color="#EF4444" textAlign="center" fontSize={13}>{error}</Text> : null}

              <Button
                size="$5"
                backgroundColor="#2563EB"
                borderRadius={9999}
                onPress={handleLogin}
                disabled={loading || !phone || !pin}
                pressStyle={{ opacity: 0.85 }}
                minHeight={52}
              >
                {loading ? <Spinner color="white" /> : <Text color="white" fontWeight="700" fontSize={16}>Sign In</Text>}
              </Button>
            </YStack>

            {/* Footer */}
            <Text fontSize={11} color="#5C5E66" textAlign="center" marginTop="$2">
              Healthy Living Medical Supplies Ltd
            </Text>
          </YStack>
        </YStack>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
})

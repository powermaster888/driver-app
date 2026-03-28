import React, { Component } from 'react'
import { View, StyleSheet } from 'react-native'
import { Text, Button, YStack } from 'tamagui'
import { AlertTriangle, RefreshCw } from 'lucide-react-native'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <YStack alignItems="center" gap="$4" padding="$6" maxWidth={320}>
            <YStack
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor="#fef3c7"
              alignItems="center"
              justifyContent="center"
              borderWidth={1}
              borderColor="#fde68a"
            >
              <AlertTriangle size={36} color="#f59e0b" />
            </YStack>
            <YStack alignItems="center" gap="$2">
              <Text fontSize={18} fontWeight="700">Something went wrong</Text>
              <Text fontSize={13} color="$colorSubtle" textAlign="center">
                The app encountered an unexpected error. Your data is safe.
              </Text>
              {__DEV__ && this.state.error && (
                <Text fontSize={11} color="$colorSubtle" textAlign="center" marginTop="$2" opacity={0.7}>
                  {this.state.error.message}
                </Text>
              )}
            </YStack>
            <YStack gap="$2" width="100%">
              <Button
                size="$4"
                backgroundColor="$primary"
                borderRadius={14}
                onPress={this.handleRetry}
                icon={<RefreshCw size={18} color="white" />}
                pressStyle={{ opacity: 0.7 }}
              >
                <Text color="white" fontWeight="700">Try Again</Text>
              </Button>
            </YStack>
          </YStack>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
})

export function ErrorBoundary({ children }: Props) {
  return <ErrorBoundaryInner>{children}</ErrorBoundaryInner>
}

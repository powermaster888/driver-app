import { ScrollView, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner } from 'tamagui'
import { useJob } from '../../../src/api/jobs'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { stripHtml } from '../../../src/utils/html'
import type { DeliveryStatus } from '../../../src/theme/status-colors'

export default function HistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: job, isLoading } = useJob(Number(id))

  if (isLoading || !job) {
    return <YStack flex={1} justifyContent="center" alignItems="center"><Spinner /></YStack>
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: job.odoo_reference }} />
      <ScrollView>
        <YStack padding="$4" gap="$3">
          <XStack justifyContent="space-between" alignItems="flex-start">
            <YStack flex={1}>
              <Text fontSize={24} fontWeight="800" color="$color" letterSpacing={-0.5}>{job.customer_name}</Text>
              <Text fontSize={14} fontWeight="400" color="$colorSubtle" marginTop={4}>{job.odoo_reference} · {job.warehouse}</Text>
            </YStack>
            <StatusBadge status={job.status as DeliveryStatus} />
          </XStack>
          <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
            <YStack gap="$3">
              {job.address && (
                <YStack>
                  <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>Address</Text>
                  <Text fontSize={14} fontWeight="400" color="$color" marginTop={4}>{job.address}</Text>
                </YStack>
              )}
              {job.delivery_notes && (
                <YStack>
                  <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>Notes</Text>
                  <Text fontSize={14} fontWeight="400" color="$color" marginTop={4}>{stripHtml(job.delivery_notes)}</Text>
                </YStack>
              )}
            </YStack>
          </Card>
          {job.items.length > 0 && (
            <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
              <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>Items ({job.items.length})</Text>
              <YStack marginTop="$2" gap="$1">
                {job.items.map((item, i) => <Text key={i} fontSize={14} color="$color">{item.product_name} × {item.quantity}</Text>)}
              </YStack>
            </Card>
          )}
          {job.proof_of_delivery?.photos?.length > 0 && (
            <Card padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
              <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1} marginBottom="$2">Proof of Delivery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <XStack gap="$2">
                  {job.proof_of_delivery.photos.map((uri: string, i: number) => (
                    <Image key={i} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10 }} />
                  ))}
                </XStack>
              </ScrollView>
            </Card>
          )}
        </YStack>
      </ScrollView>
    </YStack>
    </SafeAreaView>
  )
}

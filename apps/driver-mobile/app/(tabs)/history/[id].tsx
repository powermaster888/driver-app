import { ScrollView, Image, Pressable, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Spinner, useTheme } from 'tamagui'
import { ArrowLeft, MapPin, Camera, PenTool, Banknote } from 'lucide-react-native'
import { useJob } from '../../../src/api/jobs'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { stripHtml } from '../../../src/utils/html'
import type { DeliveryStatus } from '../../../src/theme/status-colors'

export default function HistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data: job, isLoading } = useJob(Number(id))
  const theme = useTheme()

  if (isLoading || !job) {
    return <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center"><Spinner color="$primary" /></YStack>
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background?.val }} edges={['bottom']}>
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        {/* Header */}
        <YStack paddingHorizontal={20} paddingTop={16} paddingBottom={20}>
          <XStack justifyContent="space-between" alignItems="center" marginBottom={16}>
            <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -4 }}>
              <ArrowLeft size={16} color={theme.colorSubtle?.val} />
              <Text fontSize={14} color="$colorSubtle" fontWeight="500">返回</Text>
            </Pressable>
            <XStack alignItems="center" gap={8}>
              <StatusBadge status={job.status as DeliveryStatus} />
              <Text fontSize={11} color="$muted">{job.odoo_reference}</Text>
            </XStack>
          </XStack>
          <Text fontSize={24} fontWeight="800" color="$color" letterSpacing={-0.5}>{job.customer_name}</Text>
          {job.address && (
            <XStack alignItems="center" gap={4} marginTop={8}>
              <MapPin size={14} color={theme.colorSubtle?.val} />
              <Text fontSize={14} fontWeight="400" color="$colorSubtle">{job.address}</Text>
            </XStack>
          )}
          <Text fontSize={13} fontWeight="400" color="$muted" marginTop={4}>{job.warehouse}</Text>
        </YStack>

        <YStack paddingHorizontal={16} gap={12}>
          {/* Delivery notes */}
          {job.delivery_notes && (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: 14 }}>
              <Text fontSize={11} color="$warning" fontWeight="600">送貨備註</Text>
              <Text fontSize={14} color="#FBBF24" marginTop={4}>{stripHtml(job.delivery_notes)}</Text>
            </View>
          )}

          {/* Items */}
          {job.items.length > 0 && (
            <View style={{ backgroundColor: theme.backgroundStrong?.val, borderRadius: 12, padding: 16 }}>
              <Text fontSize={12} color="$muted" fontWeight="600" textTransform="uppercase" letterSpacing={0.5} marginBottom={8}>
                物品 ({job.items.length})
              </Text>
              <YStack gap={4}>
                {job.items.map((item, i) => (
                  <XStack key={i} justifyContent="space-between" alignItems="center" paddingVertical={4}>
                    <Text fontSize={14} fontWeight="400" color="$color" flex={1} numberOfLines={1}>{item.product_name}</Text>
                    <View style={{ backgroundColor: theme.borderColor?.val, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text fontSize={13} fontWeight="600" color="$color">{'\u00d7'}{item.quantity}</Text>
                    </View>
                  </XStack>
                ))}
              </YStack>
            </View>
          )}

          {/* POD Photos */}
          {job.proof_of_delivery?.photos?.length > 0 && (
            <View style={{ backgroundColor: theme.backgroundStrong?.val, borderRadius: 12, padding: 16 }}>
              <XStack alignItems="center" gap={8} marginBottom={12}>
                <Camera size={14} color={theme.muted?.val} />
                <Text fontSize={12} color="$muted" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  送貨照片 ({job.proof_of_delivery.photos.length})
                </Text>
              </XStack>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <XStack gap={8}>
                  {job.proof_of_delivery.photos.map((uri: string, i: number) => (
                    <Image key={i} source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                  ))}
                </XStack>
              </ScrollView>
            </View>
          )}

          {/* Signature */}
          {job.proof_of_delivery?.signature && (
            <View style={{ backgroundColor: theme.backgroundStrong?.val, borderRadius: 12, padding: 16 }}>
              <XStack alignItems="center" gap={8} marginBottom={12}>
                <PenTool size={14} color={theme.muted?.val} />
                <Text fontSize={12} color="$muted" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>簽名</Text>
              </XStack>
              <Image source={{ uri: job.proof_of_delivery.signature }} style={{ width: 160, height: 80, borderRadius: 8, backgroundColor: '#fff' }} resizeMode="contain" />
            </View>
          )}

          {/* Cash collection */}
          {job.collection_required && (
            <View style={{ backgroundColor: theme.backgroundStrong?.val, borderRadius: 12, padding: 16 }}>
              <XStack alignItems="center" gap={8} marginBottom={8}>
                <Banknote size={14} color={theme.muted?.val} />
                <Text fontSize={12} color="$muted" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>代收款項</Text>
              </XStack>
              <XStack alignItems="baseline" gap={8}>
                <Text fontSize={24} fontWeight="800" color="$danger" letterSpacing={-0.5}>${job.expected_collection_amount?.toLocaleString()}</Text>
                <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                  <Text fontSize={11} fontWeight="700" color="$danger">{job.collection_method === 'cheque' ? '支票' : '現金'}</Text>
                </View>
              </XStack>
            </View>
          )}

          <YStack height={100} />
        </YStack>
      </ScrollView>
    </YStack>
    </SafeAreaView>
  )
}

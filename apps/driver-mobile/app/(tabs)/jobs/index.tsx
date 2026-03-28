import { FlatList, RefreshControl, Pressable, View, Linking } from 'react-native'
import { YStack, XStack, Text, Card } from 'tamagui'
import { LinearGradient } from 'expo-linear-gradient'
import { Package } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { JobCardSkeleton } from '../../../src/components/JobCardSkeleton'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useNetInfo } from '@react-native-community/netinfo'
import { useAuthStore } from '../../../src/store/auth'

function ProgressRing({ value, color, label }: { value: number; color: string; label: string }) {
  const ringBg = color + '20' // 12% opacity version of the color
  return (
    <YStack alignItems="center">
      <View style={{
        width: 60, height: 60, borderRadius: 30,
        borderWidth: 4, borderColor: ringBg,
        borderTopColor: value > 0 ? color : ringBg,
        borderRightColor: value > 0 ? color : ringBg,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text fontSize={20} fontWeight="800" color={value > 0 ? color : '$colorSubtle'}>{value}</Text>
      </View>
      <Text fontSize={11} color="$colorSubtle" marginTop="$2">{label}</Text>
    </YStack>
  )
}

export default function JobsList() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useJobs('pending')
  const netInfo = useNetInfo()
  const router = useRouter()
  const driver = useAuthStore((s) => s.driver)
  const jobs = data?.jobs || []

  const remaining = jobs.filter((j) => !['delivered', 'failed', 'returned'].includes(j.status)).length
  const cashCount = jobs.filter((j) => j.collection_required && !['delivered', 'failed', 'returned'].includes(j.status)).length
  const doneCount = jobs.filter((j) => j.status === 'delivered').length

  const activeJob = jobs.find((j) => ['on_the_way', 'arrived'].includes(j.status))
  const upcomingJobs = jobs.filter((j) => ['assigned', 'accepted'].includes(j.status))
  const otherInProgress = jobs.filter((j) => ['on_the_way', 'arrived'].includes(j.status) && (!activeJob || j.job_id !== activeJob.job_id))
  const listJobs = [...otherInProgress, ...upcomingJobs]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const handleWhatsApp = () => {
    if (!activeJob?.phone) return
    const clean = activeJob.phone.replace(/[\s\-()]/g, '').replace(/^\+/, '')
    Linking.openURL(`https://wa.me/${clean}`)
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {netInfo.isConnected === false && <OfflineBanner />}
      {isError && (
        <YStack padding="$4" backgroundColor="#fef2f2" margin="$3" borderRadius={12}>
          <Text fontSize={13} fontWeight="600" color="#dc2626">Failed to load jobs</Text>
          <Text fontSize={12} color="#6b7280" marginTop="$1">{error?.message || 'Please pull down to retry'}</Text>
        </YStack>
      )}
      <FlatList
        data={listJobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={
          <YStack>
            {/* Greeting header */}
            <XStack padding="$4" paddingBottom="$2" justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize={13} color="$colorSubtle">{greeting}</Text>
                <XStack alignItems="baseline" gap="$2" marginTop="$1">
                  <Text fontSize={22} fontWeight="800">{driver?.name || 'Driver'}</Text>
                  <Text fontSize={14} color="$colorSubtle">· {jobs.length} jobs today</Text>
                </XStack>
              </YStack>
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
              }}>
                <Text fontSize={18} fontWeight="800" color="white">{driver?.name?.charAt(0) || '?'}</Text>
              </View>
            </XStack>

            {/* Progress rings in white card */}
            <Card margin="$3" marginTop="$1" padding="$4" borderRadius={16} bordered backgroundColor="white" shadowColor="#000" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.06} shadowRadius={12} elevation={2}>
              <XStack justifyContent="space-around">
                <ProgressRing value={remaining} color="#2563eb" label="Remaining" />
                <ProgressRing value={cashCount} color="#dc2626" label="Cash" />
                <ProgressRing value={doneCount} color="#22c55e" label="Done" />
              </XStack>
            </Card>

            {/* Active job hero card */}
            {activeJob && (
              <Pressable onPress={() => router.push(`/(tabs)/jobs/${activeJob.job_id}`)}>
                <LinearGradient
                  colors={activeJob.status === 'arrived' ? ['#7c3aed', '#6d28d9'] : ['#2563eb', '#1d4ed8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ marginHorizontal: 12, marginBottom: 12, borderRadius: 16, padding: 18 }}
                >
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={10} color="rgba(255,255,255,0.8)" fontWeight="700" textTransform="uppercase" letterSpacing={1}>Now Active</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
                      <Text fontSize={10} color="white" fontWeight="700">{activeJob.status.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                  </XStack>
                  <Text fontSize={18} fontWeight="700" color="white" marginTop="$2">{activeJob.customer_name}</Text>
                  <Text fontSize={12} color="rgba(255,255,255,0.7)" marginTop="$1">
                    {activeJob.odoo_reference} · {activeJob.address || activeJob.warehouse}
                  </Text>
                  {/* Inline action buttons */}
                  <XStack gap="$2" marginTop="$3">
                    <Pressable
                      onPress={() => router.push(`/jobs/${activeJob.job_id}/complete`)}
                      style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    >
                      <Text fontSize={14} fontWeight="600" color="white">Complete</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleWhatsApp}
                      style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    >
                      <Text fontSize={14} fontWeight="600" color="white">WhatsApp</Text>
                    </Pressable>
                  </XStack>
                </LinearGradient>
              </Pressable>
            )}

            {/* Upcoming section header */}
            {listJobs.length > 0 && (
              <XStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$2">
                <Text fontSize={12} fontWeight="700" color="$colorSubtle" textTransform="uppercase" letterSpacing={0.5}>
                  Upcoming ({listJobs.length})
                </Text>
              </XStack>
            )}
          </YStack>
        }
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$3">
            <JobCard job={item} />
          </YStack>
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          isLoading ? (
            <YStack paddingHorizontal="$3" paddingTop="$2">
              <JobCardSkeleton />
              <JobCardSkeleton />
              <JobCardSkeleton />
              <JobCardSkeleton />
            </YStack>
          ) : (
            <YStack padding="$6" alignItems="center" gap="$3">
              <YStack width={80} height={80} borderRadius={40} backgroundColor="$backgroundStrong" alignItems="center" justifyContent="center" borderWidth={1} borderColor="$borderColor">
                <Package size={36} color="#94a3b8" />
              </YStack>
              <Text fontSize={16} fontWeight="700" color="$color">All Clear!</Text>
              <Text color="$colorSubtle" textAlign="center" fontSize={13}>No pending deliveries. Pull down to refresh.</Text>
            </YStack>
          )
        }
      />
    </YStack>
  )
}

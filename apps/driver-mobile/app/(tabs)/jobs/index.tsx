import { useState } from 'react'
import { FlatList, RefreshControl, Pressable, View, Linking, TextInput, ActivityIndicator } from 'react-native'
import { YStack, XStack, Text, Card } from 'tamagui'
import { LinearGradient } from 'expo-linear-gradient'
import { Package, Search, X, CalendarClock, MapPin } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { SummaryBar } from '../../../src/components/SummaryBar'
import { JobCardSkeleton } from '../../../src/components/JobCardSkeleton'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useNetInfo } from '@react-native-community/netinfo'
import { useAuthStore } from '../../../src/store/auth'
import { useSettingsStore } from '../../../src/store/settings'
import { useLocationSort } from '../../../src/hooks/useLocationSort'
import { formatDistance } from '../../../src/utils/geo'

export default function JobsList() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useJobs('pending')
  const { data: upcomingData } = useJobs('upcoming')
  const futureJobs = upcomingData?.jobs || []
  const netInfo = useNetInfo()
  const router = useRouter()
  const driver = useAuthStore((s) => s.driver)
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortByDistance, setSortByDistance] = useState(false)
  const jobs = data?.jobs || []

  const activeJob = jobs.find((j) => ['on_the_way', 'arrived'].includes(j.status))
  const upcomingJobs = jobs.filter((j) => ['assigned', 'accepted'].includes(j.status))
  const otherInProgress = jobs.filter((j) => ['on_the_way', 'arrived'].includes(j.status) && (!activeJob || j.job_id !== activeJob.job_id))
  const rawListJobs = [...otherInProgress, ...upcomingJobs]

  // Proximity sort
  const { sortedJobs, hasLocation } = useLocationSort(rawListJobs)
  const listJobs = sortByDistance && hasLocation ? sortedJobs : rawListJobs

  const filteredListJobs = searchQuery.length > 0
    ? listJobs.filter((j) => {
        const q = searchQuery.toLowerCase()
        return (
          j.customer_name.toLowerCase().includes(q) ||
          j.odoo_reference.toLowerCase().includes(q) ||
          (j.address || '').toLowerCase().includes(q) ||
          (j.sales_order_ref || '').toLowerCase().includes(q)
        )
      })
    : listJobs

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
        <YStack padding="$4" backgroundColor={isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2'} margin="$3" borderRadius={12}>
          <Text fontSize={13} fontWeight="600" color="$danger">Failed to load jobs</Text>
          <Text fontSize={12} color="$colorSubtle" marginTop="$1">{error?.message || 'Please pull down to retry'}</Text>
        </YStack>
      )}
      <FlatList
        data={filteredListJobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={
          <YStack>
            {/* Greeting header */}
            <XStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2" justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize={14} color="$colorSubtle" fontWeight="400">{greeting}</Text>
                <XStack alignItems="baseline" gap="$2" marginTop={4}>
                  <Text fontSize={24} fontWeight="800" color="$color" letterSpacing={-0.5}>{driver?.name || 'Driver'}</Text>
                  <Text fontSize={13} color="#62666D" fontWeight="400">· {jobs.length} jobs today</Text>
                </XStack>
              </YStack>
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: isDark ? '#3B82F6' : '#2563EB', justifyContent: 'center', alignItems: 'center',
              }}>
                <Text fontSize={18} fontWeight="800" color="white">{driver?.name?.charAt(0) || '?'}</Text>
              </View>
            </XStack>

            {/* Search bar + sort toggle */}
            <XStack paddingHorizontal="$4" paddingBottom="$2" gap="$2">
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                borderRadius: 12, paddingHorizontal: 12, height: 44,
              }}>
                <Search size={18} color="#8A8F98" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search name, DO#, address..."
                  placeholderTextColor="#8A8F98"
                  style={{ flex: 1, marginLeft: 8, fontSize: 14, color: isDark ? '#F5F5F5' : '#0F172A' }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <X size={16} color="#8A8F98" />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => setSortByDistance((v) => !v)}
                accessibilityLabel={sortByDistance ? 'Sort by schedule' : 'Sort by distance'}
                accessibilityRole="button"
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: sortByDistance ? (isDark ? '#3B82F6' : '#2563EB') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <MapPin size={20} color={sortByDistance ? '#fff' : '#8A8F98'} />
              </Pressable>
            </XStack>

            {/* Only show summary, hero, section header when NOT searching */}
            {searchQuery.length === 0 && (
              <>
                {/* Summary bar — bold numbers */}
                {isLoading ? (
                  <XStack padding="$3" justifyContent="center">
                    <ActivityIndicator size="small" color={isDark ? '#3B82F6' : '#2563EB'} />
                  </XStack>
                ) : (
                  <SummaryBar jobs={jobs} />
                )}

                {/* Active job hero card */}
                {activeJob && (
                  <Pressable onPress={() => router.push(`/(tabs)/jobs/${activeJob.job_id}`)}>
                    <LinearGradient
                      colors={activeJob.status === 'arrived' ? ['#7c3aed', '#6d28d9'] : ['#2563eb', '#1d4ed8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        marginHorizontal: 16, marginBottom: 8, borderRadius: 16, padding: 18,
                        shadowColor: activeJob.status === 'arrived' ? '#7c3aed' : '#2563eb',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.15,
                        shadowRadius: 16,
                        elevation: 8,
                      }}
                    >
                      <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={10} color="rgba(255,255,255,0.8)" fontWeight="800" textTransform="uppercase" letterSpacing={1}>Now Active</Text>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 }}>
                          <Text fontSize={10} color="white" fontWeight="700">{activeJob.status.replace('_', ' ').toUpperCase()}</Text>
                        </View>
                      </XStack>
                      <Text fontSize={17} fontWeight="700" color="white" marginTop="$2">{activeJob.customer_name}</Text>
                      <Text fontSize={14} fontWeight="400" color="rgba(255,255,255,0.7)" marginTop={4}>
                        {activeJob.odoo_reference} · {activeJob.address || activeJob.warehouse}
                      </Text>
                      {/* Inline action buttons */}
                      <XStack gap="$2" marginTop="$3">
                        <Pressable
                          onPress={() => router.push(`/jobs/${activeJob.job_id}/complete`)}
                          style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 9999, paddingVertical: 12, alignItems: 'center' }}
                        >
                          <Text fontSize={14} fontWeight="600" color="white">Complete</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleWhatsApp}
                          style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 9999, paddingVertical: 12, alignItems: 'center' }}
                        >
                          <Text fontSize={14} fontWeight="600" color="white">WhatsApp</Text>
                        </Pressable>
                      </XStack>
                    </LinearGradient>
                  </Pressable>
                )}
              </>
            )}

            {/* Section header or loading skeletons */}
            {isLoading ? (
              <YStack paddingHorizontal="$4" paddingTop="$4">
                <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1} marginBottom="$2">Loading jobs...</Text>
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </YStack>
            ) : filteredListJobs.length > 0 ? (
              <XStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2">
                {searchQuery.length > 0 ? (
                  <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>
                    Results ({filteredListJobs.length})
                  </Text>
                ) : (
                  <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>
                    Upcoming ({listJobs.length})
                  </Text>
                )}
              </XStack>
            ) : null}
          </YStack>
        }
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$4">
            <JobCard job={item} distanceKm={sortByDistance && 'distanceKm' in item ? (item as any).distanceKm : undefined} />
          </YStack>
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListFooterComponent={
          futureJobs.length > 0 ? (
            <YStack paddingHorizontal="$4" paddingTop="$4" paddingBottom={100}>
              <XStack alignItems="center" gap="$2" marginBottom="$2">
                <CalendarClock size={14} color="#62666D" />
                <Text fontSize={13} fontWeight="600" color="#62666D" textTransform="uppercase" letterSpacing={1}>
                  Coming Up ({futureJobs.length})
                </Text>
              </XStack>
              {futureJobs.slice(0, 5).map((j) => (
                <XStack key={j.job_id} padding="$3" backgroundColor="$backgroundStrong" borderRadius={12} borderWidth={1} borderColor="$borderColor" marginBottom={6} alignItems="center" gap="$3" opacity={0.7}>
                  <YStack width={3} height={32} borderRadius={2} backgroundColor="$colorSubtle" />
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color="$color">{j.customer_name}</Text>
                    <Text fontSize={12} color="$colorSubtle">{j.odoo_reference} · {j.warehouse} · {new Date(j.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  </YStack>
                </XStack>
              ))}
              {futureJobs.length > 5 && (
                <Text fontSize={12} color="$colorSubtle" textAlign="center" marginTop="$1">+{futureJobs.length - 5} more</Text>
              )}
            </YStack>
          ) : (
            <YStack height={100} />
          )
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
                <Package size={36} color="#8A8F98" />
              </YStack>
              <Text fontSize={17} fontWeight="700" color="$color">All Clear!</Text>
              <Text color="$colorSubtle" textAlign="center" fontSize={14}>No pending deliveries. Pull down to refresh.</Text>
            </YStack>
          )
        }
      />
    </YStack>
  )
}

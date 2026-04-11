import { useState, useMemo } from 'react'
import { FlatList, TextInput, Pressable, View } from 'react-native'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { Search, X, Calendar as CalendarIcon } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { Calendar } from '../../../src/components/Calendar'
import type { JobSummary } from '../../../src/api/jobs'

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function HistoryView() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()
  const theme = useTheme()

  const { data: pendingData } = useJobs('pending')
  const { data: allData } = useJobs('all')

  const allJobs = useMemo(() => {
    const pending = pendingData?.jobs || []
    const completed = allData?.jobs || []
    const map = new Map<number, JobSummary>()
    for (const j of [...pending, ...completed]) {
      map.set(j.job_id, j)
    }
    return Array.from(map.values())
  }, [pendingData, allData])

  const jobDates = useMemo(() => {
    const dates: Record<string, { count: number; hasDelivered: boolean; hasFailed: boolean; hasInProgress: boolean }> = {}
    for (const job of allJobs) {
      const date = job.scheduled_date.split('T')[0]
      if (!dates[date]) {
        dates[date] = { count: 0, hasDelivered: false, hasFailed: false, hasInProgress: false }
      }
      dates[date].count++
      if (job.status === 'delivered') dates[date].hasDelivered = true
      if (job.status === 'failed' || job.status === 'returned') dates[date].hasFailed = true
      if (['on_the_way', 'arrived', 'accepted'].includes(job.status)) dates[date].hasInProgress = true
    }
    return dates
  }, [allJobs])

  const filteredJobs = useMemo(() => {
    let jobs = allJobs.filter((j) => j.scheduled_date.startsWith(selectedDate))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      jobs = jobs.filter((j) =>
        j.customer_name.toLowerCase().includes(q) ||
        j.odoo_reference.toLowerCase().includes(q) ||
        (j.address && j.address.toLowerCase().includes(q)) ||
        (j.sales_order_ref && j.sales_order_ref.toLowerCase().includes(q))
      )
    }
    return jobs
  }, [allJobs, selectedDate, searchQuery])

  const selectedDateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-HK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={
          <YStack>
            {/* Header */}
            <XStack paddingHorizontal={16} paddingTop={16} paddingBottom={8} alignItems="center" gap={8}>
              <CalendarIcon size={20} color={theme.primary?.val} />
              <Text fontSize={24} fontWeight="800" color="$color" letterSpacing={-0.5}>歷史記錄</Text>
            </XStack>

            {/* Calendar */}
            <View style={{ marginHorizontal: 16, backgroundColor: theme.backgroundStrong?.val, borderRadius: 12, marginBottom: 8 }}>
              <Calendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                jobDates={jobDates}
              />
            </View>

            {/* Search */}
            <View style={{
              marginHorizontal: 16, marginBottom: 8,
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: theme.backgroundStrong?.val, borderRadius: 8,
              paddingHorizontal: 12, height: 44,
            }}>
              <Search size={18} color={theme.muted?.val} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="搜尋歷史記錄..."
                placeholderTextColor={theme.muted?.val}
                style={{ flex: 1, marginLeft: 8, fontSize: 14, color: theme.color?.val }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <X size={16} color={theme.muted?.val} />
                </Pressable>
              )}
            </View>

            {/* Date label */}
            <XStack paddingHorizontal={16} paddingTop={8} paddingBottom={8} alignItems="center" gap={4}>
              <Text fontSize={12} fontWeight="600" color="$muted" textTransform="uppercase" letterSpacing={0.5}>
                {selectedDateLabel}
              </Text>
              {filteredJobs.length > 0 && (
                <Text fontSize={12} color="$muted"> · {filteredJobs.length} 單</Text>
              )}
            </XStack>
          </YStack>
        }
        renderItem={({ item }) => (
          <YStack paddingHorizontal={16}>
            <JobCard job={item} />
          </YStack>
        )}
        ListEmptyComponent={
          <YStack padding={32} alignItems="center" gap={12}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.backgroundStrong?.val, justifyContent: 'center', alignItems: 'center' }}>
              <CalendarIcon size={28} color={theme.muted?.val} />
            </View>
            <Text color="$colorSubtle" textAlign="center" fontSize={14}>
              {selectedDateLabel} 沒有送貨記錄
            </Text>
          </YStack>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </YStack>
  )
}

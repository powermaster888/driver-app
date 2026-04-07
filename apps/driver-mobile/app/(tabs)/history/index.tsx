import { useState, useMemo } from 'react'
import { FlatList, TextInput } from 'react-native'
import { YStack, XStack, Text, Card } from 'tamagui'
import { Search } from 'lucide-react-native'
import { useSettingsStore } from '../../../src/store/settings'
import { Calendar as CalendarIcon } from 'lucide-react-native'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { Calendar } from '../../../src/components/Calendar'
import type { JobSummary } from '../../../src/api/jobs'

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function CalendarView() {
  const today = formatDate(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [searchQuery, setSearchQuery] = useState('')
  const theme = useSettingsStore((s) => s.theme)

  // Fetch pending and all completed jobs (unlimited history)
  const { data: pendingData } = useJobs('pending')
  const { data: allData } = useJobs('all')

  const allJobs = useMemo(() => {
    const pending = pendingData?.jobs || []
    const completed = allData?.jobs || []
    // Deduplicate by job_id
    const map = new Map<number, JobSummary>()
    for (const j of [...pending, ...completed]) {
      map.set(j.job_id, j)
    }
    return Array.from(map.values())
  }, [pendingData, allData])

  // Build jobDates map for calendar dots
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

  // Filter jobs for selected date and search query
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

  const selectedDateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2" alignItems="center" gap="$2">
        <CalendarIcon size={20} color="$primary" />
        <Text fontSize={20} fontWeight="800" color="$color">Calendar</Text>
      </XStack>
      <Card marginHorizontal="$4" marginTop={4} borderWidth={1} borderColor="$borderColor" borderRadius={16}>
        <Calendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          jobDates={jobDates}
        />
      </Card>

      {/* Search */}
      <XStack marginHorizontal="$4" marginTop="$3" alignItems="center" gap="$2" backgroundColor={theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#F1F5F9'} borderRadius={12} paddingHorizontal="$3" paddingVertical="$2">
        <Search size={16} color="$colorSubtle" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search customer, reference, address..."
          placeholderTextColor={theme === 'dark' ? '#8A8F98' : '#64748B'}
          style={{ flex: 1, fontSize: 14, color: theme === 'dark' ? '#F7F8F8' : '#0F172A', padding: 0 }}
        />
      </XStack>

      {/* Selected date header */}
      <XStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2" alignItems="center" gap="$2">
        <CalendarIcon size={14} color="$colorSubtle" />
        <Text fontSize={13} fontWeight="600" color="$colorSubtle">
          {selectedDateLabel}
        </Text>
        {filteredJobs.length > 0 && (
          <Text fontSize={13} color="$colorSubtle">
            · {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
          </Text>
        )}
      </XStack>

      {/* Job list for selected date */}
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => String(item.job_id)}
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$4">
            <JobCard job={item} />
          </YStack>
        )}
        ListEmptyComponent={
          <YStack padding="$6" alignItems="center" gap="$2">
            <CalendarIcon size={36} color="$colorSubtle" />
            <Text color="$colorSubtle" textAlign="center" fontSize={13}>
              No deliveries on {selectedDateLabel}
            </Text>
          </YStack>
        }
      />
    </YStack>
  )
}

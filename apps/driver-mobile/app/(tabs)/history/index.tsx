import { useState, useMemo } from 'react'
import { FlatList } from 'react-native'
import { YStack, XStack, Text, Card } from 'tamagui'
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

  // Filter jobs for selected date
  const filteredJobs = useMemo(() => {
    return allJobs.filter((j) => j.scheduled_date.startsWith(selectedDate))
  }, [allJobs, selectedDate])

  const selectedDateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack paddingHorizontal={16} paddingTop={16} paddingBottom={8} alignItems="center" gap="$2">
        <CalendarIcon size={20} color="#2563eb" />
        <Text fontSize={20} fontWeight="800">Calendar</Text>
      </XStack>
      <Card marginHorizontal={16} marginTop={4} bordered borderRadius={16}>
        <Calendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          jobDates={jobDates}
        />
      </Card>

      {/* Selected date header */}
      <XStack paddingHorizontal={16} paddingTop={16} paddingBottom={8} alignItems="center" gap="$2">
        <CalendarIcon size={14} color="#6b7280" />
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
          <YStack paddingHorizontal={16}>
            <JobCard job={item} />
          </YStack>
        )}
        ListEmptyComponent={
          <YStack padding="$6" alignItems="center" gap="$2">
            <CalendarIcon size={36} color="#94a3b8" />
            <Text color="$colorSubtle" textAlign="center" fontSize={13}>
              No deliveries on {selectedDateLabel}
            </Text>
          </YStack>
        }
      />
    </YStack>
  )
}

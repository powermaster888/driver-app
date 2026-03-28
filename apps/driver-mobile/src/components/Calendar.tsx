import React, { useState, useMemo } from 'react'
import { Pressable } from 'react-native'
import { YStack, XStack, Text } from 'tamagui'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useSettingsStore } from '../store/settings'

interface CalendarProps {
  selectedDate: string // YYYY-MM-DD
  onSelectDate: (date: string) => void
  jobDates: Record<string, { count: number; hasDelivered: boolean; hasFailed: boolean; hasInProgress: boolean }>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

function getDateRange(): { minDate: Date; maxDate: Date } {
  const now = new Date()
  // Previous month start
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  // 7 days from today
  const maxDate = new Date(now)
  maxDate.setDate(maxDate.getDate() + 7)
  return { minDate, maxDate }
}

export function Calendar({ selectedDate, onSelectDate, jobDates }: CalendarProps) {
  const theme = useSettingsStore((s) => s.theme)
  const today = formatDate(new Date())
  const { minDate, maxDate } = useMemo(() => getDateRange(), [])

  // Current displayed month
  const [displayMonth, setDisplayMonth] = useState(() => {
    const d = new Date(selectedDate || today)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const days = useMemo(() => getMonthDays(displayMonth.year, displayMonth.month), [displayMonth])

  // Pad start of month to align with weekday
  const firstDayOfWeek = days[0].getDay()
  const paddedDays: (Date | null)[] = [...Array(firstDayOfWeek).fill(null), ...days]

  const monthLabel = new Date(displayMonth.year, displayMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const canGoPrev = new Date(displayMonth.year, displayMonth.month, 1) > minDate
  const canGoNext = new Date(displayMonth.year, displayMonth.month + 1, 0) < maxDate

  const goToPrev = () => {
    if (!canGoPrev) return
    setDisplayMonth((m) => {
      const prev = new Date(m.year, m.month - 1, 1)
      return { year: prev.getFullYear(), month: prev.getMonth() }
    })
  }

  const goToNext = () => {
    if (!canGoNext) return
    setDisplayMonth((m) => {
      const next = new Date(m.year, m.month + 1, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  return (
    <YStack padding="$3" gap="$2">
      {/* Month navigation */}
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$2">
        <Pressable onPress={goToPrev} style={{ opacity: canGoPrev ? 1 : 0.3, padding: 8 }}>
          <ChevronLeft size={20} color={theme === 'dark' ? '#f1f5f9' : '#1e293b'} />
        </Pressable>
        <Text fontSize={16} fontWeight="700">{monthLabel}</Text>
        <Pressable onPress={goToNext} style={{ opacity: canGoNext ? 1 : 0.3, padding: 8 }}>
          <ChevronRight size={20} color={theme === 'dark' ? '#f1f5f9' : '#1e293b'} />
        </Pressable>
      </XStack>

      {/* Weekday headers */}
      <XStack>
        {WEEKDAYS.map((d) => (
          <YStack key={d} flex={1} alignItems="center">
            <Text fontSize={11} fontWeight="600" color="$colorSubtle">{d}</Text>
          </YStack>
        ))}
      </XStack>

      {/* Day grid */}
      <YStack gap={4}>
        {Array.from({ length: Math.ceil(paddedDays.length / 7) }, (_, weekIdx) => (
          <XStack key={weekIdx}>
            {paddedDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
              if (!day) {
                return <YStack key={`pad-${dayIdx}`} flex={1} height={44} />
              }

              const dateStr = formatDate(day)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              const isOutOfRange = day < minDate || day > maxDate
              const jobInfo = jobDates[dateStr]

              return (
                <YStack key={dateStr} flex={1} alignItems="center">
                  <Pressable
                    onPress={() => !isOutOfRange && onSelectDate(dateStr)}
                    disabled={isOutOfRange}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isSelected ? '#2563eb' : isToday ? (theme === 'dark' ? 'rgba(37,99,235,0.2)' : '#eff6ff') : 'transparent',
                      opacity: isOutOfRange ? 0.3 : 1,
                    }}
                    accessibilityLabel={`${dateStr}${jobInfo ? `, ${jobInfo.count} jobs` : ''}`}
                  >
                    <Text
                      fontSize={14}
                      fontWeight={isToday || isSelected ? '700' : '400'}
                      color={isSelected ? 'white' : isToday ? '#2563eb' : '$color'}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                  {/* Dot indicators */}
                  {jobInfo && (
                    <XStack gap={2} marginTop={2}>
                      {jobInfo.hasDelivered && <YStack width={4} height={4} borderRadius={2} backgroundColor="#22c55e" />}
                      {jobInfo.hasInProgress && <YStack width={4} height={4} borderRadius={2} backgroundColor="#2563eb" />}
                      {jobInfo.hasFailed && <YStack width={4} height={4} borderRadius={2} backgroundColor="#dc2626" />}
                      {!jobInfo.hasDelivered && !jobInfo.hasInProgress && !jobInfo.hasFailed && (
                        <YStack width={4} height={4} borderRadius={2} backgroundColor="#f59e0b" />
                      )}
                    </XStack>
                  )}
                </YStack>
              )
            })}
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}

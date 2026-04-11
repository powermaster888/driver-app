import React, { useState, useMemo } from 'react'
import { Pressable } from 'react-native'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'

interface CalendarProps {
  selectedDate: string
  onSelectDate: (date: string) => void
  jobDates: Record<string, { count: number; hasDelivered: boolean; hasFailed: boolean; hasInProgress: boolean }>
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

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
  const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const maxDate = new Date(now)
  maxDate.setDate(maxDate.getDate() + 7)
  return { minDate, maxDate }
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export function Calendar({ selectedDate, onSelectDate, jobDates }: CalendarProps) {
  const today = formatDate(new Date())
  const { minDate, maxDate } = useMemo(() => getDateRange(), [])
  const theme = useTheme()

  const [displayMonth, setDisplayMonth] = useState(() => {
    const d = new Date(selectedDate || today)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const days = useMemo(() => getMonthDays(displayMonth.year, displayMonth.month), [displayMonth])

  const firstDayOfWeek = days[0].getDay()
  const paddedDays: (Date | null)[] = [...Array(firstDayOfWeek).fill(null), ...days]

  const monthLabel = `${MONTH_NAMES[displayMonth.month]} ${displayMonth.year}`

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
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$2">
        <Pressable onPress={goToPrev} style={{ opacity: canGoPrev ? 1 : 0.3, padding: 8 }}>
          <ChevronLeft size={20} color={theme.color?.val} />
        </Pressable>
        <XStack alignItems="center" gap={8}>
          <Text fontSize={17} fontWeight="700" color="$color">{monthLabel}</Text>
          <Pressable
            onPress={() => {
              onSelectDate(today)
              const now = new Date()
              setDisplayMonth({ year: now.getFullYear(), month: now.getMonth() })
            }}
            style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 9999 }}
          >
            <Text fontSize={11} fontWeight="600" color="$primary">今天</Text>
          </Pressable>
        </XStack>
        <Pressable onPress={goToNext} style={{ opacity: canGoNext ? 1 : 0.3, padding: 8 }}>
          <ChevronRight size={20} color={theme.color?.val} />
        </Pressable>
      </XStack>

      <XStack>
        {WEEKDAYS.map((d) => (
          <YStack key={d} flex={1} alignItems="center">
            <Text fontSize={11} fontWeight="600" color="$muted">{d}</Text>
          </YStack>
        ))}
      </XStack>

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
                      backgroundColor: isSelected ? theme.primary?.val : isToday ? 'rgba(37,99,235,0.15)' : 'transparent',
                      opacity: isOutOfRange ? 0.3 : 1,
                    }}
                    accessibilityLabel={`${dateStr}${jobInfo ? `, ${jobInfo.count} 單` : ''}`}
                  >
                    <Text
                      fontSize={14}
                      fontWeight={isToday || isSelected ? '700' : '400'}
                      color={isSelected ? ('white' as any) : isToday ? '$primary' : '$color'}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                  {jobInfo && (
                    <XStack gap={2} marginTop={2}>
                      {jobInfo.hasDelivered && <YStack width={4} height={4} borderRadius={2} backgroundColor="$success" />}
                      {jobInfo.hasInProgress && <YStack width={4} height={4} borderRadius={2} backgroundColor="$primary" />}
                      {jobInfo.hasFailed && <YStack width={4} height={4} borderRadius={2} backgroundColor="$danger" />}
                      {!jobInfo.hasDelivered && !jobInfo.hasInProgress && !jobInfo.hasFailed && (
                        <YStack width={4} height={4} borderRadius={2} backgroundColor="$warning" />
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

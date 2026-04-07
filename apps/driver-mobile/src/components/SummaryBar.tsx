import React from 'react'
import { XStack, YStack, Text, Card } from 'tamagui'
import { Truck, Banknote, CheckCircle } from 'lucide-react-native'
import { useSettingsStore } from '../store/settings'
import type { JobSummary } from '../api/jobs'

export function SummaryBar({ jobs }: { jobs: JobSummary[] }) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const remaining = jobs.filter((j) => !['delivered', 'failed', 'returned'].includes(j.status)).length
  const cashCount = jobs.filter((j) => j.collection_required && !['delivered', 'failed', 'returned'].includes(j.status)).length
  const done = jobs.filter((j) => j.status === 'delivered').length

  return (
    <XStack padding="$3" gap="$2">
      <Card flex={1} borderRadius={12} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
        <YStack alignItems="center" gap={6}>
          <Truck size={16} color="#2563EB" />
          <Text fontSize={28} fontWeight="800" color="$color" letterSpacing={-1}>{remaining}</Text>
          <Text fontSize={10} fontWeight="600" color="$colorSubtle" textTransform="uppercase" letterSpacing={0.5}>待送</Text>
        </YStack>
      </Card>
      <Card flex={1} borderRadius={12} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
        <YStack alignItems="center" gap={6}>
          <Banknote size={16} color="#dc2626" />
          <Text fontSize={28} fontWeight="800" color="$danger" letterSpacing={-1}>{cashCount}</Text>
          <Text fontSize={10} fontWeight="600" color="$colorSubtle" textTransform="uppercase" letterSpacing={0.5}>收款</Text>
        </YStack>
      </Card>
      <Card flex={1} borderRadius={12} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
        <YStack alignItems="center" gap={6}>
          <CheckCircle size={16} color={isDark ? '#4ADE80' : '#16A34A'} />
          <Text fontSize={28} fontWeight="800" color="$success" letterSpacing={-1}>{done}</Text>
          <Text fontSize={10} fontWeight="600" color="$colorSubtle" textTransform="uppercase" letterSpacing={0.5}>完成</Text>
        </YStack>
      </Card>
    </XStack>
  )
}

import React from 'react'
import { XStack, YStack, Text, Card } from 'tamagui'
import { Truck, Banknote, CheckCircle } from 'lucide-react-native'
import type { JobSummary } from '../api/jobs'

export function SummaryBar({ jobs }: { jobs: JobSummary[] }) {
  const remaining = jobs.filter((j) => !['delivered', 'failed', 'returned'].includes(j.status)).length
  const cashCount = jobs.filter((j) => j.collection_required && !['delivered', 'failed', 'returned'].includes(j.status)).length
  const done = jobs.filter((j) => j.status === 'delivered').length

  return (
    <XStack padding="$3" gap="$2">
      <Card flex={1} borderRadius={12} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
        <XStack alignItems="center" gap="$2">
          <YStack width={32} height={32} borderRadius={8} backgroundColor="#eff6ff" alignItems="center" justifyContent="center">
            <Truck size={16} color="#2563eb" />
          </YStack>
          <YStack>
            <Text fontSize={22} fontWeight="800" color="$color">{remaining}</Text>
            <Text fontSize={10} color="$colorSubtle">remaining</Text>
          </YStack>
        </XStack>
      </Card>
      <Card flex={1} borderRadius={12} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
        <XStack alignItems="center" gap="$2">
          <YStack width={32} height={32} borderRadius={8} backgroundColor="#fef2f2" alignItems="center" justifyContent="center">
            <Banknote size={16} color="#dc2626" />
          </YStack>
          <YStack>
            <Text fontSize={22} fontWeight="800" color="#dc2626">{cashCount}</Text>
            <Text fontSize={10} color="$colorSubtle">cash</Text>
          </YStack>
        </XStack>
      </Card>
      <Card flex={1} borderRadius={12} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor">
        <XStack alignItems="center" gap="$2">
          <YStack width={32} height={32} borderRadius={8} backgroundColor="#f0fdf4" alignItems="center" justifyContent="center">
            <CheckCircle size={16} color="#22c55e" />
          </YStack>
          <YStack>
            <Text fontSize={22} fontWeight="800" color="#22c55e">{done}</Text>
            <Text fontSize={10} color="$colorSubtle">done</Text>
          </YStack>
        </XStack>
      </Card>
    </XStack>
  )
}

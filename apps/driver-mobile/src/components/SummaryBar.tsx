import React from 'react'
import { XStack, YStack, Text, useTheme } from 'tamagui'
import { View } from 'react-native'
import type { JobSummary } from '../api/jobs'

export function SummaryBar({ jobs }: { jobs: JobSummary[] }) {
  const remaining = jobs.filter((j) => !['delivered', 'failed', 'returned'].includes(j.status)).length
  const cashTotal = jobs
    .filter((j) => j.collection_required && !['delivered', 'failed', 'returned'].includes(j.status))
    .reduce((sum, j) => sum + (j.expected_collection_amount || 0), 0)
  const done = jobs.filter((j) => j.status === 'delivered').length
  const theme = useTheme()

  return (
    <View style={{
      marginHorizontal: 16, marginVertical: 8,
      backgroundColor: theme.backgroundStrong?.val,
      borderRadius: 12,
      flexDirection: 'row',
      paddingVertical: 16,
    }}>
      <YStack flex={1} alignItems="center">
        <Text fontSize={22} fontWeight="800" color="$color" letterSpacing={-0.5}>{remaining}</Text>
        <Text fontSize={11} fontWeight="500" color="$muted" marginTop={2}>待送</Text>
      </YStack>
      <View style={{ width: 1, backgroundColor: theme.borderColor?.val }} />
      <YStack flex={1} alignItems="center">
        <Text fontSize={22} fontWeight="800" color="$danger" letterSpacing={-0.5}>${cashTotal.toLocaleString()}</Text>
        <Text fontSize={11} fontWeight="500" color="$muted" marginTop={2}>代收</Text>
      </YStack>
      <View style={{ width: 1, backgroundColor: theme.borderColor?.val }} />
      <YStack flex={1} alignItems="center">
        <Text fontSize={22} fontWeight="800" color="$success" letterSpacing={-0.5}>{done}</Text>
        <Text fontSize={11} fontWeight="500" color="$muted" marginTop={2}>完成</Text>
      </YStack>
    </View>
  )
}

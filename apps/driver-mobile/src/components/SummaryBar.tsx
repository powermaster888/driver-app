import { Text, XStack, YStack, Separator } from 'tamagui'
import type { JobSummary } from '../api/jobs'

export function SummaryBar({ jobs }: { jobs: JobSummary[] }) {
  const remaining = jobs.filter((j) => !['delivered', 'failed', 'returned'].includes(j.status)).length
  const cashCount = jobs.filter((j) => j.collection_required && j.status !== 'delivered').length
  const done = jobs.filter((j) => j.status === 'delivered').length

  return (
    <XStack padding="$4" backgroundColor="$backgroundStrong" gap="$4">
      <YStack>
        <Text fontSize={28} fontWeight="800">{remaining}</Text>
        <Text fontSize={11} color="$colorSubtle">remaining</Text>
      </YStack>
      <Separator vertical />
      <YStack>
        <Text fontSize={28} fontWeight="800" color="$danger">{cashCount}</Text>
        <Text fontSize={11} color="$colorSubtle">cash</Text>
      </YStack>
      <Separator vertical />
      <YStack>
        <Text fontSize={28} fontWeight="800" color="$success">{done}</Text>
        <Text fontSize={11} color="$colorSubtle">done</Text>
      </YStack>
    </XStack>
  )
}

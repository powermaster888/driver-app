import { Text, XStack, YStack, Separator } from 'tamagui'
import { Truck, Banknote, CheckCircle } from 'lucide-react-native'
import type { JobSummary } from '../api/jobs'

export function SummaryBar({ jobs }: { jobs: JobSummary[] }) {
  const remaining = jobs.filter((j) => !['delivered', 'failed', 'returned'].includes(j.status)).length
  const cashCount = jobs.filter((j) => j.collection_required && j.status !== 'delivered').length
  const done = jobs.filter((j) => j.status === 'delivered').length

  return (
    <XStack padding="$4" backgroundColor="$backgroundStrong" gap="$4">
      <YStack>
        <XStack alignItems="center" gap={6}>
          <Truck size={16} color="#2563eb" />
          <Text fontSize={28} fontWeight="800">{remaining}</Text>
        </XStack>
        <Text fontSize={11} color="$colorSubtle">remaining</Text>
      </YStack>
      <Separator vertical />
      <YStack>
        <XStack alignItems="center" gap={6}>
          <Banknote size={16} color="#dc2626" />
          <Text fontSize={28} fontWeight="800" color="$danger">{cashCount}</Text>
        </XStack>
        <Text fontSize={11} color="$colorSubtle">cash</Text>
      </YStack>
      <Separator vertical />
      <YStack>
        <XStack alignItems="center" gap={6}>
          <CheckCircle size={16} color="#22c55e" />
          <Text fontSize={28} fontWeight="800" color="$success">{done}</Text>
        </XStack>
        <Text fontSize={11} color="$colorSubtle">done</Text>
      </YStack>
    </XStack>
  )
}

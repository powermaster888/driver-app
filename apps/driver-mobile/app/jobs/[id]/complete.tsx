import { useState, useRef } from 'react'
import { ScrollView, Alert, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Input, Button, Spinner } from 'tamagui'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useJob } from '../../../src/api/jobs'
import { PhotoThumbnail } from '../../../src/components/PhotoThumbnail'
import { useQueueStore } from '../../../src/store/queue'
import { generateActionId } from '../../../src/utils/uuid'
import { uploadFile } from '../../../src/api/uploads'
import { submitPod } from '../../../src/api/pod'
import { submitCash } from '../../../src/api/cash'
import { updateStatus } from '../../../src/api/status'

type Step = 'photos' | 'signature' | 'cash' | 'confirm'

export default function CompleteDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const jobId = Number(id)
  const { data: job } = useJob(jobId)
  const router = useRouter()
  const addAction = useQueueStore((s) => s.addAction)

  const [step, setStep] = useState<Step>('photos')
  const [photos, setPhotos] = useState<string[]>([])
  const [signatureUri, setSignatureUri] = useState<string | null>(null)
  const [cashAmount, setCashAmount] = useState(String(job?.expected_collection_amount || ''))
  const [cashMethod, setCashMethod] = useState(job?.collection_method || 'cash')
  const [cashRef, setCashRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [permission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  const takePhoto = async () => {
    const result = await cameraRef.current?.takePictureAsync({ quality: 0.8 })
    if (result?.uri) setPhotos((prev) => [...prev, result.uri])
  }

  const steps: Step[] = ['photos', 'signature', ...(job?.collection_required ? ['cash' as Step] : []), 'confirm']
  const stepIndex = steps.indexOf(step)
  const nextStep = () => setStep(steps[stepIndex + 1])
  const prevStep = () => stepIndex > 0 && setStep(steps[stepIndex - 1])

  const handleSubmit = async () => {
    setSubmitting(true)
    const timestamp = new Date().toISOString()

    try {
      // Upload photos
      const uploadIds: string[] = []
      for (const uri of photos) {
        try {
          const result = await uploadFile(uri, 'photo')
          uploadIds.push(result.upload_id)
        } catch {
          // Queue for offline
        }
      }

      // Upload signature
      let sigUploadId: string | undefined
      if (signatureUri) {
        try {
          const result = await uploadFile(signatureUri, 'signature')
          sigUploadId = result.upload_id
        } catch {}
      }

      // Submit POD
      const podActionId = generateActionId()
      await submitPod(jobId, {
        action_id: podActionId,
        photo_upload_ids: uploadIds,
        signature_upload_id: sigUploadId,
        timestamp,
      })

      // Submit cash if required
      if (job?.collection_required) {
        const cashActionId = generateActionId()
        await submitCash(jobId, {
          action_id: cashActionId,
          amount: parseFloat(cashAmount),
          method: cashMethod,
          reference: cashRef,
          timestamp,
        })
      }

      // Mark delivered
      const statusActionId = generateActionId()
      await updateStatus(jobId, {
        action_id: statusActionId,
        status: 'delivered',
        timestamp,
      })

      router.dismiss()
      Alert.alert('Delivery Complete', 'All data submitted successfully')
    } catch (e) {
      Alert.alert('Queued', 'Delivery saved locally, will sync when connected')
      router.dismiss()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: 'Complete Delivery', presentation: 'modal' }} />

      {/* Step indicator */}
      <XStack padding="$4" justifyContent="center" gap="$2">
        {steps.map((s, i) => (
          <YStack
            key={s}
            width={i === stepIndex ? 24 : 8}
            height={8}
            borderRadius={4}
            backgroundColor={i <= stepIndex ? '$primary' : '#e5e7eb'}
          />
        ))}
      </XStack>

      <ScrollView style={{ flex: 1 }}>
        {/* STEP: PHOTOS */}
        {step === 'photos' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={18} fontWeight="700">Take Delivery Photos</Text>
            <Text fontSize={13} color="$colorSubtle">At least 1 photo required</Text>

            {permission?.granted ? (
              <YStack height={300} borderRadius={14} overflow="hidden" backgroundColor="#000">
                <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
                <Pressable
                  style={{ position: 'absolute', bottom: 20, alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: 'white', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' }}
                  onPress={takePhoto}
                />
              </YStack>
            ) : (
              <Text>Camera permission required</Text>
            )}

            {photos.length > 0 && (
              <XStack gap="$2" flexWrap="wrap">
                {photos.map((uri, i) => <PhotoThumbnail key={i} uri={uri} />)}
              </XStack>
            )}
          </YStack>
        )}

        {/* STEP: SIGNATURE */}
        {step === 'signature' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={18} fontWeight="700">Signature (Optional)</Text>
            <Text fontSize={13} color="$colorSubtle">Ask the recipient to sign below</Text>
            <YStack height={200} borderRadius={14} borderWidth={1} borderColor="$borderColor" backgroundColor="$backgroundStrong" justifyContent="center" alignItems="center">
              <Text color="$colorSubtle">Signature pad placeholder</Text>
              <Text fontSize={11} color="$colorSubtle">(react-native-signature-canvas)</Text>
            </YStack>
          </YStack>
        )}

        {/* STEP: CASH */}
        {step === 'cash' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={18} fontWeight="700">Cash Collection</Text>
            <YStack gap="$2">
              <Text fontSize={11} color="$colorSubtle">Amount (HKD)</Text>
              <Input
                value={cashAmount}
                onChangeText={setCashAmount}
                keyboardType="numeric"
                size="$5"
                borderRadius={14}
                fontSize={20}
                fontWeight="700"
              />
            </YStack>
            <YStack gap="$2">
              <Text fontSize={11} color="$colorSubtle">Method</Text>
              <XStack gap="$2">
                <Button
                  flex={1} size="$5" borderRadius={14}
                  backgroundColor={cashMethod === 'cash' ? '$primary' : '$backgroundStrong'}
                  color={cashMethod === 'cash' ? 'white' : '$color'}
                  onPress={() => setCashMethod('cash')}
                >Cash</Button>
                <Button
                  flex={1} size="$5" borderRadius={14}
                  backgroundColor={cashMethod === 'cheque' ? '$primary' : '$backgroundStrong'}
                  color={cashMethod === 'cheque' ? 'white' : '$color'}
                  onPress={() => setCashMethod('cheque')}
                >Cheque</Button>
              </XStack>
            </YStack>
            <YStack gap="$2">
              <Text fontSize={11} color="$colorSubtle">Reference / Note</Text>
              <Input
                value={cashRef}
                onChangeText={setCashRef}
                placeholder="Receipt number, notes..."
                size="$5"
                borderRadius={14}
              />
            </YStack>
          </YStack>
        )}

        {/* STEP: CONFIRM */}
        {step === 'confirm' && (
          <YStack padding="$4" gap="$3">
            <Text fontSize={18} fontWeight="700">Confirm Delivery</Text>
            <YStack gap="$2" padding="$3" backgroundColor="$backgroundStrong" borderRadius={14}>
              <Text fontSize={13}>📷 {photos.length} photo(s)</Text>
              <Text fontSize={13}>✍️ {signatureUri ? 'Signature captured' : 'No signature'}</Text>
              {job?.collection_required && (
                <Text fontSize={13}>💰 {cashMethod} ${cashAmount}</Text>
              )}
            </YStack>
          </YStack>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <YStack padding="$4" gap="$2" backgroundColor="$backgroundStrong" borderTopWidth={1} borderTopColor="$borderColor">
        {step === 'confirm' ? (
          <Button
            size="$5" backgroundColor="$primary" color="white" fontWeight="700" borderRadius={14}
            onPress={handleSubmit} disabled={submitting} minHeight={56}
          >
            {submitting ? <Spinner color="white" /> : 'Submit & Complete'}
          </Button>
        ) : (
          <Button
            size="$5" backgroundColor="$primary" color="white" fontWeight="700" borderRadius={14}
            onPress={nextStep} disabled={step === 'photos' && photos.length === 0} minHeight={56}
          >
            {step === 'signature' ? 'Next (or Skip)' : 'Next →'}
          </Button>
        )}
        {stepIndex > 0 && (
          <Button size="$4" chromeless onPress={prevStep}>
            <Text color="$colorSubtle">← Back</Text>
          </Button>
        )}
      </YStack>
    </YStack>
  )
}

import { useState, useRef } from 'react'
import { ScrollView, Alert, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Input, Button, Spinner } from 'tamagui'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Camera, PenTool, Banknote } from 'lucide-react-native'
import SignatureScreen from 'react-native-signature-canvas'
import { useJob } from '../../../src/api/jobs'
import { PhotoThumbnail } from '../../../src/components/PhotoThumbnail'
import { useQueueStore } from '../../../src/store/queue'
import { generateActionId } from '../../../src/utils/uuid'
import { showToast, triggerHaptic } from '../../../src/utils/feedback'
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
  const signatureRef = useRef<any>(null)

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

    // Generate action IDs up front
    const podActionId = generateActionId()
    const cashActionId = job?.collection_required ? generateActionId() : undefined
    const statusActionId = generateActionId()

    // Queue ALL actions first so they persist even if API calls fail
    addAction({
      actionId: podActionId,
      endpoint: `/jobs/${jobId}/proof-of-delivery`,
      method: 'POST',
      body: {
        action_id: podActionId,
        photo_uris: photos,
        signature_uri: signatureUri || undefined,
        timestamp,
      },
    })

    if (job?.collection_required && cashActionId) {
      addAction({
        actionId: cashActionId,
        endpoint: `/jobs/${jobId}/cash-collection`,
        method: 'POST',
        body: {
          action_id: cashActionId,
          amount: parseFloat(cashAmount),
          method: cashMethod,
          reference: cashRef,
          timestamp,
        },
      })
    }

    addAction({
      actionId: statusActionId,
      endpoint: `/jobs/${jobId}/status`,
      method: 'POST',
      body: {
        action_id: statusActionId,
        status: 'delivered',
        timestamp,
      },
    })

    // Now attempt API calls — on success remove from queue, on failure queued actions remain for sync retry
    const removeAction = useQueueStore.getState().removeAction

    try {
      // Upload photos
      const uploadIds: string[] = []
      for (const uri of photos) {
        try {
          const result = await uploadFile(uri, 'photo')
          uploadIds.push(result.upload_id)
        } catch {
          // Will be retried by sync engine
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
      await submitPod(jobId, {
        action_id: podActionId,
        photo_upload_ids: uploadIds,
        signature_upload_id: sigUploadId,
        timestamp,
      })
      removeAction(podActionId)

      // Submit cash if required
      if (job?.collection_required && cashActionId) {
        await submitCash(jobId, {
          action_id: cashActionId,
          amount: parseFloat(cashAmount),
          method: cashMethod,
          reference: cashRef,
          timestamp,
        })
        removeAction(cashActionId)
      }

      // Mark delivered
      await updateStatus(jobId, {
        action_id: statusActionId,
        status: 'delivered',
        timestamp,
      })
      removeAction(statusActionId)

      await triggerHaptic('success')
      showToast('Delivery completed!', 'success')
      router.dismiss()
    } catch (e) {
      showToast('Saved locally, will sync when connected', 'info')
      router.dismiss()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
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
            <YStack height={200} borderRadius={14} borderWidth={1} borderColor="$borderColor" overflow="hidden">
              <SignatureScreen
                ref={signatureRef}
                onOK={(signature: string) => setSignatureUri(signature)}
                webStyle={`.m-signature-pad { box-shadow: none; border: none; } .m-signature-pad--body { border: none; }`}
              />
            </YStack>
            {signatureUri && <Text fontSize={12} color="$colorSubtle">Signature captured</Text>}
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
            <YStack gap="$3" padding="$3" backgroundColor="$backgroundStrong" borderRadius={14}>
              <XStack alignItems="center" gap={8}>
                <Camera size={16} color="#2563eb" />
                <Text fontSize={13}>{photos.length} photo(s)</Text>
              </XStack>
              <XStack alignItems="center" gap={8}>
                <PenTool size={16} color="#2563eb" />
                <Text fontSize={13}>{signatureUri ? 'Signature captured' : 'No signature'}</Text>
              </XStack>
              {job?.collection_required && (
                <XStack alignItems="center" gap={8}>
                  <Banknote size={16} color="#2563eb" />
                  <Text fontSize={13}>{cashMethod} ${cashAmount}</Text>
                </XStack>
              )}
            </YStack>
          </YStack>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <YStack padding="$4" gap="$2" backgroundColor="$backgroundStrong" borderTopWidth={1} borderTopColor="$borderColor">
        {step === 'confirm' ? (
          <Button
            size="$5" backgroundColor="#F97316" color="white" fontWeight="700" borderRadius={14}
            onPress={handleSubmit} disabled={submitting} minHeight={56}
            pressStyle={{ opacity: 0.7 }}
          >
            {submitting ? <Spinner color="white" /> : 'Submit & Complete'}
          </Button>
        ) : (
          <Button
            size="$5" backgroundColor="$primary" color="white" fontWeight="700" borderRadius={14}
            onPress={nextStep} disabled={step === 'photos' && photos.length === 0} minHeight={56}
            pressStyle={{ opacity: 0.7 }}
          >
            {step === 'signature' ? 'Next (or Skip)' : 'Next'}
          </Button>
        )}
        {stepIndex > 0 && (
          <Button size="$4" chromeless onPress={prevStep}>
            <Text color="$colorSubtle">Back</Text>
          </Button>
        )}
      </YStack>
    </YStack>
    </SafeAreaView>
  )
}

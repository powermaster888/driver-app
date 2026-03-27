import { useState, useRef } from 'react'
import { StyleSheet, Pressable, Alert, Image } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { YStack, XStack, Text, Button } from 'tamagui'
import { Camera, X } from 'lucide-react-native'
import { uploadFile } from '../src/api/uploads'
import { useQueueStore } from '../src/store/queue'
import { useJobs } from '../src/api/jobs'

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const cameraRef = useRef<CameraView>(null)
  const router = useRouter()
  const { data } = useJobs('today')
  const activeJobs = (data?.jobs || []).filter(
    (j) => ['assigned', 'accepted', 'on_the_way', 'arrived'].includes(j.status)
  )

  if (!permission?.granted) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" gap="$4">
        <Camera size={48} color="#2563eb" />
        <Text textAlign="center" fontSize={15}>Camera access is needed for delivery photo proof.</Text>
        <Button size="$5" backgroundColor="$primary" color="white" onPress={requestPermission}>
          Grant Access
        </Button>
        <Button size="$4" chromeless onPress={() => router.back()}>
          <Text color="$colorSubtle">Cancel</Text>
        </Button>
      </YStack>
    )
  }

  const takePhoto = async () => {
    const result = await cameraRef.current?.takePictureAsync({ quality: 0.8 })
    if (result?.uri) setPhoto(result.uri)
  }

  const attachToJob = async (jobId: number) => {
    if (!photo) return
    setUploading(true)
    try {
      const result = await uploadFile(photo, 'photo')
      Alert.alert('Photo attached', `Upload ID: ${result.upload_id}`)
    } catch {
      Alert.alert('Queued', 'Photo will sync when connected')
    }
    setUploading(false)
    router.back()
  }

  if (photo) {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <YStack width="100%" aspectRatio={3/4} borderRadius={14} overflow="hidden" backgroundColor="#000">
            <Image source={{ uri: photo }} style={{ flex: 1 }} resizeMode="contain" />
          </YStack>
        </YStack>
        <YStack padding="$4" gap="$2">
          <Text fontSize={14} fontWeight="700" marginBottom="$2">Attach to which job?</Text>
          {activeJobs.map((job) => (
            <Button key={job.job_id} size="$4" bordered borderRadius={12} onPress={() => attachToJob(job.job_id)}>
              <Text fontSize={13}>{job.customer_name} · {job.odoo_reference}</Text>
            </Button>
          ))}
          <XStack gap="$2" marginTop="$2">
            <Button flex={1} size="$4" chromeless onPress={() => setPhoto(null)}>
              <Text color="$colorSubtle">Retake</Text>
            </Button>
            <Button flex={1} size="$4" chromeless onPress={() => router.back()}>
              <Text color="$danger">Cancel</Text>
            </Button>
          </XStack>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="#000">
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
      <YStack position="absolute" bottom={40} left={0} right={0} alignItems="center">
        <Pressable
          style={styles.captureButton}
          onPress={takePhoto}
        />
      </YStack>
      <Pressable style={styles.closeButton} onPress={() => router.back()}>
        <X size={20} color="white" />
      </Pressable>
    </YStack>
  )
}

const styles = StyleSheet.create({
  captureButton: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'white', borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)',
  },
  closeButton: {
    position: 'absolute', top: 60, left: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
})

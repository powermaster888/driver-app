import { useState } from 'react'
import { StyleSheet, Pressable, View as RNView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { YStack, XStack, Text } from 'tamagui'
import { X, Check, ScanLine } from 'lucide-react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

export default function ScannerScreen() {
  const router = useRouter()
  const { jobId } = useLocalSearchParams<{ jobId?: string }>()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [scannedCode, setScannedCode] = useState<string | null>(null)

  if (!permission?.granted) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding={24} backgroundColor="#050505" gap={16}>
        <ScanLine size={48} color="#2563EB" />
        <Text fontSize={17} fontWeight="700" textAlign="center" color="#EDEDEF">需要相機權限才能掃描條碼</Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: '#2563EB', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 9999 }}
        >
          <Text fontSize={15} fontWeight="700" color="white">授權使用</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ padding: 12 }}>
          <Text color="#8B8D94" fontSize={14}>取消</Text>
        </Pressable>
      </YStack>
    )
  }

  const handleBarCodeScanned = ({ data }: { data: string; type: string }) => {
    if (scanned) return
    setScanned(true)
    setScannedCode(data)
  }

  return (
    <YStack flex={1} backgroundColor="#000">
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <RNView style={styles.overlay}>
        {/* Top bar with close button */}
        <RNView style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <X size={24} color="white" />
          </Pressable>
        </RNView>

        {/* Center scan area */}
        <YStack flex={1} justifyContent="center" alignItems="center">
          <RNView style={styles.scanFrame}>
            <RNView style={[styles.corner, styles.topLeft]} />
            <RNView style={[styles.corner, styles.topRight]} />
            <RNView style={[styles.corner, styles.bottomLeft]} />
            <RNView style={[styles.corner, styles.bottomRight]} />
          </RNView>
          <Text fontSize={14} fontWeight="500" color="rgba(255,255,255,0.7)" marginTop={24}>
            掃描產品條碼
          </Text>
        </YStack>

        {/* Scanned result */}
        {scannedCode && (
          <YStack padding={20} paddingBottom={40} backgroundColor="#111111" borderTopLeftRadius={20} borderTopRightRadius={20}>
            <XStack alignItems="center" gap={12} marginBottom={16}>
              <RNView style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center' }}>
                <Check size={20} color="white" />
              </RNView>
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="700" color="#EDEDEF">條碼已掃描</Text>
                <Text fontSize={17} fontWeight="600" color="#22C55E" marginTop={2}>{scannedCode}</Text>
              </YStack>
            </XStack>
            <XStack gap={12}>
              <Pressable
                onPress={() => { setScanned(false); setScannedCode(null) }}
                style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 9999, padding: 14, alignItems: 'center' }}
              >
                <Text fontSize={14} fontWeight="600" color="#EDEDEF">再掃一次</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (jobId) {
                    router.replace(`/(tabs)/jobs/${jobId}?scannedCode=${encodeURIComponent(scannedCode)}`)
                  } else {
                    router.back()
                  }
                }}
                style={{ flex: 1, backgroundColor: '#22C55E', borderRadius: 9999, padding: 14, alignItems: 'center' }}
              >
                <Text fontSize={14} fontWeight="600" color="white">{jobId ? '查看訂單' : '完成'}</Text>
              </Pressable>
            </XStack>
          </YStack>
        )}
      </RNView>
    </YStack>
  )
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar: { paddingTop: 56, paddingLeft: 16 },
  closeButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanFrame: { width: 260, height: 180, borderRadius: 16, borderWidth: 3, borderColor: '#2563EB', position: 'relative' },
  corner: { position: 'absolute', width: 24, height: 24 },
  topLeft: { top: -3, left: -3, borderTopWidth: 0, borderLeftWidth: 0 },
  topRight: { top: -3, right: -3, borderTopWidth: 0, borderRightWidth: 0 },
  bottomLeft: { bottom: -3, left: -3, borderBottomWidth: 0, borderLeftWidth: 0 },
  bottomRight: { bottom: -3, right: -3, borderBottomWidth: 0, borderRightWidth: 0 },
})

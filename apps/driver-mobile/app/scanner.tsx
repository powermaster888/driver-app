import { useState, useEffect } from 'react'
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
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor="$background" gap="$4">
        <ScanLine size={48} color="#2563EB" />
        <Text fontSize={17} fontWeight="700" textAlign="center" color="$color">Camera access needed for barcode scanning</Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: '#2563EB', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 9999 }}
        >
          <Text fontSize={15} fontWeight="700" color="white">Grant Access</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ padding: 12 }}>
          <Text color="#8A8F98">Cancel</Text>
        </Pressable>
      </YStack>
    )
  }

  const handleBarCodeScanned = ({ data, type }: { data: string; type: string }) => {
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

      {/* Overlay with scan guide */}
      <RNView style={styles.overlay}>
        {/* Top bar */}
        <XStack justifyContent="space-between" alignItems="center" padding={20} paddingTop={48}>
          <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
            <X size={24} color="white" />
          </Pressable>
          <Text fontSize={17} fontWeight="700" color="white">Scan Barcode</Text>
          <RNView style={{ width: 40 }} />
        </XStack>

        {/* Center scan area */}
        <YStack flex={1} justifyContent="center" alignItems="center">
          <RNView style={styles.scanFrame}>
            <RNView style={[styles.corner, styles.topLeft]} />
            <RNView style={[styles.corner, styles.topRight]} />
            <RNView style={[styles.corner, styles.bottomLeft]} />
            <RNView style={[styles.corner, styles.bottomRight]} />
          </RNView>
          <Text fontSize={14} fontWeight="400" color="rgba(255,255,255,0.7)" marginTop={20}>
            Point camera at product barcode
          </Text>
        </YStack>

        {/* Scanned result */}
        {scannedCode && (
          <YStack padding="$5" paddingBottom={40} backgroundColor="#1A1A1A" borderTopLeftRadius={20} borderTopRightRadius={20} borderWidth={1} borderBottomWidth={0} borderColor="rgba(255,255,255,0.06)">
            <XStack alignItems="center" gap="$3" marginBottom="$4">
              <RNView style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center' }}>
                <Check size={20} color="white" />
              </RNView>
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="700" color="#F5F5F5">Barcode Scanned</Text>
                <Text fontSize={17} fontWeight="600" color="#4ADE80" marginTop={2}>{scannedCode}</Text>
              </YStack>
            </XStack>
            <XStack gap="$3">
              <Pressable
                onPress={() => { setScanned(false); setScannedCode(null) }}
                style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 9999, padding: 14, alignItems: 'center' }}
              >
                <Text fontSize={14} fontWeight="600" color="#F5F5F5">Scan Again</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (jobId) {
                    router.replace(`/(tabs)/jobs/${jobId}?scannedCode=${encodeURIComponent(scannedCode)}`)
                  } else {
                    router.back()
                  }
                }}
                style={{ flex: 1, backgroundColor: '#22c55e', borderRadius: 9999, padding: 14, alignItems: 'center' }}
              >
                <Text fontSize={14} fontWeight="600" color="white">{jobId ? 'View Job' : 'Done'}</Text>
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
  scanFrame: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#2563EB' },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
})

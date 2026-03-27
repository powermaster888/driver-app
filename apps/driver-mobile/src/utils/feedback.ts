import { Platform } from 'react-native'
import { toast } from 'burnt'

export function showToast(title: string, type: 'success' | 'error' | 'info' = 'info') {
  toast({
    title,
    preset: type === 'error' ? 'error' : type === 'success' ? 'done' : 'none',
    haptic: type === 'error' ? 'error' : type === 'success' ? 'success' : undefined,
  })
}

export async function triggerHaptic(type: 'success' | 'warning' | 'error' | 'light' = 'light') {
  if (Platform.OS === 'web') return
  try {
    const Haptics = require('expo-haptics')
    const map = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
      light: null,
    }
    if (map[type]) {
      await Haptics.notificationAsync(map[type])
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  } catch {}
}

import { create } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// expo-secure-store doesn't work on web — use AsyncStorage as fallback
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key)
    }
    const SecureStore = require('expo-secure-store')
    return SecureStore.getItemAsync(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value)
      return
    }
    const SecureStore = require('expo-secure-store')
    await SecureStore.setItemAsync(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key)
      return
    }
    const SecureStore = require('expo-secure-store')
    await SecureStore.deleteItemAsync(key)
  },
}

interface Driver {
  id: number
  name: string
  phone: string
}

interface AuthState {
  token: string | null
  driver: Driver | null
  isLoading: boolean
  setAuth: (token: string, driver: Driver) => void
  clearAuth: () => void
  loadToken: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  driver: null,
  isLoading: true,

  setAuth: async (token, driver) => {
    await storage.setItem('auth_token', token)
    await storage.setItem('auth_driver', JSON.stringify(driver))
    set({ token, driver })
  },

  clearAuth: async () => {
    await storage.removeItem('auth_token')
    await storage.removeItem('auth_driver')
    set({ token: null, driver: null })
  },

  loadToken: async () => {
    const token = await storage.getItem('auth_token')
    const driverJson = await storage.getItem('auth_driver')
    const driver = driverJson ? JSON.parse(driverJson) : null
    set({ token, driver, isLoading: false })
  },
}))

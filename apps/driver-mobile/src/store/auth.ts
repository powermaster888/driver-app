import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

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
    await SecureStore.setItemAsync('auth_token', token)
    await SecureStore.setItemAsync('auth_driver', JSON.stringify(driver))
    set({ token, driver })
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('auth_token')
    await SecureStore.deleteItemAsync('auth_driver')
    set({ token: null, driver: null })
  },

  loadToken: async () => {
    const token = await SecureStore.getItemAsync('auth_token')
    const driverJson = await SecureStore.getItemAsync('auth_driver')
    const driver = driverJson ? JSON.parse(driverJson) : null
    set({ token, driver, isLoading: false })
  },
}))

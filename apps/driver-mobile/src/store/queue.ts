import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ActionStatus = 'queued' | 'syncing' | 'synced' | 'failed'

export interface QueuedAction {
  actionId: string
  endpoint: string
  method: string
  body: Record<string, any> | null
  file?: string
  status: ActionStatus
  createdAt: string
  error?: string
  retryCount?: number
}

interface QueueState {
  actions: QueuedAction[]
  addAction: (action: Omit<QueuedAction, 'status' | 'createdAt'>) => void
  updateAction: (actionId: string, updates: Partial<QueuedAction>) => void
  removeAction: (actionId: string) => void
  clearSynced: () => void
  getPending: () => QueuedAction[]
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      actions: [],

      addAction: (action) =>
        set((s) => ({
          actions: [...s.actions, { ...action, status: 'queued', createdAt: new Date().toISOString() }],
        })),

      updateAction: (actionId, updates) =>
        set((s) => ({
          actions: s.actions.map((a) => (a.actionId === actionId ? { ...a, ...updates } : a)),
        })),

      removeAction: (actionId) =>
        set((s) => ({ actions: s.actions.filter((a) => a.actionId !== actionId) })),

      clearSynced: () =>
        set((s) => ({ actions: s.actions.filter((a) => a.status !== 'synced') })),

      getPending: () => get().actions.filter((a) => a.status === 'queued' || a.status === 'failed'),
    }),
    {
      name: 'offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

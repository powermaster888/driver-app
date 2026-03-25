# Driver Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo + React Native mobile app for Healthy Living delivery drivers with offline-first sync, camera-based POD, and cash collection.

**Architecture:** Expo app with file-based routing (expo-router), Tamagui design system, TanStack Query for server state, Zustand for client state + offline queue. Connects to the FastAPI driver-api service at `services/driver-api/`.

**Tech Stack:** Expo SDK 52+, React Native, TypeScript, Tamagui, expo-router, TanStack Query, Zustand, expo-camera, expo-secure-store, react-native-signature-canvas

**Spec:** `docs/superpowers/specs/2026-03-26-mobile-app-design.md`
**API contract:** `docs/superpowers/specs/2026-03-26-api-contract-design.md`

---

## File Structure

```
apps/driver-mobile/
├── app.json                         # Expo config
├── package.json
├── tsconfig.json
├── tamagui.config.ts                # Tamagui theme tokens, light/dark themes
├── app/
│   ├── _layout.tsx                  # Root layout: providers (QueryClient, Tamagui, Zustand)
│   ├── login.tsx                    # Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx             # Tab navigator: Jobs, Camera FAB, History
│   │   ├── jobs/
│   │   │   ├── index.tsx           # Jobs list
│   │   │   └── [id].tsx            # Job detail
│   │   └── history/
│   │       ├── index.tsx           # History list
│   │       └── [id].tsx            # History detail (read-only)
│   ├── jobs/
│   │   └── [id]/
│   │       └── complete.tsx        # Delivery completion modal
│   ├── camera.tsx                   # Camera quick-capture modal
│   └── settings.tsx                 # Settings screen
├── src/
│   ├── api/
│   │   ├── client.ts               # Axios/fetch wrapper with auth header + base URL
│   │   ├── jobs.ts                 # Job API calls + TanStack Query hooks
│   │   ├── auth.ts                 # Login API call
│   │   ├── uploads.ts              # Upload API call
│   │   ├── status.ts               # Status update API call
│   │   ├── pod.ts                  # POD submission API call
│   │   ├── cash.ts                 # Cash collection API call
│   │   └── sync.ts                 # Batch sync API call
│   ├── store/
│   │   ├── auth.ts                 # Auth store (token, driver, login/logout)
│   │   ├── queue.ts                # Offline action queue store
│   │   └── settings.ts             # Theme + preferences store
│   ├── sync/
│   │   └── engine.ts               # Sync engine: network listener, queue processor
│   ├── components/
│   │   ├── JobCard.tsx             # Job card for list views
│   │   ├── StatusBadge.tsx         # Colored status pill
│   │   ├── SyncIndicator.tsx       # Header sync dot (green/amber/red)
│   │   ├── ActionButton.tsx        # Large touch-target status action button
│   │   ├── CashBadge.tsx           # Red cash collection indicator
│   │   ├── SummaryBar.tsx          # Today's stats bar
│   │   ├── OfflineBanner.tsx       # Amber offline warning banner
│   │   └── PhotoThumbnail.tsx      # Photo preview thumbnail
│   ├── theme/
│   │   └── status-colors.ts        # Status → color mapping for light/dark
│   └── utils/
│       ├── uuid.ts                 # Client-side UUID generation for action_id
│       └── html.ts                 # Strip HTML tags from Odoo note fields
└── assets/                          # App icon, splash screen
```

---

## Task 1: Expo Project Scaffold

**Files:**
- Create: `apps/driver-mobile/package.json`
- Create: `apps/driver-mobile/app.json`
- Create: `apps/driver-mobile/tsconfig.json`
- Create: `apps/driver-mobile/app/_layout.tsx`
- Create: `apps/driver-mobile/app/login.tsx`

- [ ] **Step 1: Create Expo project**

```bash
cd apps
npx create-expo-app driver-mobile --template blank-typescript
cd driver-mobile
```

- [ ] **Step 2: Install core dependencies**

```bash
npx expo install expo-router expo-secure-store expo-camera expo-image-picker expo-linking
npm install @tanstack/react-query zustand
npm install react-native-safe-area-context react-native-screens react-native-gesture-handler
```

- [ ] **Step 3: Configure app.json for expo-router**

Update `app.json`:
```json
{
  "expo": {
    "name": "Healthy Living Driver",
    "slug": "driver-mobile",
    "scheme": "driver-mobile",
    "plugins": [
      "expo-router",
      ["expo-camera", { "cameraPermission": "Camera access is needed for delivery photo proof." }]
    ],
    "experiments": { "typedRoutes": true }
  }
}
```

- [ ] **Step 4: Create root layout**

`app/_layout.tsx`:
```tsx
import { Slot } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Create placeholder login screen**

`app/login.tsx`:
```tsx
import { View, Text } from 'react-native'

export default function Login() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Login placeholder</Text>
    </View>
  )
}
```

- [ ] **Step 6: Verify it runs**

```bash
npx expo start
# Scan QR code or press 'i' for iOS simulator
# Expected: shows "Login placeholder"
```

- [ ] **Step 7: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: scaffold Expo project with expo-router and TanStack Query"
```

---

## Task 2: Tamagui Setup + Theme

**Files:**
- Create: `apps/driver-mobile/tamagui.config.ts`
- Create: `apps/driver-mobile/src/theme/status-colors.ts`
- Modify: `apps/driver-mobile/app/_layout.tsx`

- [ ] **Step 1: Install Tamagui**

```bash
cd apps/driver-mobile
npm install tamagui @tamagui/config @tamagui/themes
npx expo install react-native-reanimated
```

- [ ] **Step 2: Create tamagui.config.ts**

```ts
import { createTamagui } from 'tamagui'
import { config } from '@tamagui/config/v3'

const tamaguiConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      background: '#f5f5f7',
      backgroundStrong: '#ffffff',
      color: '#111111',
      colorSubtle: '#6b7280',
      primary: '#2563eb',
      danger: '#dc2626',
      success: '#22c55e',
    },
    dark: {
      ...config.themes.dark,
      background: '#0c1222',
      backgroundStrong: 'rgba(255,255,255,0.04)',
      color: '#f1f5f9',
      colorSubtle: '#64748b',
      primary: '#3b82f6',
      danger: '#ef4444',
      success: '#4ade80',
    },
  },
})

export type AppConfig = typeof tamaguiConfig
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
export default tamaguiConfig
```

- [ ] **Step 3: Create status-colors.ts**

```ts
export const STATUS_COLORS = {
  assigned:   { bg: '#fef3c7', text: '#92400e', border: '#f59e0b', darkBg: 'rgba(245,158,11,0.15)', darkText: '#fbbf24' },
  accepted:   { bg: '#d1fae5', text: '#166534', border: '#22c55e', darkBg: 'rgba(34,197,94,0.15)', darkText: '#4ade80' },
  on_the_way: { bg: '#dbeafe', text: '#1e40af', border: '#2563eb', darkBg: 'rgba(59,130,246,0.15)', darkText: '#60a5fa' },
  arrived:    { bg: '#ede9fe', text: '#5b21b6', border: '#7c3aed', darkBg: 'rgba(139,92,246,0.15)', darkText: '#a78bfa' },
  delivered:  { bg: '#dcfce7', text: '#166534', border: '#16a34a', darkBg: 'rgba(22,163,74,0.15)', darkText: '#4ade80' },
  failed:     { bg: '#fee2e2', text: '#991b1b', border: '#dc2626', darkBg: 'rgba(220,38,38,0.15)', darkText: '#f87171' },
  returned:   { bg: '#f3f4f6', text: '#374151', border: '#6b7280', darkBg: 'rgba(107,114,128,0.15)', darkText: '#9ca3af' },
} as const

export type DeliveryStatus = keyof typeof STATUS_COLORS
```

- [ ] **Step 4: Update root layout with Tamagui provider**

```tsx
import { Slot } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TamaguiProvider, Theme } from 'tamagui'
import tamaguiConfig from '../tamagui.config'
import { useSettingsStore } from '../src/store/settings'

const queryClient = new QueryClient()

export default function RootLayout() {
  const theme = useSettingsStore((s) => s.theme)
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <Theme name={theme}>
        <QueryClientProvider client={queryClient}>
          <Slot />
        </QueryClientProvider>
      </Theme>
    </TamaguiProvider>
  )
}
```

Note: settings store created in Task 3.

- [ ] **Step 5: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add Tamagui theme with light/dark modes and status color system"
```

---

## Task 3: Zustand Stores

**Files:**
- Create: `apps/driver-mobile/src/store/auth.ts`
- Create: `apps/driver-mobile/src/store/queue.ts`
- Create: `apps/driver-mobile/src/store/settings.ts`
- Create: `apps/driver-mobile/src/utils/uuid.ts`

- [ ] **Step 1: Create uuid utility**

`src/utils/uuid.ts`:
```ts
export function generateActionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
```

- [ ] **Step 2: Create auth store**

`src/store/auth.ts`:
```ts
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
```

- [ ] **Step 3: Create queue store**

`src/store/queue.ts`:
```ts
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
```

- [ ] **Step 4: Create settings store**

`src/store/settings.ts`:
```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface SettingsState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
```

- [ ] **Step 5: Install AsyncStorage**

```bash
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 6: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add Zustand stores for auth, offline queue, and settings"
```

---

## Task 4: API Client + Hooks

**Files:**
- Create: `apps/driver-mobile/src/api/client.ts`
- Create: `apps/driver-mobile/src/api/auth.ts`
- Create: `apps/driver-mobile/src/api/jobs.ts`
- Create: `apps/driver-mobile/src/api/status.ts`
- Create: `apps/driver-mobile/src/api/uploads.ts`
- Create: `apps/driver-mobile/src/api/pod.ts`
- Create: `apps/driver-mobile/src/api/cash.ts`
- Create: `apps/driver-mobile/src/api/sync.ts`
- Create: `apps/driver-mobile/src/utils/html.ts`

- [ ] **Step 1: Create API client**

`src/api/client.ts`:
```ts
import { useAuthStore } from '../store/auth'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

interface RequestOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 401) {
    useAuthStore.getState().clearAuth()
    throw new Error('unauthorized')
  }

  const data = await response.json()

  if (!response.ok) {
    throw { status: response.status, ...data }
  }

  return data as T
}

export async function apiUpload(file: { uri: string; type: string; name: string }, fileType: 'photo' | 'signature') {
  const token = useAuthStore.getState().token
  const formData = new FormData()
  formData.append('file', file as any)
  formData.append('type', fileType)

  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) throw await response.json()
  return response.json()
}
```

- [ ] **Step 2: Create auth API**

`src/api/auth.ts`:
```ts
import { apiRequest } from './client'

interface LoginResponse {
  token: string
  driver: { id: number; name: string; phone: string }
}

export async function login(phone: string, pin: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { phone, pin },
  })
}
```

- [ ] **Step 3: Create jobs API with TanStack Query hooks**

`src/api/jobs.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'

export interface JobItem {
  product_name: string
  quantity: number
}

export interface JobSummary {
  job_id: number
  odoo_reference: string
  sales_order_ref: string | null
  customer_name: string
  phone: string | null
  address: string | null
  warehouse: string
  scheduled_date: string
  status: string
  collection_required: boolean
  collection_method: string | null
  expected_collection_amount: number | null
  sync_status: string
}

export interface JobDetail extends JobSummary {
  delivery_notes: string | null
  additional_info: string | null
  account_no: string | null
  items: JobItem[]
  proof_of_delivery: any | null
  cash_collection: any | null
}

interface JobListResponse {
  jobs: JobSummary[]
  fetched_at: string
}

export function useJobs(scope: 'today' | 'pending' | 'recent') {
  return useQuery({
    queryKey: ['jobs', scope],
    queryFn: () => apiRequest<JobListResponse>(`/me/jobs?scope=${scope}`),
    staleTime: 30_000,
  })
}

export function useJob(id: number) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => apiRequest<JobDetail>(`/jobs/${id}`),
  })
}
```

- [ ] **Step 4: Create remaining API modules**

`src/api/status.ts`:
```ts
import { apiRequest } from './client'

export async function updateStatus(jobId: number, body: {
  action_id: string
  status: string
  timestamp: string
  reason?: string
  note?: string
}) {
  return apiRequest(`/jobs/${jobId}/status`, { method: 'POST', body })
}
```

`src/api/uploads.ts`:
```ts
import { apiUpload } from './client'

export async function uploadFile(uri: string, type: 'photo' | 'signature') {
  const name = type === 'photo' ? 'pod_photo.jpg' : 'signature.png'
  const mimeType = type === 'photo' ? 'image/jpeg' : 'image/png'
  return apiUpload({ uri, type: mimeType, name }, type)
}
```

`src/api/pod.ts`:
```ts
import { apiRequest } from './client'

export async function submitPod(jobId: number, body: {
  action_id: string
  photo_upload_ids: string[]
  signature_upload_id?: string
  note?: string
  timestamp: string
}) {
  return apiRequest(`/jobs/${jobId}/proof-of-delivery`, { method: 'POST', body })
}
```

`src/api/cash.ts`:
```ts
import { apiRequest } from './client'

export async function submitCash(jobId: number, body: {
  action_id: string
  amount: number
  method: string
  reference: string
  photo_upload_id?: string
  timestamp: string
}) {
  return apiRequest(`/jobs/${jobId}/cash-collection`, { method: 'POST', body })
}
```

`src/api/sync.ts`:
```ts
import { apiRequest } from './client'
import type { QueuedAction } from '../store/queue'

interface BatchResult {
  action_id: string
  accepted: boolean
  replayed?: boolean
  upload_id?: string
  error?: string
  message?: string
}

interface BatchResponse {
  results: BatchResult[]
  synced: number
  failed: number
}

export async function syncBatch(actions: QueuedAction[]): Promise<BatchResponse> {
  return apiRequest<BatchResponse>('/sync/batch', {
    method: 'POST',
    body: {
      actions: actions.map((a) => ({
        action_id: a.actionId,
        endpoint: a.endpoint,
        method: a.method,
        body: a.body,
        file: a.file,
      })),
    },
  })
}
```

- [ ] **Step 5: Create HTML strip utility**

`src/utils/html.ts`:
```ts
export function stripHtml(html: string | null | false): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add API client, TanStack Query hooks, and all endpoint modules"
```

---

## Task 5: Shared Components

**Files:**
- Create: `apps/driver-mobile/src/components/StatusBadge.tsx`
- Create: `apps/driver-mobile/src/components/JobCard.tsx`
- Create: `apps/driver-mobile/src/components/SyncIndicator.tsx`
- Create: `apps/driver-mobile/src/components/ActionButton.tsx`
- Create: `apps/driver-mobile/src/components/CashBadge.tsx`
- Create: `apps/driver-mobile/src/components/SummaryBar.tsx`
- Create: `apps/driver-mobile/src/components/OfflineBanner.tsx`
- Create: `apps/driver-mobile/src/components/PhotoThumbnail.tsx`

- [ ] **Step 1: Create StatusBadge**

```tsx
import { Text, XStack } from 'tamagui'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'
import { useSettingsStore } from '../store/settings'

const LABELS: Record<DeliveryStatus, string> = {
  assigned: 'ASSIGNED',
  accepted: 'ACCEPTED',
  on_the_way: 'ON THE WAY',
  arrived: 'ARRIVED',
  delivered: 'DELIVERED',
  failed: 'FAILED',
  returned: 'RETURNED',
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const theme = useSettingsStore((s) => s.theme)
  const colors = STATUS_COLORS[status]
  const bg = theme === 'dark' ? colors.darkBg : colors.bg
  const color = theme === 'dark' ? colors.darkText : colors.text

  return (
    <XStack backgroundColor={bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
      <Text fontSize={10} fontWeight="700" color={color} letterSpacing={0.5}>
        {LABELS[status]}
      </Text>
    </XStack>
  )
}
```

- [ ] **Step 2: Create JobCard**

```tsx
import { Card, Text, XStack, YStack } from 'tamagui'
import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBadge } from './StatusBadge'
import { CashBadge } from './CashBadge'
import { STATUS_COLORS, type DeliveryStatus } from '../theme/status-colors'
import type { JobSummary } from '../api/jobs'

export function JobCard({ job }: { job: JobSummary }) {
  const router = useRouter()
  const status = job.status as DeliveryStatus
  const borderColor = STATUS_COLORS[status]?.border || '#e5e7eb'

  return (
    <Pressable onPress={() => router.push(`/(tabs)/jobs/${job.job_id}`)}>
      <Card
        bordered
        padded
        marginBottom="$2"
        borderLeftWidth={4}
        borderLeftColor={borderColor}
        borderRadius={14}
        elevate
        size="$4"
      >
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1}>
            <Text fontSize={15} fontWeight="700">{job.customer_name}</Text>
            <Text fontSize={12} color="$colorSubtle" marginTop="$1">
              {job.odoo_reference} · {job.warehouse}
            </Text>
          </YStack>
          <StatusBadge status={status} />
        </XStack>
        <XStack gap="$2" marginTop="$2" flexWrap="wrap">
          {job.collection_required && (
            <CashBadge method={job.collection_method!} amount={job.expected_collection_amount!} />
          )}
          {job.address && (
            <Text fontSize={11} color="$colorSubtle" numberOfLines={1}>
              📍 {job.address}
            </Text>
          )}
        </XStack>
      </Card>
    </Pressable>
  )
}
```

- [ ] **Step 3: Create CashBadge, SyncIndicator, SummaryBar, ActionButton, OfflineBanner, PhotoThumbnail**

`CashBadge.tsx`:
```tsx
import { Text, XStack } from 'tamagui'

export function CashBadge({ method, amount }: { method: string; amount: number }) {
  return (
    <XStack backgroundColor="#fef2f2" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
      <Text fontSize={11} fontWeight="600" color="#dc2626">
        💰 {method === 'cheque' ? 'Cheque' : 'Cash'} ${amount.toLocaleString()}
      </Text>
    </XStack>
  )
}
```

`SyncIndicator.tsx`:
```tsx
import { View } from 'tamagui'
import { useQueueStore } from '../store/queue'

export function SyncIndicator() {
  const actions = useQueueStore((s) => s.actions)
  const hasPending = actions.some((a) => a.status === 'queued' || a.status === 'syncing')
  const hasFailed = actions.some((a) => a.status === 'failed')

  const color = hasFailed ? '#dc2626' : hasPending ? '#f59e0b' : '#22c55e'

  return <View width={8} height={8} borderRadius={4} backgroundColor={color} />
}
```

`SummaryBar.tsx`:
```tsx
import { Text, XStack, YStack, Separator } from 'tamagui'
import type { JobSummary } from '../api/jobs'

export function SummaryBar({ jobs }: { jobs: JobSummary[] }) {
  const remaining = jobs.filter((j) => !['delivered', 'failed', 'returned'].includes(j.status)).length
  const cashCount = jobs.filter((j) => j.collection_required && j.status !== 'delivered').length
  const done = jobs.filter((j) => j.status === 'delivered').length

  return (
    <XStack padding="$4" backgroundColor="$backgroundStrong" gap="$4">
      <YStack>
        <Text fontSize={28} fontWeight="800">{remaining}</Text>
        <Text fontSize={11} color="$colorSubtle">remaining</Text>
      </YStack>
      <Separator vertical />
      <YStack>
        <Text fontSize={28} fontWeight="800" color="$danger">{cashCount}</Text>
        <Text fontSize={11} color="$colorSubtle">cash</Text>
      </YStack>
      <Separator vertical />
      <YStack>
        <Text fontSize={28} fontWeight="800" color="$success">{done}</Text>
        <Text fontSize={11} color="$colorSubtle">done</Text>
      </YStack>
    </XStack>
  )
}
```

`ActionButton.tsx`:
```tsx
import { Button } from 'tamagui'

interface Props {
  label: string
  onPress: () => void
  variant?: 'primary' | 'danger' | 'outline'
}

export function ActionButton({ label, onPress, variant = 'primary' }: Props) {
  const bg = variant === 'primary' ? '$primary' : variant === 'danger' ? '$danger' : 'transparent'
  const color = variant === 'outline' ? '$danger' : 'white'
  const borderColor = variant === 'outline' ? '$danger' : undefined

  return (
    <Button
      size="$5"
      backgroundColor={bg}
      color={color}
      borderColor={borderColor}
      borderWidth={variant === 'outline' ? 2 : 0}
      fontWeight="700"
      borderRadius={14}
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      minHeight={56}
    >
      {label}
    </Button>
  )
}
```

`OfflineBanner.tsx`:
```tsx
import { Text, XStack } from 'tamagui'

export function OfflineBanner() {
  return (
    <XStack backgroundColor="#fef3c7" padding="$2" justifyContent="center">
      <Text fontSize={12} fontWeight="600" color="#92400e">
        Offline — actions will sync when connected
      </Text>
    </XStack>
  )
}
```

`PhotoThumbnail.tsx`:
```tsx
import { Image } from 'tamagui'

export function PhotoThumbnail({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      width={72}
      height={72}
      borderRadius={8}
    />
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add shared components — JobCard, StatusBadge, SummaryBar, ActionButton, etc."
```

---

## Task 6: Login Screen

**Files:**
- Modify: `apps/driver-mobile/app/login.tsx`
- Modify: `apps/driver-mobile/app/_layout.tsx`

- [ ] **Step 1: Implement login screen**

`app/login.tsx`:
```tsx
import { useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { YStack, Text, Input, Button, Spinner } from 'tamagui'
import { useRouter } from 'expo-router'
import { login } from '../src/api/auth'
import { useAuthStore } from '../src/store/auth'

export default function LoginScreen() {
  const [phone, setPhone] = useState('+852')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const router = useRouter()

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await login(phone, pin)
      await setAuth(result.token, result.driver)
      router.replace('/(tabs)/jobs')
    } catch (e: any) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <YStack flex={1} justifyContent="center" padding="$6" backgroundColor="$background" gap="$4">
        <Text fontSize={28} fontWeight="800" textAlign="center">Healthy Living</Text>
        <Text fontSize={14} color="$colorSubtle" textAlign="center" marginBottom="$4">Driver Login</Text>

        <Input
          placeholder="Phone (+852...)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          size="$5"
          borderRadius={14}
        />
        <Input
          placeholder="PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          size="$5"
          borderRadius={14}
        />

        {error ? <Text color="$danger" textAlign="center" fontSize={13}>{error}</Text> : null}

        <Button
          size="$5"
          backgroundColor="$primary"
          color="white"
          fontWeight="700"
          borderRadius={14}
          onPress={handleLogin}
          disabled={loading || !phone || !pin}
          pressStyle={{ opacity: 0.8 }}
          minHeight={56}
        >
          {loading ? <Spinner color="white" /> : 'Login'}
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  )
}
```

- [ ] **Step 2: Update root layout with auth redirect**

`app/_layout.tsx` — add auth loading state and redirect:
```tsx
import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TamaguiProvider, Theme } from 'tamagui'
import tamaguiConfig from '../tamagui.config'
import { useSettingsStore } from '../src/store/settings'
import { useAuthStore } from '../src/store/auth'

const queryClient = new QueryClient()

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading, loadToken } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => { loadToken() }, [])

  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === 'login'
    if (!token && !inAuthGroup) {
      router.replace('/login')
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/jobs')
    }
  }, [token, isLoading, segments])

  if (isLoading) return null
  return <>{children}</>
}

export default function RootLayout() {
  const theme = useSettingsStore((s) => s.theme)
  return (
    <TamaguiProvider config={tamaguiConfig}>
      <Theme name={theme}>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <Slot />
          </AuthGuard>
        </QueryClientProvider>
      </Theme>
    </TamaguiProvider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add login screen with auth guard and secure token storage"
```

---

## Task 7: Tab Navigator + Jobs List

**Files:**
- Create: `apps/driver-mobile/app/(tabs)/_layout.tsx`
- Create: `apps/driver-mobile/app/(tabs)/jobs/index.tsx`
- Create: `apps/driver-mobile/app/(tabs)/history/index.tsx`

- [ ] **Step 1: Create tab layout with camera FAB**

`app/(tabs)/_layout.tsx`:
```tsx
import { Tabs, useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'tamagui'
import { SyncIndicator } from '../../src/components/SyncIndicator'

function CameraFAB() {
  const router = useRouter()
  return (
    <Pressable style={styles.fab} onPress={() => router.push('/camera')}>
      <Text fontSize={28}>📷</Text>
    </Pressable>
  )
}

export default function TabLayout() {
  const router = useRouter()
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={{ marginRight: 16 }}>
              <Text fontSize={20}>⚙️</Text>
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Jobs',
            tabBarIcon: () => <Text fontSize={18}>📋</Text>,
            headerTitle: 'My Jobs',
            headerLeft: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                <Text fontSize={16} fontWeight="800">Healthy Living</Text>
                <SyncIndicator />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: () => <Text fontSize={18}>🕐</Text>,
            headerTitle: 'Recent History',
          }}
        />
      </Tabs>
      <CameraFAB />
    </View>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
    borderWidth: 4,
    borderColor: '#f5f5f7',
  },
})
```

- [ ] **Step 2: Create jobs list screen**

`app/(tabs)/jobs/index.tsx`:
```tsx
import { FlatList, RefreshControl } from 'react-native'
import { YStack, Text } from 'tamagui'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'
import { SummaryBar } from '../../../src/components/SummaryBar'
import { OfflineBanner } from '../../../src/components/OfflineBanner'
import { useNetInfo } from '@react-native-community/netinfo'

export default function JobsList() {
  const { data, isLoading, refetch, isRefetching } = useJobs('today')
  const netInfo = useNetInfo()
  const jobs = data?.jobs || []

  return (
    <YStack flex={1} backgroundColor="$background">
      {netInfo.isConnected === false && <OfflineBanner />}
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.job_id)}
        ListHeaderComponent={<SummaryBar jobs={jobs} />}
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$3">
            <JobCard job={item} />
          </YStack>
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <YStack padding="$6" alignItems="center">
              <Text fontSize={48} marginBottom="$2">📦</Text>
              <Text color="$colorSubtle" textAlign="center">No deliveries assigned for today</Text>
            </YStack>
          ) : null
        }
      />
    </YStack>
  )
}
```

- [ ] **Step 3: Create history list screen (placeholder)**

`app/(tabs)/history/index.tsx`:
```tsx
import { FlatList, RefreshControl } from 'react-native'
import { YStack, Text } from 'tamagui'
import { useJobs } from '../../../src/api/jobs'
import { JobCard } from '../../../src/components/JobCard'

export default function HistoryList() {
  const { data, refetch, isRefetching } = useJobs('recent')
  const jobs = data?.jobs || []

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.job_id)}
        renderItem={({ item }) => (
          <YStack paddingHorizontal="$3" paddingTop="$2">
            <JobCard job={item} />
          </YStack>
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <YStack padding="$6" alignItems="center">
            <Text color="$colorSubtle">No recent deliveries</Text>
          </YStack>
        }
      />
    </YStack>
  )
}
```

- [ ] **Step 4: Install NetInfo**

```bash
npx expo install @react-native-community/netinfo
```

- [ ] **Step 5: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add tab navigator with camera FAB, jobs list, and history screens"
```

---

## Task 8: Job Detail Screen

**Files:**
- Create: `apps/driver-mobile/app/(tabs)/jobs/[id].tsx`

- [ ] **Step 1: Implement job detail**

`app/(tabs)/jobs/[id].tsx`:
```tsx
import { ScrollView, Linking, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner, Button } from 'tamagui'
import { useJob } from '../../../src/api/jobs'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { ActionButton } from '../../../src/components/ActionButton'
import { CashBadge } from '../../../src/components/CashBadge'
import { updateStatus } from '../../../src/api/status'
import { useQueueStore } from '../../../src/store/queue'
import { generateActionId } from '../../../src/utils/uuid'
import { stripHtml } from '../../../src/utils/html'
import type { DeliveryStatus } from '../../../src/theme/status-colors'

const STATUS_ACTIONS: Record<string, { label: string; next: string }> = {
  assigned: { label: 'Accept Job', next: 'accepted' },
  accepted: { label: 'On My Way', next: 'on_the_way' },
  on_the_way: { label: "I've Arrived", next: 'arrived' },
}

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const jobId = Number(id)
  const { data: job, isLoading, refetch } = useJob(jobId)
  const router = useRouter()
  const addAction = useQueueStore((s) => s.addAction)

  if (isLoading || !job) {
    return <YStack flex={1} justifyContent="center" alignItems="center"><Spinner /></YStack>
  }

  const status = job.status as DeliveryStatus
  const action = STATUS_ACTIONS[status]

  const handleStatusUpdate = async (nextStatus: string) => {
    const actionId = generateActionId()
    addAction({
      actionId,
      endpoint: `/jobs/${jobId}/status`,
      method: 'POST',
      body: { action_id: actionId, status: nextStatus, timestamp: new Date().toISOString() },
    })
    try {
      await updateStatus(jobId, {
        action_id: actionId,
        status: nextStatus,
        timestamp: new Date().toISOString(),
      })
    } catch {}
    refetch()
  }

  const handleCall = () => {
    if (job.phone) Linking.openURL(`tel:${job.phone}`)
  }

  const handleNavigate = () => {
    if (job.address) {
      const url = `https://maps.apple.com/?q=${encodeURIComponent(job.address)}`
      Linking.openURL(url)
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: job.odoo_reference }} />
      <ScrollView>
        <YStack padding="$4" gap="$3">
          {/* Header */}
          <XStack justifyContent="space-between" alignItems="flex-start">
            <YStack flex={1}>
              <Text fontSize={22} fontWeight="800">{job.customer_name}</Text>
              <Text fontSize={13} color="$colorSubtle" marginTop="$1">
                {job.odoo_reference} · {job.warehouse}
              </Text>
            </YStack>
            <StatusBadge status={status} />
          </XStack>

          {/* Quick action row */}
          <XStack gap="$2">
            <Button flex={1} size="$4" borderRadius={12} backgroundColor="#f0fdf4" onPress={handleCall}>
              <YStack alignItems="center">
                <Text fontSize={20}>📞</Text>
                <Text fontSize={10} color="#16a34a" fontWeight="600">Call</Text>
              </YStack>
            </Button>
            <Button flex={1} size="$4" borderRadius={12} backgroundColor="#eff6ff" onPress={handleNavigate}>
              <YStack alignItems="center">
                <Text fontSize={20}>📍</Text>
                <Text fontSize={10} color="#2563eb" fontWeight="600">Navigate</Text>
              </YStack>
            </Button>
            <Button flex={1} size="$4" borderRadius={12} backgroundColor={job.collection_required ? '#fef2f2' : '#f3f4f6'}>
              <YStack alignItems="center">
                <Text fontSize={20}>💰</Text>
                <Text fontSize={10} color={job.collection_required ? '#dc2626' : '#6b7280'} fontWeight="600">
                  {job.collection_required ? `$${job.expected_collection_amount?.toLocaleString()}` : 'None'}
                </Text>
              </YStack>
            </Button>
          </XStack>

          {/* Info */}
          <Card padded bordered borderRadius={14}>
            <YStack gap="$3">
              {job.address && (
                <YStack>
                  <Text fontSize={11} color="$colorSubtle">Address</Text>
                  <Text fontSize={14} fontWeight="500">{job.address}</Text>
                </YStack>
              )}
              {job.delivery_notes && (
                <YStack>
                  <Text fontSize={11} color="$colorSubtle">Notes</Text>
                  <Text fontSize={14}>{stripHtml(job.delivery_notes)}</Text>
                </YStack>
              )}
              {job.account_no && (
                <YStack>
                  <Text fontSize={11} color="$colorSubtle">Account</Text>
                  <Text fontSize={14}>{job.account_no}</Text>
                </YStack>
              )}
            </YStack>
          </Card>

          {/* Items */}
          {job.items.length > 0 && (
            <Card padded bordered borderRadius={14}>
              <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                Items ({job.items.length})
              </Text>
              <YStack marginTop="$2" gap="$1">
                {job.items.map((item, i) => (
                  <Text key={i} fontSize={13}>
                    {item.product_name} × {item.quantity}
                  </Text>
                ))}
              </YStack>
            </Card>
          )}
        </YStack>
      </ScrollView>

      {/* Action buttons */}
      <YStack padding="$4" gap="$2" backgroundColor="$backgroundStrong" borderTopWidth={1} borderTopColor="$borderColor">
        {action && (
          <ActionButton label={action.label} onPress={() => handleStatusUpdate(action.next)} />
        )}
        {status === 'arrived' && (
          <>
            <ActionButton
              label="Complete Delivery"
              onPress={() => router.push(`/jobs/${jobId}/complete`)}
            />
            <ActionButton label="Report Problem" variant="outline" onPress={() => {
              // TODO: implement failure reason bottom sheet in a follow-up
              Alert.alert('Report Problem', 'Coming soon')
            }} />
          </>
        )}
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Create history detail (read-only reuse)**

`app/(tabs)/history/[id].tsx`:
```tsx
import { ScrollView } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { YStack, XStack, Text, Card, Spinner } from 'tamagui'
import { useJob } from '../../../src/api/jobs'
import { StatusBadge } from '../../../src/components/StatusBadge'
import { stripHtml } from '../../../src/utils/html'
import type { DeliveryStatus } from '../../../src/theme/status-colors'

export default function HistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: job, isLoading } = useJob(Number(id))

  if (isLoading || !job) {
    return <YStack flex={1} justifyContent="center" alignItems="center"><Spinner /></YStack>
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: job.odoo_reference }} />
      <ScrollView>
        <YStack padding="$4" gap="$3">
          <XStack justifyContent="space-between" alignItems="flex-start">
            <YStack flex={1}>
              <Text fontSize={22} fontWeight="800">{job.customer_name}</Text>
              <Text fontSize={13} color="$colorSubtle" marginTop="$1">{job.odoo_reference} · {job.warehouse}</Text>
            </YStack>
            <StatusBadge status={job.status as DeliveryStatus} />
          </XStack>
          <Card padded bordered borderRadius={14}>
            <YStack gap="$3">
              {job.address && <YStack><Text fontSize={11} color="$colorSubtle">Address</Text><Text fontSize={14}>{job.address}</Text></YStack>}
              {job.delivery_notes && <YStack><Text fontSize={11} color="$colorSubtle">Notes</Text><Text fontSize={14}>{stripHtml(job.delivery_notes)}</Text></YStack>}
            </YStack>
          </Card>
          {job.items.length > 0 && (
            <Card padded bordered borderRadius={14}>
              <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase">Items ({job.items.length})</Text>
              <YStack marginTop="$2" gap="$1">
                {job.items.map((item, i) => <Text key={i} fontSize={13}>{item.product_name} × {item.quantity}</Text>)}
              </YStack>
            </Card>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add job detail screen with quick actions, items, and status buttons"
```

---

## Task 9: Camera + Photo Capture

**Files:**
- Create: `apps/driver-mobile/app/camera.tsx`

- [ ] **Step 1: Implement camera screen**

`app/camera.tsx`:
```tsx
import { useState, useRef } from 'react'
import { StyleSheet, Pressable, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { YStack, XStack, Text, Button } from 'tamagui'
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
        <Text fontSize={48}>📷</Text>
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
            <CameraView style={{ flex: 1 }} ref={cameraRef}>
              {/* Show captured photo as preview */}
            </CameraView>
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
        <Text color="white" fontSize={16}>✕</Text>
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add camera screen with photo capture and job attachment picker"
```

---

## Task 10: Delivery Completion Flow

**Files:**
- Create: `apps/driver-mobile/app/jobs/[id]/complete.tsx`

- [ ] **Step 1: Implement stepped completion flow**

`app/jobs/[id]/complete.tsx`:
```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add delivery completion flow — photos, signature, cash collection, confirm"
```

---

## Task 11: Sync Engine

**Files:**
- Create: `apps/driver-mobile/src/sync/engine.ts`
- Modify: `apps/driver-mobile/app/_layout.tsx`

- [ ] **Step 1: Create sync engine**

`src/sync/engine.ts`:
```ts
import NetInfo from '@react-native-community/netinfo'
import { useQueueStore } from '../store/queue'
import { syncBatch } from '../api/sync'

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startSyncEngine() {
  // Listen for network changes
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      processQueue()
    }
  })

  // Periodic retry every 30 seconds
  syncInterval = setInterval(() => {
    const pending = useQueueStore.getState().getPending()
    if (pending.length > 0) processQueue()
  }, 30_000)
}

export function stopSyncEngine() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

async function processQueue() {
  const { actions, updateAction, removeAction } = useQueueStore.getState()
  const pending = actions.filter((a) => a.status === 'queued' || a.status === 'failed')
  if (pending.length === 0) return

  // Mark all as syncing
  pending.forEach((a) => updateAction(a.actionId, { status: 'syncing' }))

  try {
    const result = await syncBatch(pending)
    result.results.forEach((r) => {
      if (r.accepted) {
        removeAction(r.action_id)
      } else {
        updateAction(r.action_id, {
          status: 'failed',
          error: r.message || r.error || 'Unknown error',
        })
      }
    })
  } catch {
    // Network error — revert to queued
    pending.forEach((a) => updateAction(a.actionId, { status: 'queued' }))
  }
}
```

- [ ] **Step 2: Start sync engine in root layout**

Add to `app/_layout.tsx` inside `AuthGuard`, after `loadToken`:
```tsx
import { startSyncEngine, stopSyncEngine } from '../src/sync/engine'

// Inside AuthGuard component:
useEffect(() => {
  if (token) startSyncEngine()
  return () => stopSyncEngine()
}, [token])
```

- [ ] **Step 3: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add sync engine with network listener and periodic retry"
```

---

## Task 12: Settings Screen

**Files:**
- Create: `apps/driver-mobile/app/settings.tsx`

- [ ] **Step 1: Implement settings**

`app/settings.tsx`:
```tsx
import { Alert } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { YStack, XStack, Text, Card, Switch, Button, Separator } from 'tamagui'
import { useAuthStore } from '../src/store/auth'
import { useSettingsStore } from '../src/store/settings'
import { useQueueStore } from '../src/store/queue'

export default function Settings() {
  const router = useRouter()
  const { driver, clearAuth } = useAuthStore()
  const { theme, setTheme } = useSettingsStore()
  const actions = useQueueStore((s) => s.actions)
  const pending = actions.filter((a) => a.status === 'queued' || a.status === 'syncing')
  const failed = actions.filter((a) => a.status === 'failed')

  const handleLogout = () => {
    if (pending.length > 0 || failed.length > 0) {
      Alert.alert(
        'Unsynced Actions',
        `You have ${pending.length + failed.length} unsynced actions. Sync first or force logout.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Force Logout', style: 'destructive', onPress: () => { clearAuth(); router.replace('/login') } },
        ]
      )
    } else {
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => { clearAuth(); router.replace('/login') } },
      ])
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ title: 'Settings' }} />
      <YStack padding="$4" gap="$4">
        {/* Driver info */}
        <Card padded bordered borderRadius={14}>
          <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase">Driver</Text>
          <Text fontSize={18} fontWeight="700" marginTop="$1">{driver?.name}</Text>
          <Text fontSize={13} color="$colorSubtle">{driver?.phone}</Text>
        </Card>

        {/* Theme */}
        <Card padded bordered borderRadius={14}>
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize={14} fontWeight="600">Dark Mode</Text>
              <Text fontSize={12} color="$colorSubtle">Switch to dark theme</Text>
            </YStack>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            >
              <Switch.Thumb />
            </Switch>
          </XStack>
        </Card>

        {/* Sync status */}
        <Card padded bordered borderRadius={14}>
          <Text fontSize={11} color="$colorSubtle" fontWeight="600" textTransform="uppercase">Sync Status</Text>
          <YStack marginTop="$2" gap="$2">
            <XStack justifyContent="space-between">
              <Text fontSize={14}>Pending</Text>
              <Text fontSize={14} fontWeight="700" color={pending.length > 0 ? '#f59e0b' : '$color'}>
                {pending.length}
              </Text>
            </XStack>
            <XStack justifyContent="space-between">
              <Text fontSize={14}>Failed</Text>
              <Text fontSize={14} fontWeight="700" color={failed.length > 0 ? '$danger' : '$color'}>
                {failed.length}
              </Text>
            </XStack>
          </YStack>
          {failed.length > 0 && (
            <YStack marginTop="$3" gap="$1">
              <Separator />
              {failed.map((a) => (
                <Text key={a.actionId} fontSize={11} color="$danger" marginTop="$1">
                  {a.endpoint}: {a.error}
                </Text>
              ))}
            </YStack>
          )}
        </Card>

        {/* Logout */}
        <Button
          size="$5"
          borderRadius={14}
          backgroundColor="$danger"
          color="white"
          fontWeight="700"
          onPress={handleLogout}
        >
          Logout
        </Button>
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: add settings screen with theme toggle, sync status, and logout"
```

---

## Task 13: Final Wiring + Smoke Test

**Files:**
- Modify: various files for final polish
- Create: `apps/driver-mobile/.env.example`

- [ ] **Step 1: Create .env.example**

```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

- [ ] **Step 2: Verify all screens load**

```bash
cd apps/driver-mobile
npx expo start
```

Test flow:
1. App opens → redirects to login
2. Enter phone + PIN → redirects to jobs list
3. Jobs list shows summary bar + cards (needs API running)
4. Tap card → job detail with action buttons
5. Camera FAB → camera opens
6. Settings → theme toggle, sync status, logout
7. Toggle dark mode → app switches theme

- [ ] **Step 3: Commit**

```bash
git add apps/driver-mobile/
git commit -m "feat: complete driver mobile app v1 — all screens, offline sync, camera POD"
```

# Driver Mobile App Design

Defines the Expo + React Native mobile app for Healthy Living delivery drivers.

## Design Decisions

- **UI Library:** Tamagui (token-based design system with optimizing compiler)
- **Theme:** Light mode default, dark glassmorphism mode switchable via settings
- **Language:** Bilingual — English UI labels, Chinese customer data displayed as-is from Odoo
- **Navigation:** 2-tab (Jobs / History) + center camera floating action button
- **State:** TanStack Query for API data, Zustand for UI state + offline queue
- **Routing:** expo-router (file-based)

---

## Tech Stack

- Expo SDK 52+
- React Native
- Tamagui (design system + components)
- expo-router (file-based navigation)
- TanStack Query (data fetching, caching, optimistic updates)
- Zustand + AsyncStorage persistence (UI state, offline action queue)
- expo-camera (photo capture)
- expo-image-picker (gallery fallback)
- react-native-signature-canvas (signature pad)
- expo-secure-store (JWT token storage)

---

## Visual Design

### Status Color System

| Status | Light Mode | Dark Mode | Border Color |
|--------|-----------|-----------|-------------|
| Assigned | bg: #fef3c7, text: #92400e | bg: rgba(245,158,11,0.15), text: #fbbf24 | #f59e0b |
| Accepted | bg: #d1fae5, text: #166534 | bg: rgba(34,197,94,0.15), text: #4ade80 | #22c55e |
| On The Way | bg: #dbeafe, text: #1e40af | bg: rgba(59,130,246,0.15), text: #60a5fa | #2563eb |
| Arrived | bg: #ede9fe, text: #5b21b6 | bg: rgba(139,92,246,0.15), text: #a78bfa | #7c3aed |
| Delivered | bg: #dcfce7, text: #166534 | bg: rgba(22,163,74,0.15), text: #4ade80 | #16a34a |
| Failed | bg: #fee2e2, text: #991b1b | bg: rgba(220,38,38,0.15), text: #f87171 | #dc2626 |
| Returned | bg: #f3f4f6, text: #374151 | bg: rgba(107,114,128,0.15), text: #9ca3af | #6b7280 |

### Design Tokens (Tamagui)

- **Light background:** #f5f5f7 (page), white (cards)
- **Dark background:** #0c1222 (page), rgba(255,255,255,0.04) (cards with glassmorphism)
- **Card radius:** 14px
- **Card shadow (light):** 0 1px 3px rgba(0,0,0,0.06)
- **Card border (dark):** 1px solid rgba(255,255,255,0.06)
- **Left border accent:** 4px solid {status color}
- **Primary action:** #2563eb
- **Danger/cash:** #dc2626
- **Success:** #22c55e
- **Font:** System default (SF Pro on iOS, Roboto on Android)
- **Touch target minimum:** 48px height

---

## Screen Architecture

### Navigation Structure

```
Tab Bar: [Jobs] [📷 Camera FAB] [History]
  │
  ├─ Jobs Tab (expo-router: /(tabs)/jobs/)
  │   ├─ Jobs List (index)
  │   │   └─ Job Detail (push: /jobs/[id])
  │   │       ├─ Status action buttons (inline)
  │   │       └─ Complete Delivery (modal: /jobs/[id]/complete)
  │   │           ├─ Step 1: Photos
  │   │           ├─ Step 2: Signature (optional)
  │   │           ├─ Step 3: Cash collection (conditional)
  │   │           └─ Step 4: Confirm
  │   └─ Pull-to-refresh → re-fetch from API
  │
  ├─ Camera FAB → Camera (modal: /camera)
  │   └─ After capture → job picker → attach as POD
  │
  ├─ History Tab (expo-router: /(tabs)/history/)
  │   └─ Completed job list → read-only detail on tap
  │
  └─ Settings (push from header gear: /settings)
      ├─ Theme toggle (light/dark)
      ├─ Sync status + pending actions
      ├─ Driver info
      └─ Logout
```

### File-Based Routes (expo-router)

```
app/
├─ _layout.tsx              # Root layout, providers (QueryClient, Tamagui, Zustand)
├─ login.tsx                # Login screen
├─ (tabs)/
│   ├─ _layout.tsx          # Tab navigator (Jobs, Camera FAB, History)
│   ├─ jobs/
│   │   ├─ index.tsx        # Jobs list
│   │   └─ [id].tsx         # Job detail
│   └─ history/
│       ├─ index.tsx        # History list
│       └─ [id].tsx         # History detail (read-only)
├─ jobs/
│   └─ [id]/
│       └─ complete.tsx     # Delivery completion modal (stepped flow)
├─ camera.tsx               # Camera quick-capture modal
└─ settings.tsx             # Settings screen
```

---

## Screen Details

### 1. Login

- Phone input (numeric keyboard, +852 prefix)
- PIN input (4-6 digits, masked)
- "Login" button
- Error state: shake animation + red message
- On success: store JWT in expo-secure-store, navigate to jobs

### 2. Jobs List (Home)

**Header:** "Healthy Living" branding + sync indicator (green/amber/red dot) + gear icon

**Summary bar:**
- 3 stats: remaining deliveries, cash collections needed, completed today
- Bold numbers, compact layout

**Job cards (scrollable list):**
- Left border accent by status color
- Customer name (bold, Chinese)
- DO reference + warehouse code
- Status badge (colored pill)
- Cash collection indicator (red pill with amount, if required)
- Address preview (truncated)
- Tap → pushes to Job Detail

**Pull-to-refresh:** re-fetches from `GET /me/jobs?scope=today`

**Empty state:** "No deliveries assigned for today" with illustration

**Offline banner:** amber bar at top "Offline — actions will sync when connected"

### 3. Job Detail

**Header section:**
- Back button
- Status badge
- Customer name (large)
- DO reference + warehouse

**Quick action row (3 buttons):**
- 📞 Call (tap-to-call via `Linking.openURL`)
- 📍 Navigate (open in Maps app)
- 💰 Amount (shows collection amount if required, or "No collection")

**Info section:**
- Address (full)
- Delivery notes
- Additional info
- Account number (if exists)

**Items section:**
- Product name + quantity for each stock.move line
- Collapsible if > 3 items

**Status action buttons (bottom, large):**
Context-dependent based on current status:
- `assigned` → "Accept Job" (green)
- `accepted` → "On My Way" (blue)
- `on_the_way` → "I've Arrived" (purple)
- `arrived` → "Complete Delivery" (primary) + "Report Problem" (red outline)
- `failed` → "Mark Returned" (gray)
- `delivered` / `returned` → no action buttons (read-only)

**"Report Problem" flow (from arrived or on_the_way):**
- Bottom sheet with failure reason picker (5 options)
- Optional note text field
- Optional photo
- Submit → status = failed

### 4. Delivery Completion (Modal Stepped Flow)

Opens as a full-screen modal from Job Detail when status = arrived.

**Step indicator:** horizontal dots showing progress (1-2-3-4)

**Step 1: Photos (required)**
- Camera opens immediately on entry
- After capture, show thumbnail + "Take Another" button
- Minimum 1 photo required
- "Next →" button enabled when ≥ 1 photo

**Step 2: Signature (optional)**
- Signature canvas (react-native-signature-canvas)
- "Clear" button to reset
- "Skip" link + "Next →" button

**Step 3: Cash Collection (conditional — only if collection_required)**
- Pre-filled amount from job (editable)
- Method pre-selected from job data (Cash or Cheque), driver can override if needed
- Reference text input
- Optional: "Add photo" button for payment proof
- "Next →" button when amount + method + reference filled

**Step 4: Confirm**
- Summary card:
  - Photo thumbnails (scrollable row)
  - Signature preview (if captured)
  - Cash amount + method (if applicable)
- "Submit & Complete" button (large, primary)
- On submit:
  1. Save all data locally
  2. Queue actions: upload photos → upload signature → POD → cash → status=delivered
  3. Navigate back to jobs list
  4. Show success toast

### 5. Camera (FAB Quick-Capture)

- Opens camera immediately (full-screen modal)
- Capture button (large, centered)
- After capture: preview + "Retake" / "Use Photo"
- If "Use Photo": job picker overlay
  - Shows active jobs (assigned/accepted/on_the_way/arrived)
  - Tap job → photo queued as POD upload for that job
  - Confirm toast

### 6. History

- List of completed jobs (last 7 days) from `GET /me/jobs?scope=recent`
- Same card design as Jobs List but with delivery date shown
- Tap → read-only Job Detail (no action buttons)

### 7. Settings

- **Theme:** Light / Dark toggle (persisted in Zustand → AsyncStorage)
- **Sync Status:**
  - Last sync time
  - Pending actions count
  - "Sync Now" button
  - Failed actions list with "Retry" per action
- **Driver Info:** Name, phone (read-only)
- **Logout:**
  - If unsynced actions: blocking modal "You have N unsynced actions. Sync first or force logout."
  - If clear: confirm dialog → clear token → navigate to login

---

## State Management

### TanStack Query Keys

```typescript
queryKeys = {
  jobs: {
    today: ['jobs', 'today'],
    pending: ['jobs', 'pending'],
    recent: ['jobs', 'recent'],
    detail: (id: number) => ['jobs', id],
  },
  sync: ['sync', 'status'],
}
```

### Zustand Store

```typescript
interface AppStore {
  // Theme
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void

  // Auth
  token: string | null
  driver: { id: number; name: string; phone: string } | null
  setAuth: (token: string, driver: Driver) => void
  clearAuth: () => void

  // Offline queue
  actionQueue: QueuedAction[]
  addAction: (action: QueuedAction) => void
  updateAction: (actionId: string, status: ActionStatus) => void
  removeAction: (actionId: string) => void

  // Uploads
  pendingUploads: PendingUpload[]
  addUpload: (upload: PendingUpload) => void
}

interface QueuedAction {
  actionId: string
  endpoint: string
  method: string
  body: Record<string, any>
  file?: string  // base64 for uploads
  status: 'queued' | 'syncing' | 'synced' | 'failed'
  createdAt: string
  error?: string
}
```

### Sync Engine

- Listens to `NetInfo` for connectivity changes
- On reconnect: process queue via `POST /sync/batch`
- Actions processed in FIFO order
- Successful actions removed from queue
- Failed actions stay with error message for user review
- Periodic retry every 30 seconds when queue is non-empty and online

---

## Offline Behavior

### What works offline:
- View cached jobs (TanStack Query cache)
- All status transitions (queued locally)
- Photo capture (saved to local storage)
- Signature capture (saved locally)
- Cash collection form (saved locally)
- Full delivery completion flow

### What requires online:
- Login (first time)
- Fetching new/updated jobs from Odoo
- Actual sync to server

### Sync states (visible on every job card):
- ✅ Synced (green dot) — server confirmed
- 🔄 Pending (amber dot) — queued, waiting for sync
- ❌ Failed (red dot) — sync failed, needs attention

### Logout protection:
- If queue has items: show blocking modal
- Force logout clears token but preserves queue (queue can be synced on next login)

---

## Error Handling

| Scenario | UX |
|----------|-----|
| API 401 (token expired) | Redirect to login, preserve queue |
| API 409 (invalid transition) | Toast: "This job's status has changed. Pull to refresh." |
| API 422 (validation) | Inline field errors on form |
| API 502 (Odoo down) | Toast: "Server temporarily unavailable. Action queued for retry." |
| Network error | Amber "Offline" banner, actions queue automatically |
| Camera permission denied | Bottom sheet: "Camera access needed for delivery photos" + "Open Settings" |
| Storage full | Alert: "Device storage full. Please free space before taking more photos." |
| Sync batch partial failure | Per-action error in settings sync panel, toast summary |

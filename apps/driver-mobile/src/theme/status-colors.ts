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

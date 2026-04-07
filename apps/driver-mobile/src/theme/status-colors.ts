export const STATUS_COLORS = {
  assigned:   { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', darkBg: 'rgba(245,158,11,0.15)', darkText: '#FBBF24', filled: '#F59E0B', filledText: '#FFFFFF' },
  accepted:   { bg: '#D1FAE5', text: '#166534', border: '#22C55E', darkBg: 'rgba(34,197,94,0.15)', darkText: '#4ADE80', filled: '#22C55E', filledText: '#FFFFFF' },
  on_the_way: { bg: '#DBEAFE', text: '#1E40AF', border: '#2563EB', darkBg: 'rgba(59,130,246,0.15)', darkText: '#60A5FA', filled: '#2563EB', filledText: '#FFFFFF' },
  arrived:    { bg: '#EDE9FE', text: '#5B21B6', border: '#7C3AED', darkBg: 'rgba(139,92,246,0.15)', darkText: '#A78BFA', filled: '#7C3AED', filledText: '#FFFFFF' },
  delivered:  { bg: '#DCFCE7', text: '#166534', border: '#16A34A', darkBg: 'rgba(22,163,74,0.15)', darkText: '#4ADE80', filled: '#16A34A', filledText: '#FFFFFF' },
  failed:     { bg: '#FEE2E2', text: '#991B1B', border: '#DC2626', darkBg: 'rgba(220,38,38,0.15)', darkText: '#F87171', filled: '#DC2626', filledText: '#FFFFFF' },
  returned:   { bg: '#F3F4F6', text: '#374151', border: '#6B7280', darkBg: 'rgba(107,114,128,0.15)', darkText: '#9CA3AF', filled: '#6B7280', filledText: '#FFFFFF' },
} as const

export type DeliveryStatus = keyof typeof STATUS_COLORS

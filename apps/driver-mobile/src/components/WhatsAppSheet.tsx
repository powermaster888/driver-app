import React from 'react'
import { Modal, Pressable, Linking } from 'react-native'
import { YStack, XStack, Text } from 'tamagui'
import { MessageCircle, MapPin, Bell, Calendar, PenLine, X, Send } from 'lucide-react-native'

interface WhatsAppMessage {
  icon: React.ReactNode
  label: string
  sublabel: string
  message: string
}

interface Props {
  visible: boolean
  onClose: () => void
  phone: string
  customerName: string
  odooReference: string
  status: string
}

function getMessages(status: string, customerName: string, odooReference: string): WhatsAppMessage[] {
  const greeting = `您好！我是盈康醫療的送貨員。\nHello! I'm the delivery driver from Healthy Living.`

  const statusMessages: Record<string, WhatsAppMessage[]> = {
    accepted: [
      {
        icon: <MessageCircle size={18} color="#16a34a" />,
        label: 'Confirm delivery',
        sublabel: '確認今天送貨及收貨時間',
        message: `${greeting}\n\n今天會為您送貨，訂單編號 ${odooReference}。請問方便收貨嗎？\nYour order ${odooReference} will be delivered today. Will you be available?`,
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: 'Confirm address',
        sublabel: '確認送貨地址',
        message: `${greeting}\n\n想確認訂單 ${odooReference} 的送貨地址，請問地址正確嗎？\nI'd like to confirm the delivery address for order ${odooReference}. Is the address correct?`,
      },
    ],
    on_the_way: [
      {
        icon: <MessageCircle size={18} color="#25D366" />,
        label: 'On my way (15-30min)',
        sublabel: '正前往送貨，約15-30分鐘到達',
        message: `${greeting}\n\n我正前往為您送貨，訂單編號 ${odooReference}，預計約15-30分鐘到達。\nI'm on my way with your order ${odooReference}, ETA approximately 15-30 minutes.`,
      },
      {
        icon: <MapPin size={18} color="#f59e0b" />,
        label: "Can't find address",
        sublabel: '找不到地址，需要更多資訊',
        message: `${greeting}\n\n我正在尋找您的地址，訂單編號 ${odooReference}。可以告訴我詳細位置嗎？\nI'm having trouble finding your address for order ${odooReference}. Could you share more details?`,
      },
    ],
    arrived: [
      {
        icon: <Bell size={18} color="#7c3aed" />,
        label: "I've arrived",
        sublabel: '已到達您的地址',
        message: `${greeting}\n\n我已到達您的地址，訂單編號 ${odooReference}。請問您方便開門嗎？\nI've arrived at your address with order ${odooReference}. Could you please come to the door?`,
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: 'At lobby / entrance',
        sublabel: '在大堂/入口等候',
        message: `${greeting}\n\n我在大堂/入口等候，訂單編號 ${odooReference}。\nI'm waiting at the lobby/entrance with order ${odooReference}.`,
      },
    ],
    failed: [
      {
        icon: <Calendar size={18} color="#dc2626" />,
        label: 'Reschedule delivery',
        sublabel: '重新安排送貨時間',
        message: `${greeting}\n\n很抱歉今天未能成功送貨，訂單編號 ${odooReference}。請問什麼時間方便重新安排送貨？\nSorry we couldn't complete delivery for order ${odooReference} today. When would be a good time to reschedule?`,
      },
    ],
  }

  const messages = statusMessages[status] || statusMessages['accepted'] || []

  // Always add "Custom message" at the end
  messages.push({
    icon: <PenLine size={18} color="#6b7280" />,
    label: 'Custom message',
    sublabel: '自訂訊息',
    message: `${greeting}\n\n訂單編號 Order ${odooReference}\n`,
  })

  return messages
}

function openWhatsApp(phone: string, message: string) {
  // Remove spaces and ensure + prefix for international format
  const cleanPhone = phone.replace(/\s/g, '').replace(/^([^+])/, '+$1')
  const encoded = encodeURIComponent(message)
  const url = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encoded}`
  Linking.openURL(url)
}

export function WhatsAppSheet({ visible, onClose, phone, customerName, odooReference, status }: Props) {
  const messages = getMessages(status, customerName, odooReference)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        <Pressable
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
          onPress={(e) => e.stopPropagation()}
        >
          <YStack backgroundColor="$background" borderTopLeftRadius={20} borderTopRightRadius={20} padding="$4" paddingBottom="$6">
            {/* Header */}
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
              <YStack>
                <Text fontSize={16} fontWeight="700">WhatsApp {customerName}</Text>
                <Text fontSize={12} color="$colorSubtle">{phone}</Text>
              </YStack>
              <Pressable onPress={onClose} style={{ padding: 8 }}>
                <X size={20} color="#9ca3af" />
              </Pressable>
            </XStack>

            {/* Quick message options */}
            <YStack gap="$2">
              {messages.map((msg, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    openWhatsApp(phone, msg.message)
                    onClose()
                  }}
                >
                  <XStack
                    backgroundColor={i === 0 ? '#f0fdf4' : '$backgroundStrong'}
                    borderRadius={12}
                    padding="$3"
                    alignItems="center"
                    gap="$3"
                    borderWidth={i === 0 ? 1 : 0}
                    borderColor={i === 0 ? '#dcfce7' : undefined}
                    pressStyle={{ opacity: 0.7 }}
                  >
                    <YStack width={36} height={36} borderRadius={10} backgroundColor={i === 0 ? '#dcfce7' : '#f3f4f6'} alignItems="center" justifyContent="center">
                      {msg.icon}
                    </YStack>
                    <YStack flex={1}>
                      <Text fontSize={13} fontWeight="600">{msg.label}</Text>
                      <Text fontSize={11} color="$colorSubtle">{msg.sublabel}</Text>
                    </YStack>
                    <YStack width={28} height={28} borderRadius={14} backgroundColor="#25D366" alignItems="center" justifyContent="center">
                      <Send size={14} color="white" />
                    </YStack>
                  </XStack>
                </Pressable>
              ))}
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

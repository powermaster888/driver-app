import React from 'react'
import { Modal, Pressable, Linking } from 'react-native'
import { YStack, XStack, Text } from 'tamagui'
import { MessageCircle, MapPin, Bell, Calendar, PenLine, X, Send, Phone, Clock } from 'lucide-react-native'

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

function msg(zh: string, en: string, ref: string): string {
  return `您好！我是盈康醫療的送貨員。\n訂單編號：${ref}\n\n${zh}\n\n---\nHello! I'm the delivery driver from Healthy Living.\nOrder: ${ref}\n\n${en}`
}

function getMessages(status: string, customerName: string, ref: string): WhatsAppMessage[] {
  const statusMessages: Record<string, WhatsAppMessage[]> = {
    assigned: [
      {
        icon: <MessageCircle size={18} color="#16a34a" />,
        label: '確認送貨',
        sublabel: 'Confirm delivery',
        message: msg('今天會為您送貨，請問方便收貨嗎？如需更改時間，請回覆此訊息。', 'Your order will be delivered today. Will you be available? Please reply if you need to change the time.', ref),
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: '確認地址',
        sublabel: 'Confirm address',
        message: msg('想確認您的送貨地址是否正確，請問地址有沒有更改？', 'I\'d like to confirm your delivery address is correct. Has anything changed?', ref),
      },
      {
        icon: <Phone size={18} color="#16a34a" />,
        label: '聯絡收貨人',
        sublabel: 'Contact recipient',
        message: msg('請問今天誰會在場收貨？方便提供收貨人的聯絡電話嗎？', 'Who will be receiving the delivery today? Could you provide a contact number for the recipient?', ref),
      },
    ],
    accepted: [
      {
        icon: <MessageCircle size={18} color="#16a34a" />,
        label: '確認送貨時間',
        sublabel: 'Confirm delivery time',
        message: msg('您好！已確認今天為您送貨，預計上午/下午到達。如需更改時間請通知我。', 'Confirmed! Your delivery is scheduled for today, expected arrival AM/PM. Let me know if you need to change the time.', ref),
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: '確認地址及上樓資訊',
        sublabel: 'Confirm address & access',
        message: msg('想確認送貨地址及大廈入口資訊。請問有沒有門禁密碼或需要聯絡管理員？', 'I\'d like to confirm the delivery address and building access. Is there a door code or do I need to contact a security guard?', ref),
      },
    ],
    on_the_way: [
      {
        icon: <MessageCircle size={18} color="#25D366" />,
        label: '正在前往（15-30分鐘）',
        sublabel: 'On my way (15-30 min)',
        message: msg('我正前往為您送貨，預計約15至30分鐘到達，請準備收貨。', 'I\'m on my way with your delivery. ETA approximately 15-30 minutes. Please be ready to receive.', ref),
      },
      {
        icon: <MessageCircle size={18} color="#2563eb" />,
        label: '正在前往（30-60分鐘）',
        sublabel: 'On my way (30-60 min)',
        message: msg('我正前往為您送貨，因交通情況預計約30至60分鐘到達。如有不便，敬請見諒。', 'I\'m on my way with your delivery. Due to traffic, ETA is approximately 30-60 minutes. Apologies for any inconvenience.', ref),
      },
      {
        icon: <MapPin size={18} color="#f59e0b" />,
        label: '找不到地址',
        sublabel: 'Can\'t find address',
        message: msg('我正在尋找您的地址，但未能找到確切位置。可否告訴我附近有什麼明顯地標或提供更詳細的位置資訊？', 'I\'m having trouble finding your address. Could you share a nearby landmark or more specific location details?', ref),
      },
      {
        icon: <Clock size={18} color="#f59e0b" />,
        label: '塞車延誤',
        sublabel: 'Traffic delay',
        message: msg('很抱歉通知您，因交通擠塞，送貨將會延遲到達。我會盡快趕到，預計遲到約15至20分鐘。', 'Sorry to inform you that due to heavy traffic, the delivery will be slightly delayed. I\'ll arrive as soon as possible, estimated 15-20 minutes late.', ref),
      },
    ],
    arrived: [
      {
        icon: <Bell size={18} color="#7c3aed" />,
        label: '已到達',
        sublabel: 'I\'ve arrived',
        message: msg('我已到達您的地址，請問方便開門收貨嗎？', 'I\'ve arrived at your address. Could you please come to the door to receive the delivery?', ref),
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: '在大堂等候',
        sublabel: 'Waiting at lobby',
        message: msg('我在大廈大堂/入口等候，請問可以下來收貨嗎？', 'I\'m waiting at the building lobby/entrance. Could you come down to receive the delivery?', ref),
      },
      {
        icon: <Phone size={18} color="#f59e0b" />,
        label: '無人應門',
        sublabel: 'No answer at door',
        message: msg('我已到達並按了門鈴，但暫時無人應門。請問您方便回覆嗎？我會再等候幾分鐘。', 'I\'ve arrived and rang the doorbell but there\'s no answer. Could you please reply? I\'ll wait a few more minutes.', ref),
      },
      {
        icon: <MessageCircle size={18} color="#16a34a" />,
        label: '放置門口',
        sublabel: 'Leave at door',
        message: msg('因無人應門，請問可否將貨物放在門口？如同意請回覆「可以」。', 'Since there\'s no answer, may I leave the delivery at the door? Please reply "Yes" to confirm.', ref),
      },
    ],
    failed: [
      {
        icon: <Calendar size={18} color="#dc2626" />,
        label: '重新安排送貨',
        sublabel: 'Reschedule delivery',
        message: msg('很抱歉今天未能成功送貨。請問什麼日期和時間方便重新安排？', 'Sorry we couldn\'t complete the delivery today. What date and time would be convenient to reschedule?', ref),
      },
      {
        icon: <MessageCircle size={18} color="#dc2626" />,
        label: '無法聯絡',
        sublabel: 'Unable to reach you',
        message: msg('我們今天嘗試送貨但未能聯絡到您。請盡快回覆此訊息以重新安排送貨時間。', 'We attempted delivery today but were unable to reach you. Please reply to this message as soon as possible to reschedule.', ref),
      },
      {
        icon: <MapPin size={18} color="#dc2626" />,
        label: '地址有誤',
        sublabel: 'Wrong address',
        message: msg('我們到達了登記的送貨地址，但未能找到您。請確認正確地址，我們會重新安排送貨。', 'We arrived at the registered delivery address but couldn\'t locate you. Please confirm the correct address and we\'ll reschedule.', ref),
      },
    ],
  }

  const messages = [...(statusMessages[status] || statusMessages['accepted'] || [])]

  messages.push({
    icon: <PenLine size={18} color="#6b7280" />,
    label: '自訂訊息',
    sublabel: 'Custom message',
    message: `您好！我是盈康醫療的送貨員。\n訂單編號：${ref}\n\n---\nHello! I'm the delivery driver from Healthy Living.\nOrder: ${ref}\n\n`,
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
              <Pressable onPress={onClose} style={{ padding: 8 }} accessibilityLabel="Close" accessibilityRole="button">
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
                  accessibilityLabel={msg.label}
                  accessibilityRole="button"
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

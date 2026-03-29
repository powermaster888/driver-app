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

function msg(emoji: string, titleZh: string, zh: string, titleEn: string, en: string, ref: string): string {
  return [
    `${emoji} *盈康醫療 Healthy Living*`,
    `📦 訂單 Order: *${ref}*`,
    ``,
    `🇭🇰 *${titleZh}*`,
    zh,
    ``,
    `────────────`,
    ``,
    `🌐 *${titleEn}*`,
    en,
    ``,
    `📞 如有查詢請回覆此訊息`,
    `_Please reply to this message if you have any questions_`,
  ].join('\n')
}

function getMessages(status: string, customerName: string, ref: string): WhatsAppMessage[] {
  const statusMessages: Record<string, WhatsAppMessage[]> = {
    assigned: [
      {
        icon: <MessageCircle size={18} color="#16a34a" />,
        label: '確認送貨',
        sublabel: 'Confirm delivery',
        message: msg('🚚', '確認送貨', '今天會為您送貨，請問方便收貨嗎？\n\n如需更改時間，請回覆此訊息。', 'Delivery Confirmation', 'Your order will be delivered today. Will you be available?\n\nPlease reply if you need to change the time.', ref),
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: '確認地址',
        sublabel: 'Confirm address',
        message: msg('📍', '確認地址', '想確認您的送貨地址是否正確。\n\n請問地址有沒有更改？', 'Address Confirmation', 'I\'d like to confirm your delivery address is correct.\n\nHas anything changed?', ref),
      },
      {
        icon: <Phone size={18} color="#16a34a" />,
        label: '聯絡收貨人',
        sublabel: 'Contact recipient',
        message: msg('👤', '聯絡收貨人', '請問今天誰會在場收貨？\n\n方便提供收貨人的聯絡電話嗎？', 'Contact Recipient', 'Who will be receiving the delivery today?\n\nCould you provide a contact number for the recipient?', ref),
      },
    ],
    accepted: [
      {
        icon: <MessageCircle size={18} color="#16a34a" />,
        label: '確認送貨時間',
        sublabel: 'Confirm delivery time',
        message: msg('🕐', '確認送貨時間', '已確認今天為您送貨。\n⏰ 預計上午/下午到達\n\n如需更改時間請通知我。', 'Delivery Time Confirmed', 'Your delivery is confirmed for today.\n⏰ Expected arrival: AM/PM\n\nLet me know if you need to change the time.', ref),
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: '確認地址及上樓資訊',
        sublabel: 'Confirm address & access',
        message: msg('🏢', '確認地址及入口資訊', '想確認送貨地址及大廈入口資訊。\n\n請問：\n• 有沒有門禁密碼？\n• 需要聯絡管理員嗎？', 'Address & Building Access', 'I\'d like to confirm the delivery address and building access.\n\nCould you let me know:\n• Is there a door code?\n• Do I need to contact security?', ref),
      },
    ],
    on_the_way: [
      {
        icon: <MessageCircle size={18} color="#25D366" />,
        label: '正在前往（15-30分鐘）',
        sublabel: 'On my way (15-30 min)',
        message: msg('🚚', '正在前往送貨', '我正前往為您送貨 🏃‍♂️\n\n⏰ 預計 *15至30分鐘* 到達\n\n請準備收貨，謝謝！', 'On My Way', 'I\'m on my way with your delivery 🏃‍♂️\n\n⏰ ETA: *15-30 minutes*\n\nPlease be ready to receive. Thank you!', ref),
      },
      {
        icon: <MessageCircle size={18} color="#2563eb" />,
        label: '正在前往（30-60分鐘）',
        sublabel: 'On my way (30-60 min)',
        message: msg('🚚', '正在前往送貨', '我正前往為您送貨。\n\n⏰ 因交通情況預計約 *30至60分鐘* 到達\n\n如有不便，敬請見諒 🙏', 'On My Way', 'I\'m on my way with your delivery.\n\n⏰ Due to traffic, ETA is approximately *30-60 minutes*\n\nApologies for any inconvenience 🙏', ref),
      },
      {
        icon: <MapPin size={18} color="#f59e0b" />,
        label: '找不到地址',
        sublabel: 'Can\'t find address',
        message: msg('📍', '需要地址協助', '我正在尋找您的地址，但未能找到確切位置 😅\n\n可否告訴我：\n• 附近有什麼明顯地標？\n• 大廈名稱或顏色？\n• 最近的街道名？', 'Need Address Help', 'I\'m having trouble finding your address 😅\n\nCould you share:\n• A nearby landmark?\n• Building name or color?\n• Nearest street name?', ref),
      },
      {
        icon: <Clock size={18} color="#f59e0b" />,
        label: '塞車延誤',
        sublabel: 'Traffic delay',
        message: msg('🚗', '塞車延誤通知', '很抱歉通知您，因交通擠塞，送貨將會延遲到達。\n\n⏰ 預計遲到約 *15至20分鐘*\n\n我會盡快趕到 🙏', 'Traffic Delay Notice', 'Sorry to inform you that due to heavy traffic, the delivery will be slightly delayed.\n\n⏰ Estimated *15-20 minutes* late\n\nI\'ll arrive as soon as possible 🙏', ref),
      },
    ],
    arrived: [
      {
        icon: <Bell size={18} color="#7c3aed" />,
        label: '已到達',
        sublabel: 'I\'ve arrived',
        message: msg('📦', '已到達', '我已到達您的地址 ✅\n\n請問方便開門收貨嗎？', 'Arrived', 'I\'ve arrived at your address ✅\n\nCould you please come to the door to receive the delivery?', ref),
      },
      {
        icon: <MapPin size={18} color="#2563eb" />,
        label: '在大堂等候',
        sublabel: 'Waiting at lobby',
        message: msg('🏢', '在大堂等候', '我在大廈大堂/入口等候 🧍\n\n請問可以下來收貨嗎？', 'Waiting at Lobby', 'I\'m waiting at the building lobby/entrance 🧍\n\nCould you come down to receive the delivery?', ref),
      },
      {
        icon: <Phone size={18} color="#f59e0b" />,
        label: '無人應門',
        sublabel: 'No answer at door',
        message: msg('🔔', '無人應門', '我已到達並按了門鈴，但暫時無人應門。\n\n⏳ 我會再等候 *5分鐘*\n\n請盡快回覆此訊息 🙏', 'No Answer', 'I\'ve arrived and rang the doorbell but there\'s no answer.\n\n⏳ I\'ll wait *5 more minutes*\n\nPlease reply as soon as possible 🙏', ref),
      },
      {
        icon: <MessageCircle size={18} color="#16a34a" />,
        label: '放置門口',
        sublabel: 'Leave at door',
        message: msg('📦', '放置門口確認', '因無人應門，請問可否將貨物放在門口？\n\n✅ 如同意請回覆「*可以*」\n❌ 如需其他安排請回覆', 'Leave at Door', 'Since there\'s no answer, may I leave the delivery at the door?\n\n✅ Reply "*Yes*" to confirm\n❌ Reply if you need other arrangements', ref),
      },
    ],
    failed: [
      {
        icon: <Calendar size={18} color="#dc2626" />,
        label: '重新安排送貨',
        sublabel: 'Reschedule delivery',
        message: msg('📅', '重新安排送貨', '很抱歉今天未能成功送貨 😔\n\n請問什麼日期和時間方便重新安排？\n\n請回覆您方便的時間，我們會盡快安排 👍', 'Reschedule Delivery', 'Sorry we couldn\'t complete the delivery today 😔\n\nWhat date and time would be convenient to reschedule?\n\nPlease reply with your preferred time and we\'ll arrange it ASAP 👍', ref),
      },
      {
        icon: <MessageCircle size={18} color="#dc2626" />,
        label: '無法聯絡',
        sublabel: 'Unable to reach you',
        message: msg('📞', '無法聯絡通知', '我們今天嘗試送貨但未能聯絡到您。\n\n📋 請盡快回覆此訊息\n📅 以便重新安排送貨時間\n\n感謝您的配合 🙏', 'Unable to Reach You', 'We attempted delivery today but were unable to reach you.\n\n📋 Please reply to this message ASAP\n📅 So we can reschedule your delivery\n\nThank you for your cooperation 🙏', ref),
      },
      {
        icon: <MapPin size={18} color="#dc2626" />,
        label: '地址有誤',
        sublabel: 'Wrong address',
        message: msg('📍', '地址確認', '我們到達了登記的送貨地址，但未能找到您。\n\n請確認正確地址：\n• 大廈名稱\n• 樓層及單位\n• 附近地標\n\n我們會盡快重新安排送貨 👍', 'Address Verification', 'We arrived at the registered address but couldn\'t locate you.\n\nPlease confirm the correct address:\n• Building name\n• Floor & unit\n• Nearby landmark\n\nWe\'ll reschedule your delivery ASAP 👍', ref),
      },
    ],
  }

  const messages = [...(statusMessages[status] || statusMessages['accepted'] || [])]

  messages.push({
    icon: <PenLine size={18} color="#6b7280" />,
    label: '自訂訊息',
    sublabel: 'Custom message',
    message: `✏️ *盈康醫療 Healthy Living*\n📦 訂單 Order: *${ref}*\n\n`,
  })

  return messages
}

function openWhatsApp(phone: string, message: string) {
  // Extract first valid phone number — strip everything except digits
  // Handle formats like: "+852 9312 7040", "5528 2829李小姐 / 5178 0002 許先生(仔)"
  const match = phone.match(/\+?[\d][\d\s\-]{6,}/)
  const digits = match ? match[0].replace(/[\s\-]/g, '') : phone.replace(/[^\d]/g, '')
  // Ensure HK numbers get 852 prefix
  const fullNumber = digits.startsWith('852') ? digits : digits.length === 8 ? `852${digits}` : digits
  const encoded = encodeURIComponent(message)
  const url = `https://wa.me/${fullNumber}?text=${encoded}`
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

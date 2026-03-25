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

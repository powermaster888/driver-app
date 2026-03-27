import React from 'react'
import { Image } from 'react-native'

interface LogoProps {
  height?: number
}

export function Logo({ height = 32 }: LogoProps) {
  // Aspect ratio of original: 1600x555 ≈ 2.88:1
  const width = height * 2.88

  return (
    <Image
      source={require('../../assets/logo.png')}
      style={{ width, height }}
      resizeMode="contain"
    />
  )
}

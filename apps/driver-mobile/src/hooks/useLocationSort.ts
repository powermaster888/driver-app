import { useState, useEffect, useMemo } from 'react'
import * as Location from 'expo-location'
import { haversineKm } from '../utils/geo'
import type { JobSummary } from '../api/jobs'

export interface JobWithDistance extends JobSummary {
  distanceKm: number | null
}

/**
 * Requests location permission once, watches position, and returns
 * jobs sorted by proximity (nearest first). Jobs without coordinates
 * are placed at the end.
 */
export function useLocationSort(jobs: JobSummary[]) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null

    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setPermissionDenied(true)
        return
      }
      // Get initial position quickly
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      } catch {}

      // Watch for updates (low frequency to save battery)
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 100 },
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
      )
    })()

    return () => { sub?.remove() }
  }, [])

  const sorted = useMemo((): JobWithDistance[] => {
    if (!location) {
      return jobs.map((j) => ({ ...j, distanceKm: null }))
    }

    return jobs
      .map((j) => ({
        ...j,
        distanceKm:
          j.latitude && j.longitude
            ? haversineKm(location.lat, location.lng, j.latitude, j.longitude)
            : null,
      }))
      .sort((a, b) => {
        // Jobs with distance come first, sorted ascending
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm
        if (a.distanceKm !== null) return -1
        if (b.distanceKm !== null) return 1
        return 0
      })
  }, [jobs, location])

  return { sortedJobs: sorted, hasLocation: !!location, permissionDenied }
}

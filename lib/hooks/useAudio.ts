// lib/hooks/useAudio.ts
'use client'

import { useState, useCallback, useRef } from 'react'

interface AudioTrack {
  id: string
  filename: string
  storage_path: string
  duration_seconds: number | null
  transcript: string | null
}

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const play = useCallback((track: AudioTrack) => {
    setCurrentTrack(track)
    setIsPlaying(true)
    // Audio element will be controlled by AudioPlayer component
  }, [])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const seek = useCallback((time: number) => {
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  return {
    audioRef,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seek,
    setCurrentTime,
    setDuration,
  }
}

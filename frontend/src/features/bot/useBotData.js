import { useQuery } from '@tanstack/react-query'
import API from '../../api/client'

/** Hooks data du bot — polling React Query centralisé (plus de setInterval ad-hoc). */

export const useBotStatus = () =>
  useQuery({
    queryKey: ['bot-status'],
    queryFn: () => API.get('/api/bot/status').then(r => r.data),
    refetchInterval: 30_000,
  })

export const useSystemStatus = () =>
  useQuery({
    queryKey: ['system-status'],
    queryFn: () => API.get('/api/system/status').then(r => r.data),
    refetchInterval: 60_000,
  })

export const useBotReport = (lang) =>
  useQuery({
    queryKey: ['bot-report', lang],
    queryFn: () => API.get(`/api/bot/report/today?lang=${lang}`).then(r => r.data),
    refetchInterval: 30_000,
  })

export const useBotPerf = () =>
  useQuery({
    queryKey: ['bot-perf'],
    queryFn: () => API.get('/api/bot/performance?days=30').then(r => r.data),
    refetchInterval: 60_000,
  })

export const useBotHistory = (page) =>
  useQuery({
    queryKey: ['bot-history', page],
    queryFn: () => API.get(`/api/bot/history?page=${page}&per_page=10`).then(r => r.data),
    placeholderData: prev => prev,
  })

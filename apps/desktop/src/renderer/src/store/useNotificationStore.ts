import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '../api/client'

export interface Notification {
  id: number
  user_id: number
  sender_id: number
  type: string
  title: string
  message: string
  metadata: any
  is_read: boolean
  created_at: string
  sender?: {
    id: number
    name: string
    email: string
  }
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  clearAllNotifications: () => Promise<void>
  addNotification: (notification: Notification) => void
  addLocalNotification: (title: string, message: string, type?: string) => void
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      loading: false,

      fetchNotifications: async () => {
        set({ loading: true })
        try {
          const response = await apiClient.get('/api/v1/notifications')
          const notifications = Array.isArray(response.data) ? response.data : []
          const unreadCount = notifications.filter((n: Notification) => !n.is_read).length
          set({ notifications, unreadCount, loading: false })
        } catch (error) {
          console.error('Failed to fetch notifications:', error)
          set({ loading: false })
        }
      },

      markAsRead: async (id: number) => {
        try {
          await apiClient.patch(`/api/v1/notifications/${id}/read`, {})
          const notifications = get().notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          )
          const unreadCount = notifications.filter((n) => !n.is_read).length
          set({ notifications, unreadCount })
        } catch (error) {
          console.error('Failed to mark notification as read:', error)
        }
      },

      markAllAsRead: async () => {
        try {
          await apiClient.post('/api/v1/notifications/read-all', {})
          const notifications = get().notifications.map((n) => ({ ...n, is_read: true }))
          set({ notifications, unreadCount: 0 })
        } catch (error) {
          console.error('Failed to mark all notifications as read:', error)
        }
      },

      clearAllNotifications: async () => {
        try {
          await apiClient.delete('/api/v1/notifications')
          set({ notifications: [], unreadCount: 0 })
        } catch (error) {
          console.error('Failed to clear notifications:', error)
        }
      },

      addNotification: (notification: Notification) => {
        const notifications = [notification, ...get().notifications].slice(0, 50)
        const unreadCount = notifications.filter((n) => !n.is_read).length
        set({ notifications, unreadCount })
      },

      addLocalNotification: (title: string, message: string, type = 'system') => {
        const local: Notification = {
          id: -(Date.now()),
          user_id: 0,
          sender_id: 0,
          type,
          title,
          message,
          metadata: {},
          is_read: false,
          created_at: new Date().toISOString(),
          sender: { id: 0, name: 'System', email: '' }
        }
        const notifications = [local, ...get().notifications].slice(0, 50)
        const unreadCount = notifications.filter((n) => !n.is_read).length
        set({ notifications, unreadCount })
      },
    }),
    {
      name: 'wapbolt-notifications',
      partialize: (state) => ({ notifications: state.notifications, unreadCount: state.unreadCount }),
    }
  )
)

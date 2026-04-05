import { useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'space_tracker_reminders'

function getReminders() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveReminders(reminders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders))
}

export function useNotifications() {
  const checkerRef = useRef(null)

  // Request permission on first use
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications are not supported')
      return false
    }
    if (Notification.permission === 'granted') return true
    const result = await Notification.requestPermission()
    return result === 'granted'
  }, [])

  // Add a reminder for a launch
  const addReminder = useCallback(async (launch) => {
    const permitted = await requestPermission()
    if (!permitted) {
      toast.error('Notification permission denied')
      return false
    }

    const reminders = getReminders()
    // Avoid duplicates
    if (reminders.find(r => r.api_id === launch.api_id)) {
      toast('Reminder already set for this launch', { icon: '🔔' })
      return true
    }

    const launchTime = new Date(launch.launch_date).getTime()
    reminders.push({
      api_id: launch.api_id,
      name: launch.name,
      launch_date: launch.launch_date,
      launchTime,
      notified30: false,
      notified5: false,
    })
    saveReminders(reminders)
    toast.success('Reminder set! You will be notified 30 min and 5 min before launch.')
    return true
  }, [requestPermission])

  // Remove a reminder
  const removeReminder = useCallback((apiId) => {
    const reminders = getReminders().filter(r => r.api_id !== apiId)
    saveReminders(reminders)
    toast.success('Reminder removed')
  }, [])

  // Check if a launch has a reminder set
  const hasReminder = useCallback((apiId) => {
    return getReminders().some(r => r.api_id === apiId)
  }, [])

  // Background checker runs every 30 seconds
  useEffect(() => {
    const check = () => {
      const reminders = getReminders()
      const now = Date.now()
      let updated = false

      reminders.forEach(r => {
        const diff = r.launchTime - now
        const minutes = diff / 60000

        // 30 minute warning
        if (!r.notified30 && minutes <= 30 && minutes > 5) {
          new Notification('Launch in 30 minutes!', {
            body: r.name,
            icon: '/rocket.svg',
            tag: `launch-30-${r.api_id}`,
          })
          r.notified30 = true
          updated = true
        }

        // 5 minute warning
        if (!r.notified5 && minutes <= 5 && minutes > 0) {
          new Notification('Launch in 5 minutes!', {
            body: r.name,
            icon: '/rocket.svg',
            tag: `launch-5-${r.api_id}`,
          })
          r.notified5 = true
          updated = true
        }
      })

      // Clean up past launches
      const active = reminders.filter(r => r.launchTime > now - 300000) // keep for 5 min after launch
      if (active.length !== reminders.length || updated) {
        saveReminders(active)
      }
    }

    check()
    checkerRef.current = setInterval(check, 30000)
    return () => clearInterval(checkerRef.current)
  }, [])

  return { addReminder, removeReminder, hasReminder }
}

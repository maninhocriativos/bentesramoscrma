import { useCallback, useRef, useEffect } from 'react';

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';
const ASSIGNMENT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/1531/1531-preview.mp3';

export function useChatNotifications() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assignmentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotificationRef = useRef<number>(0);
  const NOTIFICATION_COOLDOWN = 2000; // 2 seconds between notifications

  useEffect(() => {
    // Pre-load audio files
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
    
    assignmentAudioRef.current = new Audio(ASSIGNMENT_SOUND_URL);
    assignmentAudioRef.current.volume = 0.7;

    return () => {
      audioRef.current = null;
      assignmentAudioRef.current = null;
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    if (now - lastNotificationRef.current < NOTIFICATION_COOLDOWN) return;
    
    lastNotificationRef.current = now;
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Ignore autoplay restrictions
      });
    }
  }, []);

  const playAssignmentSound = useCallback(() => {
    if (assignmentAudioRef.current) {
      assignmentAudioRef.current.currentTime = 0;
      assignmentAudioRef.current.play().catch(() => {
        // Ignore autoplay restrictions
      });
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/icons/icon-512x512.svg',
        badge: '/favicon.ico',
        tag: 'chat-notification',
      });

      if (onClick) {
        notification.onclick = () => {
          window.focus();
          onClick();
          notification.close();
        };
      }

      setTimeout(() => notification.close(), 5000);
    }
  }, []);

  const notifyAssignment = useCallback((subscriberName: string, assignedBy: string) => {
    playAssignmentSound();
    showBrowserNotification(
      '📩 Nova conversa direcionada',
      `${assignedBy} direcionou a conversa com ${subscriberName} para você`
    );
  }, [playAssignmentSound, showBrowserNotification]);

  const notifyNewMessage = useCallback((subscriberName: string, message: string) => {
    playNotificationSound();
    showBrowserNotification(
      `💬 ${subscriberName}`,
      message.substring(0, 100)
    );
  }, [playNotificationSound, showBrowserNotification]);

  return {
    playNotificationSound,
    playAssignmentSound,
    requestNotificationPermission,
    showBrowserNotification,
    notifyAssignment,
    notifyNewMessage,
  };
}

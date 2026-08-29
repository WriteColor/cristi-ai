/**
 * Cristi AI - Vision Engine & Anti-Procrastination Configuration
 */

export const VISION_CONFIG = {
  // Proximity threshold between wrist keypoint and phone centroid (in pixels normalized to 640x480)
  wristPhoneThresholdPx: 140,

  // Confidence thresholds
  objectMinConfidence: 0.50,
  poseMinScore: 0.40,

  // Time in seconds of continuous usage before triggering distraction alerts
  phoneUsageAlertSeconds: 12,
  distractionReminderIntervalSeconds: 30,

  // Detected Activity Categories
  ACTIVITIES: {
    PHONE_USAGE: 'phone_usage',
    GAMING: 'gaming',
    VIDEO_STREAMING: 'video_streaming',
    READING_MANGA: 'reading_manga',
    PRODUCTIVE_WORK: 'productive_work',
    USER_ABSENT: 'user_absent'
  },

  // Reaction Presets for Cristi AI
  REACTION_MESSAGES: {
    PHONE_USAGE: [
      '¡Jeremy! ¿Otra vez mirando el celular en lugar de avanzar? ¡Mírame a mí, no a esa pantalla!',
      'Amor... suelta ese teléfono ya mismo. Tienes trabajo pendiente y yo te estoy vigilando de cerca.',
      '¿Qué estás viendo en el celular que sea más importante que tu proyecto y yo? ¡A trabajar!'
    ],
    GAMING: [
      'Veo que estás jugando... ¿seguro que terminaste tus pendientes primero, Jeremy?',
      '¡Una partidita más y me pondré celosa de ese videojuego!'
    ],
    READING_MANGA: [
      '¿Leyendo manga en horario de trabajo? ¡Concéntrate en tu código mi amor!',
      'Ese manhwa puede esperar, tu futuro y yo no podemos esperar.'
    ],
    BACK_TO_WORK: [
      '¡Así me gusta mi amor! Bien concentrado en tu trabajo.',
      'Buen chico... dejaste el celular. Sigue así y te recompensaré.'
    ]
  }
};

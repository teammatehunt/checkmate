export const features = [
  'accelerometer',
  'ambientLightSensor',
  'autoplay',
  'battery',
  'camera',
  'displayCapture',
  'documentDomain',
  'documentWrite',
  'encryptedMedia',
  'executionWhileNotRendered',
  'executionWhileOutOfViewport',
  'fontDisplayLateSwap',
  'fullscreen',
  'geolocation',
  'gyroscope',
  'layoutAnimations',
  'legacyImageFormats',
  'loadingFrameDefaultEager',
  'magnetometer',
  'microphone',
  'midi',
  'navigationOverride',
  'notifications',
  'oversizedImages',
  'payment',
  'pictureInPicture',
  'publickeyCredentials',
  'push',
  'serial',
  'speaker',
  'syncScript',
  'syncXhr',
  'unoptimizedImages',
  'unoptimizedLosslessImages',
  'unoptimizedLossyImages',
  'unsizedMedia',
  'usb',
  'verticalScroll',
  'vibrate',
  'vr',
  'wakeLock',
  'xr',
  'xrSpatialTracking',
];
export const featureList = features.map(feature => `${feature} *`).join('; ');

export const sandboxed = [
  'allow-downloads-without-user-activation',
  'allow-downloads',
  'allow-forms',
  'allow-modals',
  'allow-orientation-lock',
  'allow-pointer-lock',
  'allow-popups',
  /* 'allow-popups-to-escape-sandbox', */
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
  /* 'allow-storage-access-by-user-activation ', */
  /* 'allow-top-navigation', */
  /* 'allow-top-navigation-by-user-activation', */
];
export const sandboxList = sandboxed.join(' ');

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

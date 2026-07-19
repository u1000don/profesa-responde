Pod::Spec.new do |s|
  s.name           = 'ThenNowPose'
  s.version        = '0.1.0'
  s.summary        = 'On-device ML Kit pose detection for ThenNow'
  s.description    = 'Detects body pose landmarks in still images using Google ML Kit. Runs fully on device.'
  s.author         = 'ThenNow'
  s.homepage       = 'https://github.com/u1000don/profesa-responde'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Google ML Kit requires static frameworks (see expo-build-properties config in app.json).
  s.dependency 'GoogleMLKit/PoseDetectionAccurate', '~> 6.0'

  s.source_files = '**/*.{h,m,swift}'
end

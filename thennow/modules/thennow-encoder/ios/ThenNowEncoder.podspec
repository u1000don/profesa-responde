Pod::Spec.new do |s|
  s.name           = 'ThenNowEncoder'
  s.version        = '0.1.0'
  s.summary        = 'Still-frame MP4 encoder for ThenNow'
  s.description    = 'Encodes a timed sequence of still frames into an H.264 MP4 using AVAssetWriter, with optional AAC audio.'
  s.author         = 'ThenNow'
  s.homepage       = 'https://github.com/u1000don/profesa-responde'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
end

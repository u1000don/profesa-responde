import AVFoundation
import ExpoModulesCore
import UIKit

private struct FrameSpec {
  let path: String
  let durationMs: Int64
}

/// Long holds are subdivided (~10 fps) for wide player compatibility.
private let maxFrameStepMs: Int64 = 100

public class ThenNowEncoderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ThenNowEncoder")
    Events("onProgress")

    AsyncFunction("encode") { (options: [String: Any], promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async { [weak self] in
        guard let self = self else { return }
        do {
          let result = try self.encode(options: options)
          promise.resolve(result)
        } catch {
          promise.reject("E_ENCODE", "Video encoding failed: \(error.localizedDescription)")
        }
      }
    }
  }

  private func stripFileUri(_ path: String) -> String {
    if path.hasPrefix("file://") {
      let stripped = String(path.dropFirst(7))
      return stripped.removingPercentEncoding ?? stripped
    }
    return path
  }

  private func encode(options: [String: Any]) throws -> [String: Any] {
    guard
      let width = options["width"] as? Int,
      let height = options["height"] as? Int,
      let outputPathRaw = options["outputPath"] as? String,
      let framesRaw = options["frames"] as? [[String: Any]],
      !framesRaw.isEmpty
    else {
      throw NSError(
        domain: "ThenNowEncoder", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Invalid encode options"])
    }

    let frames = framesRaw.compactMap { dict -> FrameSpec? in
      guard let path = dict["path"] as? String, let duration = dict["durationMs"] as? Double else {
        return nil
      }
      return FrameSpec(path: stripFileUri(path), durationMs: Int64(max(1, duration)))
    }

    let outputPath = stripFileUri(outputPathRaw)
    let outputURL = URL(fileURLWithPath: outputPath)
    try? FileManager.default.removeItem(at: outputURL)
    try FileManager.default.createDirectory(
      at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)

    let bitRate = options["bitRate"] as? Int ?? width * height * 6
    let audioPath = (options["audioPath"] as? String).map(stripFileUri)

    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

    let videoInput = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: bitRate],
      ])
    videoInput.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: videoInput,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ])
    writer.add(videoInput)

    // Audio reader/writer pair must be configured before the session starts.
    var audioReader: AVAssetReader?
    var audioReaderOutput: AVAssetReaderTrackOutput?
    var audioInput: AVAssetWriterInput?
    if let audioPath = audioPath {
      let asset = AVURLAsset(url: URL(fileURLWithPath: audioPath))
      if let track = asset.tracks(withMediaType: .audio).first {
        let reader = try AVAssetReader(asset: asset)
        let readerOutput = AVAssetReaderTrackOutput(
          track: track,
          outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
        if reader.canAdd(readerOutput) {
          reader.add(readerOutput)
          let input = AVAssetWriterInput(
            mediaType: .audio,
            outputSettings: [
              AVFormatIDKey: kAudioFormatMPEG4AAC,
              AVNumberOfChannelsKey: 2,
              AVSampleRateKey: 44100,
              AVEncoderBitRateKey: 128_000,
            ])
          input.expectsMediaDataInRealTime = false
          if writer.canAdd(input) {
            writer.add(input)
            audioReader = reader
            audioReaderOutput = readerOutput
            audioInput = input
          }
        }
      }
    }

    guard writer.startWriting() else {
      throw writer.error
        ?? NSError(
          domain: "ThenNowEncoder", code: 2,
          userInfo: [NSLocalizedDescriptionKey: "Writer failed to start"])
    }
    writer.startSession(atSourceTime: .zero)

    var ptsMs: Int64 = 0
    var framesDone = 0
    for frame in frames {
      guard let buffer = try makePixelBuffer(path: frame.path, width: width, height: height, pool: adaptor.pixelBufferPool) else {
        writer.cancelWriting()
        throw NSError(
          domain: "ThenNowEncoder", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "Could not load frame \(frame.path)"])
      }
      var remaining = frame.durationMs
      while remaining > 0 {
        while !videoInput.isReadyForMoreMediaData {
          Thread.sleep(forTimeInterval: 0.005)
        }
        adaptor.append(buffer, withPresentationTime: CMTime(value: ptsMs, timescale: 1000))
        let step = min(remaining, maxFrameStepMs)
        ptsMs += step
        remaining -= step
      }
      framesDone += 1
      sendEvent("onProgress", ["framesDone": framesDone, "framesTotal": frames.count])
    }

    // Repeat the final frame so the last still keeps its full duration.
    if let last = frames.last,
      let buffer = try? makePixelBuffer(path: last.path, width: width, height: height, pool: adaptor.pixelBufferPool)
    {
      while !videoInput.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.005)
      }
      adaptor.append(buffer, withPresentationTime: CMTime(value: ptsMs, timescale: 1000))
    }
    videoInput.markAsFinished()

    var audioIncluded = false
    if let reader = audioReader, let readerOutput = audioReaderOutput, let input = audioInput {
      if reader.startReading() {
        let videoDuration = CMTime(value: ptsMs, timescale: 1000)
        audioLoop: while let sample = readerOutput.copyNextSampleBuffer() {
          if CMSampleBufferGetPresentationTimeStamp(sample) >= videoDuration {
            break audioLoop
          }
          while !input.isReadyForMoreMediaData {
            Thread.sleep(forTimeInterval: 0.005)
          }
          if !input.append(sample) {
            break audioLoop
          }
          audioIncluded = true
        }
        reader.cancelReading()
      }
      input.markAsFinished()
    }

    let semaphore = DispatchSemaphore(value: 0)
    writer.finishWriting {
      semaphore.signal()
    }
    semaphore.wait()

    if writer.status != .completed {
      throw writer.error
        ?? NSError(
          domain: "ThenNowEncoder", code: 4,
          userInfo: [NSLocalizedDescriptionKey: "Writer finished with status \(writer.status.rawValue)"])
    }

    return [
      "path": outputPath,
      "audioIncluded": audioIncluded,
      "durationMs": ptsMs,
    ]
  }

  private func makePixelBuffer(
    path: String, width: Int, height: Int, pool: CVPixelBufferPool?
  ) throws -> CVPixelBuffer? {
    guard let image = UIImage(contentsOfFile: path)?.cgImage else { return nil }

    var pixelBuffer: CVPixelBuffer?
    if let pool = pool {
      CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixelBuffer)
    }
    if pixelBuffer == nil {
      CVPixelBufferCreate(
        kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
        [
          kCVPixelBufferCGImageCompatibilityKey: true,
          kCVPixelBufferCGBitmapContextCompatibilityKey: true,
        ] as CFDictionary,
        &pixelBuffer)
    }
    guard let buffer = pixelBuffer else { return nil }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

    guard
      let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
          | CGBitmapInfo.byteOrder32Little.rawValue)
    else { return nil }

    context.setFillColor(UIColor.black.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
  }
}

import ExpoModulesCore
import MLKitPoseDetectionAccurate
import MLKitPoseDetectionCommon
import MLKitVision

private let landmarkNames: [PoseLandmarkType: String] = [
  .nose: "nose",
  .leftEye: "leftEye",
  .rightEye: "rightEye",
  .leftEar: "leftEar",
  .rightEar: "rightEar",
  .leftShoulder: "leftShoulder",
  .rightShoulder: "rightShoulder",
  .leftElbow: "leftElbow",
  .rightElbow: "rightElbow",
  .leftWrist: "leftWrist",
  .rightWrist: "rightWrist",
  .leftHip: "leftHip",
  .rightHip: "rightHip",
  .leftKnee: "leftKnee",
  .rightKnee: "rightKnee",
  .leftAnkle: "leftAnkle",
  .rightAnkle: "rightAnkle",
]

public class ThenNowPoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ThenNowPose")

    AsyncFunction("detectPose") { (uri: String, promise: Promise) in
      let path = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
      guard let image = UIImage(contentsOfFile: path.removingPercentEncoding ?? path) else {
        promise.reject("E_IMAGE_LOAD", "Could not load image at \(uri)")
        return
      }

      let options = AccuratePoseDetectorOptions()
      options.detectorMode = .singleImage
      let detector = PoseDetector.poseDetector(options: options)

      let visionImage = VisionImage(image: image)
      visionImage.orientation = image.imageOrientation

      detector.process(visionImage) { poses, error in
        if let error = error {
          promise.reject("E_POSE_DETECT", "Pose detection failed: \(error.localizedDescription)")
          return
        }
        guard let pose = poses?.first else {
          promise.resolve(nil)
          return
        }
        var landmarks: [String: [String: Double]] = [:]
        for landmark in pose.landmarks {
          guard let name = landmarkNames[landmark.type] else { continue }
          landmarks[name] = [
            "x": Double(landmark.position.x),
            "y": Double(landmark.position.y),
            "likelihood": Double(landmark.inFrameLikelihood),
          ]
        }
        promise.resolve([
          "width": Double(image.size.width * image.scale),
          "height": Double(image.size.height * image.scale),
          "landmarks": landmarks,
        ] as [String: Any])
      }
    }
  }
}

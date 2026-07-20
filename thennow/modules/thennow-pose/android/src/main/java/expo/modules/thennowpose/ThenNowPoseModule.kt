package expo.modules.thennowpose

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.accurate.AccuratePoseDetectorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val LANDMARK_NAMES = mapOf(
  PoseLandmark.NOSE to "nose",
  PoseLandmark.LEFT_EYE to "leftEye",
  PoseLandmark.RIGHT_EYE to "rightEye",
  PoseLandmark.LEFT_EAR to "leftEar",
  PoseLandmark.RIGHT_EAR to "rightEar",
  PoseLandmark.LEFT_SHOULDER to "leftShoulder",
  PoseLandmark.RIGHT_SHOULDER to "rightShoulder",
  PoseLandmark.LEFT_ELBOW to "leftElbow",
  PoseLandmark.RIGHT_ELBOW to "rightElbow",
  PoseLandmark.LEFT_WRIST to "leftWrist",
  PoseLandmark.RIGHT_WRIST to "rightWrist",
  PoseLandmark.LEFT_HIP to "leftHip",
  PoseLandmark.RIGHT_HIP to "rightHip",
  PoseLandmark.LEFT_KNEE to "leftKnee",
  PoseLandmark.RIGHT_KNEE to "rightKnee",
  PoseLandmark.LEFT_ANKLE to "leftAnkle",
  PoseLandmark.RIGHT_ANKLE to "rightAnkle",
)

class ThenNowPoseModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ThenNowPose")

    AsyncFunction("detectPose") { uri: String, promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(CodedException("E_NO_CONTEXT", "React context unavailable", null))

      val image: InputImage
      try {
        image = InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject(CodedException("E_IMAGE_LOAD", "Could not load image: ${e.message}", e))
        return@AsyncFunction
      }

      val options = AccuratePoseDetectorOptions.Builder()
        .setDetectorMode(AccuratePoseDetectorOptions.SINGLE_IMAGE_MODE)
        .build()
      val detector = PoseDetection.getClient(options)

      detector.process(image)
        .addOnSuccessListener { pose ->
          val landmarks = mutableMapOf<String, Map<String, Any>>()
          for (lm in pose.allPoseLandmarks) {
            val name = LANDMARK_NAMES[lm.landmarkType] ?: continue
            landmarks[name] = mapOf(
              "x" to lm.position.x.toDouble(),
              "y" to lm.position.y.toDouble(),
              "likelihood" to lm.inFrameLikelihood.toDouble(),
            )
          }
          if (landmarks.isEmpty()) {
            promise.resolve(null)
          } else {
            promise.resolve(
              mapOf(
                "width" to image.width,
                "height" to image.height,
                "landmarks" to landmarks,
              )
            )
          }
        }
        .addOnFailureListener { e ->
          promise.reject(CodedException("E_POSE_DETECT", "Pose detection failed: ${e.message}", e))
        }
        .addOnCompleteListener {
          detector.close()
        }
    }
  }
}

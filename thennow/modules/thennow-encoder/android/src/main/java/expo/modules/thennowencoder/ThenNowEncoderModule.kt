package expo.modules.thennowencoder

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.view.Surface
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
import java.util.ArrayDeque
import kotlin.concurrent.thread

private const val MIME = "video/avc"
private const val TIMEOUT_US = 10_000L

/** Long holds are subdivided so players see a steady (~10 fps) stream. */
private const val MAX_FRAME_STEP_MS = 100L

class ThenNowEncoderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ThenNowEncoder")
    Events("onProgress")

    AsyncFunction("encode") { options: Map<String, Any?>, promise: Promise ->
      thread(name = "thennow-encoder") {
        try {
          val result = encode(options)
          promise.resolve(result)
        } catch (e: Exception) {
          promise.reject(CodedException("E_ENCODE", "Video encoding failed: ${e.message}", e))
        }
      }
    }
  }

  private fun stripFileUri(path: String): String =
    if (path.startsWith("file://")) path.substring(7) else path

  private fun encode(options: Map<String, Any?>): Map<String, Any> {
    val width = (options["width"] as Number).toInt()
    val height = (options["height"] as Number).toInt()
    val outputPath = stripFileUri(options["outputPath"] as String)
    val audioPath = (options["audioPath"] as? String)?.let { stripFileUri(it) }
    val bitRate = (options["bitRate"] as? Number)?.toInt() ?: (width * height * 6)

    @Suppress("UNCHECKED_CAST")
    val frames = (options["frames"] as List<Map<String, Any?>>).map {
      FrameSpec(stripFileUri(it["path"] as String), (it["durationMs"] as Number).toLong())
    }
    require(frames.isNotEmpty()) { "No frames to encode" }

    File(outputPath).parentFile?.mkdirs()
    File(outputPath).delete()

    val format = MediaFormat.createVideoFormat(MIME, width, height).apply {
      setInteger(
        MediaFormat.KEY_COLOR_FORMAT,
        MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
      )
      setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
      setInteger(MediaFormat.KEY_FRAME_RATE, 30)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }

    val encoder = MediaCodec.createEncoderByType(MIME)
    encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val inputSurface = encoder.createInputSurface()
    encoder.start()

    val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val state = MuxState(muxer)

    // Audio is prepared up-front so its track can be added before muxer.start().
    val audio = audioPath?.let { prepareAudio(it) }
    var audioIncluded = false

    val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    val dstRect = Rect(0, 0, width, height)

    var ptsUs = 0L
    var framesDone = 0
    try {
      for (frame in frames) {
        val bitmap = BitmapFactory.decodeFile(frame.path)
          ?: throw IllegalStateException("Could not decode frame ${frame.path}")
        var remainingMs = frame.durationMs.coerceAtLeast(1L)
        while (remainingMs > 0) {
          drawFrame(inputSurface, bitmap, dstRect, paint)
          state.pendingPtsUs.add(ptsUs)
          val stepMs = minOf(remainingMs, MAX_FRAME_STEP_MS)
          ptsUs += stepMs * 1000
          remainingMs -= stepMs
          drain(encoder, state, audio, endOfStream = false)
        }
        bitmap.recycle()
        framesDone++
        sendEvent("onProgress", mapOf("framesDone" to framesDone, "framesTotal" to frames.size))
      }

      // Repeat the final frame once so the last still keeps its full duration.
      BitmapFactory.decodeFile(frames.last().path)?.let { bitmap ->
        drawFrame(inputSurface, bitmap, dstRect, paint)
        state.pendingPtsUs.add(ptsUs)
        bitmap.recycle()
      }

      encoder.signalEndOfInputStream()
      drain(encoder, state, audio, endOfStream = true)

      if (audio != null && state.audioTrack >= 0) {
        writeAudio(audio, state, videoDurationUs = ptsUs)
        audioIncluded = true
      }
    } finally {
      runCatching { encoder.stop() }
      encoder.release()
      inputSurface.release()
      if (state.muxerStarted) runCatching { muxer.stop() }
      muxer.release()
      audio?.extractor?.release()
    }

    return mapOf(
      "path" to outputPath,
      "audioIncluded" to audioIncluded,
      "durationMs" to ptsUs / 1000
    )
  }

  private fun drawFrame(surface: Surface, bitmap: Bitmap, dst: Rect, paint: Paint) {
    val canvas = try {
      surface.lockHardwareCanvas()
    } catch (e: Exception) {
      surface.lockCanvas(null)
    }
    try {
      canvas.drawColor(Color.BLACK)
      canvas.drawBitmap(bitmap, null, dst, paint)
    } finally {
      surface.unlockCanvasAndPost(canvas)
    }
  }

  private class FrameSpec(val path: String, val durationMs: Long)

  private class MuxState(val muxer: MediaMuxer) {
    var videoTrack = -1
    var audioTrack = -1
    var muxerStarted = false
    // Canvas-posted buffers carry wall-clock timestamps; we rewrite them with
    // our own schedule. Surface-fed AVC encoders emit frames in order (no
    // B-frames), so a FIFO of intended timestamps is sufficient.
    val pendingPtsUs = ArrayDeque<Long>()
  }

  private class AudioSource(
    val extractor: MediaExtractor,
    val format: MediaFormat
  )

  private fun prepareAudio(path: String): AudioSource? {
    return try {
      val extractor = MediaExtractor()
      extractor.setDataSource(path)
      for (i in 0 until extractor.trackCount) {
        val trackFormat = extractor.getTrackFormat(i)
        val mime = trackFormat.getString(MediaFormat.KEY_MIME) ?: continue
        // MediaMuxer only accepts AAC audio in MP4 output; other codecs are skipped.
        if (mime == MediaFormat.MIMETYPE_AUDIO_AAC) {
          extractor.selectTrack(i)
          return AudioSource(extractor, trackFormat)
        }
      }
      extractor.release()
      null
    } catch (e: Exception) {
      null
    }
  }

  private fun drain(
    encoder: MediaCodec,
    state: MuxState,
    audio: AudioSource?,
    endOfStream: Boolean
  ) {
    val bufferInfo = MediaCodec.BufferInfo()
    while (true) {
      val index = encoder.dequeueOutputBuffer(bufferInfo, if (endOfStream) TIMEOUT_US else 0L)
      when {
        index == MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!endOfStream) return
        }
        index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          check(!state.muxerStarted) { "Encoder format changed twice" }
          state.videoTrack = state.muxer.addTrack(encoder.outputFormat)
          if (audio != null) {
            state.audioTrack = state.muxer.addTrack(audio.format)
          }
          state.muxer.start()
          state.muxerStarted = true
        }
        index >= 0 -> {
          val encoded: ByteBuffer = encoder.getOutputBuffer(index)
            ?: throw IllegalStateException("Encoder output buffer $index is null")
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
            bufferInfo.size = 0
          }
          if (bufferInfo.size > 0 && state.muxerStarted) {
            state.pendingPtsUs.pollFirst()?.let { bufferInfo.presentationTimeUs = it }
            encoded.position(bufferInfo.offset)
            encoded.limit(bufferInfo.offset + bufferInfo.size)
            state.muxer.writeSampleData(state.videoTrack, encoded, bufferInfo)
          }
          encoder.releaseOutputBuffer(index, false)
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
        }
      }
    }
  }

  private fun writeAudio(audio: AudioSource, state: MuxState, videoDurationUs: Long) {
    val maxSize = try {
      audio.format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
    } catch (e: Exception) {
      256 * 1024
    }
    val buffer = ByteBuffer.allocate(maxSize.coerceAtLeast(64 * 1024))
    val info = MediaCodec.BufferInfo()
    while (true) {
      val size = audio.extractor.readSampleData(buffer, 0)
      if (size < 0) break
      val sampleTime = audio.extractor.sampleTime
      if (sampleTime > videoDurationUs) break
      info.set(0, size, sampleTime, MediaCodec.BUFFER_FLAG_KEY_FRAME)
      state.muxer.writeSampleData(state.audioTrack, buffer, info)
      audio.extractor.advance()
    }
  }
}

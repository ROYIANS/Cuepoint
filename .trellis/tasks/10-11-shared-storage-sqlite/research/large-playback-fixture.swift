import Foundation
import AVFoundation
import CoreVideo
import CoreMedia

enum ProbeError: Error { case failed(String) }

@main
struct MediaProbe {
    static func fourcc(_ value: FourCharCode) -> String {
        String(bytes: [UInt8((value >> 24) & 255), UInt8((value >> 16) & 255), UInt8((value >> 8) & 255), UInt8(value & 255)], encoding: .ascii) ?? "unknown"
    }

    static func inspect(_ path: String) async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: path))
        let duration = try await asset.load(.duration)
        var tracks: [[String: Any]] = []
        for track in try await asset.load(.tracks) {
            let formats = try await track.load(.formatDescriptions)
            let size = try await track.load(.naturalSize)
            let reader = try AVAssetReader(asset: asset)
            let settings: [String: Any] = track.mediaType == .video
                ? [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
                : [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false]
            let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
            guard reader.canAdd(output) else {throw ProbeError.failed("reader output")}
            reader.add(output)
            guard reader.startReading() else {throw reader.error ?? ProbeError.failed("reader start")}
            var buffers = 0, samples = 0
            while let buffer = output.copyNextSampleBuffer() {buffers += 1; samples += CMSampleBufferGetNumSamples(buffer)}
            guard reader.status == .completed else {throw reader.error ?? ProbeError.failed("reader incomplete")}
            tracks.append(["kind": track.mediaType.rawValue, "codecs": formats.map {fourcc(CMFormatDescriptionGetMediaSubType($0))}, "width": size.width, "height": size.height, "fps": try await track.load(.nominalFrameRate), "decodedBuffers": buffers, "decodedSamples": samples, "decodeCompleted": true])
        }
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        let json: [String: Any] = ["path": path, "bytes": data.count, "durationSec": duration.seconds, "tracks": tracks]
        print(String(data: try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys]), encoding: .utf8)!)
    }

    static func generateVideo(_ path: String) async throws {
        let url = URL(fileURLWithPath: path)
        guard !FileManager.default.fileExists(atPath: path) else {throw ProbeError.failed("destination exists")}
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let settings: [String: Any] = [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: 640, AVVideoHeightKey: 360, AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 24000000, AVVideoMaxKeyFrameIntervalKey: 30]]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: 640, kCVPixelBufferHeightKey as String: 360])
        guard writer.canAdd(input) else {throw ProbeError.failed("cannot add H264 input")}
        writer.add(input)
        guard writer.startWriting() else {throw writer.error ?? ProbeError.failed("writer start")}
        writer.startSession(atSourceTime: .zero)
        for frame in 0..<900 {
            while !input.isReadyForMoreMediaData {
                if writer.status == .failed {throw writer.error ?? ProbeError.failed("writer failed")}
                try await Task.sleep(nanoseconds: 1_000_000)
            }
            var pixel: CVPixelBuffer?
            guard CVPixelBufferCreate(kCFAllocatorDefault, 640, 360, kCVPixelFormatType_32BGRA, nil, &pixel) == kCVReturnSuccess, let pixel else {throw ProbeError.failed("pixel buffer")}
            CVPixelBufferLockBaseAddress(pixel, [])
            let pointer = CVPixelBufferGetBaseAddress(pixel)!.assumingMemoryBound(to: UInt8.self)
            let rowBytes = CVPixelBufferGetBytesPerRow(pixel)
            var random = UInt32(frame + 1)
            for y in 0..<360 {for x in 0..<640 {
                let offset = y * rowBytes + x * 4
                random = random &* 1664525 &+ 1013904223
                pointer[offset] = UInt8(truncatingIfNeeded: random >> 16)
                pointer[offset + 1] = UInt8(truncatingIfNeeded: random >> 8)
                pointer[offset + 2] = UInt8(truncatingIfNeeded: random)
                pointer[offset + 3] = 255
            }}
            CVPixelBufferUnlockBaseAddress(pixel, [])
            guard adaptor.append(pixel, withPresentationTime: CMTime(value: Int64(frame), timescale: 30)) else {throw writer.error ?? ProbeError.failed("append")}
        }
        writer.endSession(atSourceTime: CMTime(value: 900, timescale: 30))
        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else {throw writer.error ?? ProbeError.failed("finish")}
        try await inspect(path)
    }

    static func mux(_ video: String, _ audio: String, _ output: String) async throws {
        guard !FileManager.default.fileExists(atPath: output) else {throw ProbeError.failed("destination exists")}
        let videoAsset = AVURLAsset(url: URL(fileURLWithPath: video))
        let audioAsset = AVURLAsset(url: URL(fileURLWithPath: audio))
        let videoTrack = try await videoAsset.loadTracks(withMediaType: .video).first!
        let audioTrack = try await audioAsset.loadTracks(withMediaType: .audio).first!
        let duration = try await videoAsset.load(.duration)
        let composition = AVMutableComposition()
        try composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: videoTrack, at: .zero)
        try composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: audioTrack, at: .zero)
        guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else {throw ProbeError.failed("export session")}
        session.outputURL = URL(fileURLWithPath: output)
        session.outputFileType = .mp4
        await session.export()
        guard session.status == .completed else {throw session.error ?? ProbeError.failed("mux")}
        try await inspect(output)
    }

    static func main() async throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        switch arguments.first {
        case "video" where arguments.count == 2: try await generateVideo(arguments[1])
        case "mux" where arguments.count == 4: try await mux(arguments[1], arguments[2], arguments[3])
        case "inspect" where arguments.count >= 2: for path in arguments.dropFirst() {try await inspect(path)}
        default: throw ProbeError.failed("usage: video path | mux video audio output | inspect paths...")
        }
    }
}

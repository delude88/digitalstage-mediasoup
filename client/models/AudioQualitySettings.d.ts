export default interface AudioQualitySettings {
    autoGainControl?: boolean,
    channelCount?: number,
    echoCancellation?: boolean,
    latency?: number,
    noiseSuppression?: boolean,
    sampleRate?: number
    sampleSize?: number,
    volume?: number
}

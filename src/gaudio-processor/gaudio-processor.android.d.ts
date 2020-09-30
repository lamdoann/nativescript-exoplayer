declare const com: any, java: any;
export declare class GaudioProcessor extends java.lang.Object {
    private NUM_BUFFER_FOR_GUARD;
    private SAMPLES_PER_BLOCK;
    private BITS_PER_BYTE;
    private mFrameBufferSize;
    private mStackBufferSize;
    private mBytesPerSample;
    private mBitsPerSample;
    private mInputEnded;
    private mInitCore;
    private mSolMusicOne;
    private mConfig;
    private mInputNativeShortArray;
    private mOutputProcessedShortArray;
    private mInputShortBuffer;
    private mTempShortBuffer;
    private mProcessedShortBuffer;
    private mOutputBuffer;
    private mProcessedBuffer;
    private mTrackIndex;
    private mSetupResult;
    private mIsUpdated;
    private mInfo;
    constructor(mInfo: any);
    onSolStatisticsNCPLStarted: (gain: number, startTime: number) => void;
    onSolStatisticsNCPLEnded: (gain: number, endTime: number) => void;
    onSolStatisticsPumpingDetected: (time: number, pumpingValue: number) => void;
    configure: (sampleRateHz: number, channelCount: number, encoding: number) => boolean;
    private initBuffer;
    private setupCore;
    private getByteArrayFromFilePath;
    destroyCore: () => void;
    private resetCore;
    private flushCore;
    isActive: () => boolean;
    getOutputChannelCount: () => number;
    getOutputEncoding: () => number;
    getOutputSampleRateHz: () => number;
    update: () => void;
    queueInput: (buffer: any) => void;
    private process;
    setTrackIndex: (index: number) => void;
    queueEndOfStream: () => void;
    getOutput: () => any;
    isEnded: () => boolean;
    flush: () => void;
    reset: () => void;
}
export declare class ProcessorFactory extends com.google.android.exoplayer2.DefaultRenderersFactory {
    context: any;
    solEqualizer: any;
    constructor(context: any, solEqualizer: any);
    buildAudioProcessors: () => any[];
}
export declare class PlaybackInformation extends java.lang.Object {
    static KEY_PLAYBACK_INFORMATION: string;
    static EQ_BAND_COUNT: number;
    params: any;
    presetType: number;
    deviceType: number;
    videoFilePath: any;
    solFilePath: any;
    hasReadPermission: boolean;
    equalizerBandGainDbFloatArray: any;
    constructor();
    getEqualizerBandGainDbFloatArray: () => any;
}
export {};

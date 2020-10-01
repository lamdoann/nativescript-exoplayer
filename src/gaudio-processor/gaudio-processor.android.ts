declare const android: any, com: any, java: any, javax: any;

@Interfaces([com.google.android.exoplayer2.audio.AudioProcessor, com.gaudiolab.sol.android.SolMusicOneStatisticsEvent]) 
export class GaudioProcessor extends java.lang.Object {
  private NUM_BUFFER_FOR_GUARD: number = 10;;
  private SAMPLES_PER_BLOCK: number = 512;
  private BITS_PER_BYTE: number = 8;

  private mFrameBufferSize: number = 0;
  private mStackBufferSize: number = 0;
  private mBytesPerSample: number = 0;
  private mBitsPerSample: number = 0;
  private mInputEnded: boolean = false;

  private mInitCore: any; // AtomicBoolean
  private mSolMusicOne: any; // SolMusicOne

  private mConfig: any; // Configuration

  // Buffers
  private mInputNativeShortArray: any; // short[]
  private mOutputProcessedShortArray: any; // short[]

  private mInputShortBuffer: any; // ShortBuffer
  private mTempShortBuffer: any; // ShortBuffer
  private mProcessedShortBuffer: any; // ShortBuffer

  private mOutputBuffer: any; // ByteBuffer
  private mProcessedBuffer: any; // ByteBuffer
  private mTrackIndex: number = 0;
  private mSetupResult: number = 0;

  private mIsUpdated: any; // AtomicBoolean
  private mInfo: any; // PlaybackInformation
	constructor(mInfo: any) {
    super();
    
    this.mInfo = mInfo;

    this.mOutputBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;
    this.mProcessedBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;
    this.mProcessedShortBuffer = this.mProcessedBuffer.asShortBuffer();
    this.mStackBufferSize = 0;

    this.mInitCore = new java.util.concurrent.atomic.AtomicBoolean(false);
    this.mIsUpdated = new java.util.concurrent.atomic.AtomicBoolean(false);
    this.mSolMusicOne = new com.gaudiolab.sol.android.SolMusicOne();
    this.mSolMusicOne.addListener(this);

    this.mConfig = new com.gaudiolab.sol.android.Configuration();

    this.mSolMusicOne.create();

    // 1: Info, 2: Warning, 3: Error
    this.mSolMusicOne.setLogLevel(1);

    return global.__native(this);
  }

  public onSolStatisticsNCPLStarted = (gain: number, startTime: number) => {
    android.util.Log.d("[NCPL Start]", "Start Time: " + startTime + "   Gain: " + gain);
  }

  public onSolStatisticsNCPLEnded = (gain: number, endTime: number) => {
    android.util.Log.d("[NCPL End]", "End Time: " + endTime + "   Gain: " + gain);
  }

  public onSolStatisticsPumpingDetected = (time: number, pumpingValue: number) => {
    android.util.Log.d("[Pumping Detected]", "Time: " + time + "   Gain: " + pumpingValue);
  }

  public configure = (sampleRateHz: number, channelCount: number, encoding: number): boolean => {
    if (encoding != com.google.android.exoplayer2.C.ENCODING_PCM_16BIT) {
        throw new com.google.android.exoplayer2.audio.AudioProcessor.UnhandledFormatException(sampleRateHz, channelCount, encoding);
    } else {
        this.mBitsPerSample = 16;
    }
    
    if (this.mInitCore.get()) {
        this.resetCore();
    }

    this.mConfig.sampleRate = sampleRateHz;
    this.mConfig.numInputChannels = channelCount;
    this.mConfig.samplesPerBlock = this.SAMPLES_PER_BLOCK;
    this.mConfig.format = com.gaudiolab.sol.android.SolMusicOne.Format.S16leI.ordinal();

    this.mFrameBufferSize = this.SAMPLES_PER_BLOCK * this.mConfig.numInputChannels;
    this.mBytesPerSample = this.mBitsPerSample / this.BITS_PER_BYTE;
    let initBufferSize: number = this.mFrameBufferSize * this.mBytesPerSample * this.NUM_BUFFER_FOR_GUARD;

    if (!this.mInitCore.get()) {
        this.initBuffer(initBufferSize);
        this.setupCore();
    }

    this.mTrackIndex++;
    
    return true;
  }

  private initBuffer = (initBufferSize: number) => {
    this.mInputNativeShortArray = Array<number>(this.mFrameBufferSize); // new short[this.mFrameBufferSize];
    this.mOutputProcessedShortArray = Array<number>(this.mFrameBufferSize); // new short[this.mFrameBufferSize];

    this.mInputShortBuffer = java.nio.ShortBuffer.allocate(initBufferSize);
    this.mProcessedBuffer = java.nio.ByteBuffer.allocateDirect(initBufferSize * this.mBytesPerSample).order(java.nio.ByteOrder.nativeOrder());
    this.mProcessedShortBuffer = this.mProcessedBuffer.asShortBuffer();
    this.mProcessedBuffer.flip();
    this.mProcessedShortBuffer.flip();
  }

  private setupCore = () => {
    if (!this.mInitCore.get()) {
      this.mInitCore.compareAndSet(false, true);
      if (this.mTrackIndex >= this.mInfo.solFilePath.size()) {
        this.mTrackIndex = 0;
      }

      let metadata: any = this.getByteArrayFromFilePath(this.mInfo.solFilePath.get(this.mTrackIndex)); // byte[]
      let controlParams = new com.gaudiolab.sol.android.ControlParams();
      controlParams.metadata = null;
      controlParams.metadataLength = 0;

      if (metadata != null){
        controlParams.metadata = metadata;
        controlParams.metadataLength = metadata.length;
      }

      this.mInfo.params = controlParams;
      this.mSetupResult = this.mSolMusicOne.setup(this.mConfig, this.mInfo.params);

      android.util.Log.d("[GaudioSolMusicOne] ", "setupCore : " + this.mSetupResult);
    }
  }

  /**
   * @returns byte[]
   */
  private getByteArrayFromFilePath = (metadataFilePath: string) => {
    if (!new java.io.File(metadataFilePath).isFile()) {
      return null;
    }

    try {
      let fis = new java.io.FileInputStream(new java.io.File(metadataFilePath));
      
      if (fis.available() == 0) {
        return null;
      }

      let metadata = (Array as any).create("byte", fis.available());
      while (fis.read(metadata) != -1) {}
      fis.close();

      return metadata;
    } catch (e) {
      return null;
    }
  }

  public destroyCore = () => {
    if (this.mInitCore.get()) {
      this.mInitCore.compareAndSet(true, false);
      let result: number = this.mSolMusicOne.destroy();
      android.util.Log.d("[GaudioSolMusicOne] ", "destroyCore : " + result);
    }
  }

  private resetCore = () => {
    if (this.mInitCore.get()) {
      this.mInitCore.compareAndSet(true, false);
      let result = this.mSolMusicOne.reset();
      android.util.Log.d("[GaudioSolMusicOne] ", "resetCore : " + result);
    }
  }

  private flushCore = () => {
    if (this.mInitCore.get()) {
      let result = this.mSolMusicOne.flush();
      android.util.Log.d("[GaudioSolMusicOne] ", "flushCore : " + result);
    }
  }

  public isActive = (): boolean => {
    return true;
  }

  public getOutputChannelCount = (): number => {
    return this.mConfig.numInputChannels;
  }

  public getOutputEncoding = (): number => {
      return com.google.android.exoplayer2.C.ENCODING_PCM_16BIT;
  }

  public getOutputSampleRateHz = (): number => {
      return this.mConfig.sampleRate;
  }

  public update = () => {
    this.mIsUpdated.compareAndSet(false, true);
  }

  public queueInput = (buffer: any) => {
    if (this.mSetupResult != 0) {
      this.mOutputBuffer = buffer;
    } else if (buffer.hasRemaining()) {
      let inputSize: number = buffer.remaining();

      if (this.mInputShortBuffer.capacity() < inputSize) {
        // Put stacked input buffer in mTempShortBuffer
        this.mInputShortBuffer.flip();
        this.mTempShortBuffer = java.nio.ShortBuffer.allocate(this.mInputShortBuffer.limit());
        this.mTempShortBuffer.put(this.mInputShortBuffer);
        this.mTempShortBuffer.position(0);

        this.initBuffer(inputSize + this.mStackBufferSize * this.mBytesPerSample);

        this.mInputShortBuffer.put(this.mTempShortBuffer);
        this.mTempShortBuffer.clear();
      }

      // Increase the limit to the capacity
      this.mProcessedBuffer.clear();
      this.mProcessedShortBuffer.clear();

      // Put input buffer and prepare to read the input buffer
      this.mInputShortBuffer.put(buffer.asShortBuffer());
      this.mInputShortBuffer.flip();

      // Gaudio processes processingCount times
      this.mStackBufferSize += inputSize / this.mBytesPerSample;
      let processingCount: number = this.mStackBufferSize / this.mFrameBufferSize;
      this.process(processingCount);

      // Move unread data to the beginning of the input buffer.
      this.mInputShortBuffer.compact();

      // Prepare to read the processed buffer
      this.mProcessedBuffer.flip();
      this.mProcessedShortBuffer.flip();

      this.mOutputBuffer = this.mProcessedBuffer;
      buffer.position(buffer.position() + inputSize);
    }
  } 

  private process = (count: number) => {
    for (let i = 0; i < count; i++) {
      this.mInputShortBuffer.get(this.mInputNativeShortArray, 0, this.mFrameBufferSize);
      if (this.mInitCore.get()) {
        if (this.mIsUpdated.get()) {
          const result: number = this.mSolMusicOne.update(this.mInfo.params);
          this.mIsUpdated.compareAndSet(true, false);
          android.util.Log.d("[GaudioSolMusicOne] ", "update : " + result);
        }

        this.mSolMusicOne.runShort(this.mInputNativeShortArray, this.mOutputProcessedShortArray, this.mConfig.samplesPerBlock);
        this.mProcessedShortBuffer.put(this.mOutputProcessedShortArray);
        this.mProcessedBuffer.position(this.mProcessedShortBuffer.position() * this.mBytesPerSample);
      }

      this.mStackBufferSize -= this.mFrameBufferSize;
    }
  }

  public setTrackIndex = (index: number) => {
    this.mTrackIndex = index;
  }

  public queueEndOfStream = () => {
    this.mInputEnded = true;
  }

  public getOutput = () => {
    return this.mOutputBuffer;
  }

  public isEnded = () => {
    return this.mInputEnded;
  }

  public flush = () => {
    if(this.mInitCore.get()) {
      this.mInputEnded = false;
      this.mInputShortBuffer.clear();
      this.mOutputBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;
      this.mStackBufferSize = 0;
      this.flushCore();
    }
  }

  public reset = () => {
    this.mInputEnded = false;
    this.mConfig.sampleRate = com.google.android.exoplayer2.Format.NO_VALUE;
    this.mConfig.numInputChannels = com.google.android.exoplayer2.Format.NO_VALUE;
    this.mProcessedBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;

    if (this.mInitCore.get()) {
      this.resetCore();
    }
  }
}

export class ProcessorFactory extends com.google.android.exoplayer2.DefaultRenderersFactory  {
  public context: any;
  public solEqualizer: any;
  /**
   * 
   * @param context {Context}
   * @param solEqualizer {AudioProcessor}
   */
  constructor(context: any, solEqualizer: any) {
    super(context);

    this.context = context;
    this.solEqualizer = solEqualizer;

    return global.__native(this);
  }

  /**
   * @returns Array<AudioProcessor>
   */
  public buildAudioProcessors = () => {
    return [this.solEqualizer];
  }
}

@Interfaces([java.io.Serializable]) 
export class PlaybackInformation extends java.lang.Object {
  static KEY_PLAYBACK_INFORMATION: string = "PlaybackInformation";
  static EQ_BAND_COUNT: number = 10;

  params: any; // ControlParams

  presetType: number;
  deviceType: number;

  videoFilePath: any; // ArrayList<String>
  solFilePath: any; // ArrayList<String>
  hasReadPermission: boolean;

  equalizerBandGainDbFloatArray: any; // float[]
  constructor() {
    super();

    this.params = new com.gaudiolab.sol.android.ControlParams();
    this.params.isEnable = true;
    this.params.preferenceFeatures = 0;
    this.params.loudnessType = com.gaudiolab.sol.android.SolMusicOne.LoudnessType.Basic.ordinal();

    this.params.targetLoudness = -16;
    this.params.loudnessType = 0;
    this.params.environmentOffset = 0;

    this.params.equalizerBandCount = PlaybackInformation.EQ_BAND_COUNT;
    this.params.equalizerBandGainDb = Array(PlaybackInformation.EQ_BAND_COUNT); // new float[PlaybackInformation.EQ_BAND_COUNT]
    this.params.equalizerGlobalGainDb = 0;

    this.params.volumeGains = 0;
    this.params.eleqVolume = 0;

    this.params.upmixType = 0;
    this.params.upmixGenre = 0;
    this.params.reverbIntensity = 0;

    this.params.metadataLength = 0;
    this.params.metadata = null;

    this.presetType = 0;
    this.deviceType = 0;

    return global.__native(this);
  }

  public getEqualizerBandGainDbFloatArray = () => {
    return this.params.equalizerBandGainDb;
  }
}
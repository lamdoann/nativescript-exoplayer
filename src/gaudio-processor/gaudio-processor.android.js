"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaybackInformation = exports.ProcessorFactory = exports.GaudioProcessor = void 0;
var GaudioProcessor = (function (_super) {
    __extends(GaudioProcessor, _super);
    function GaudioProcessor(mInfo) {
        var _this = _super.call(this) || this;
        _this.NUM_BUFFER_FOR_GUARD = 10;
        _this.SAMPLES_PER_BLOCK = 512;
        _this.BITS_PER_BYTE = 8;
        _this.mFrameBufferSize = 0;
        _this.mStackBufferSize = 0;
        _this.mBytesPerSample = 0;
        _this.mBitsPerSample = 0;
        _this.mInputEnded = false;
        _this.mTrackIndex = 0;
        _this.mSetupResult = 0;
        _this.onSolStatisticsNCPLStarted = function (gain, startTime) {
            android.util.Log.d("[NCPL Start]", "Start Time: " + startTime + "   Gain: " + gain);
        };
        _this.onSolStatisticsNCPLEnded = function (gain, endTime) {
            android.util.Log.d("[NCPL End]", "End Time: " + endTime + "   Gain: " + gain);
        };
        _this.onSolStatisticsPumpingDetected = function (time, pumpingValue) {
            android.util.Log.d("[Pumping Detected]", "Time: " + time + "   Gain: " + pumpingValue);
        };
        _this.configure = function (sampleRateHz, channelCount, encoding) {
            if (encoding != com.google.android.exoplayer2.C.ENCODING_PCM_16BIT) {
                throw new com.google.android.exoplayer2.audio.AudioProcessor.UnhandledFormatException(sampleRateHz, channelCount, encoding);
            }
            else {
                _this.mBitsPerSample = 16;
            }
            if (_this.mInitCore.get()) {
                _this.resetCore();
            }
            _this.mConfig.sampleRate = sampleRateHz;
            _this.mConfig.numInputChannels = channelCount;
            _this.mConfig.samplesPerBlock = _this.SAMPLES_PER_BLOCK;
            _this.mConfig.format = com.gaudiolab.sol.android.SolMusicOne.Format.S16leI.ordinal();
            _this.mFrameBufferSize = _this.SAMPLES_PER_BLOCK * _this.mConfig.numInputChannels;
            _this.mBytesPerSample = _this.mBitsPerSample / _this.BITS_PER_BYTE;
            var initBufferSize = _this.mFrameBufferSize * _this.mBytesPerSample * _this.NUM_BUFFER_FOR_GUARD;
            if (!_this.mInitCore.get()) {
                _this.initBuffer(initBufferSize);
                _this.setupCore();
            }
            _this.mTrackIndex++;
            return true;
        };
        _this.initBuffer = function (initBufferSize) {
            _this.mInputNativeShortArray = Array(_this.mFrameBufferSize);
            _this.mOutputProcessedShortArray = Array(_this.mFrameBufferSize);
            _this.mInputShortBuffer = java.nio.ShortBuffer.allocate(initBufferSize);
            _this.mProcessedBuffer = java.nio.ByteBuffer.allocateDirect(initBufferSize * _this.mBytesPerSample).order(java.nio.ByteOrder.nativeOrder());
            _this.mProcessedShortBuffer = _this.mProcessedBuffer.asShortBuffer();
            _this.mProcessedBuffer.flip();
            _this.mProcessedShortBuffer.flip();
        };
        _this.setupCore = function () {
            if (!_this.mInitCore.get()) {
                _this.mInitCore.compareAndSet(false, true);
                if (_this.mTrackIndex >= _this.mInfo.solFilePath.size()) {
                    _this.mTrackIndex = 0;
                }
                var metadata = _this.getByteArrayFromFilePath(_this.mInfo.solFilePath.get(_this.mTrackIndex));
                var controlParams = new com.gaudiolab.sol.android.ControlParams();
                controlParams.metadata = null;
                controlParams.metadataLength = 0;
                if (metadata != null) {
                    controlParams.metadata = metadata;
                    controlParams.metadataLength = metadata.length;
                }
                _this.mInfo.params = controlParams;
                _this.mSetupResult = _this.mSolMusicOne.setup(_this.mConfig, _this.mInfo.params);
                android.util.Log.d("[GaudioSolMusicOne] ", "setupCore : " + _this.mSetupResult);
            }
        };
        _this.getByteArrayFromFilePath = function (metadataFilePath) {
            if (!new java.io.File(metadataFilePath).isFile()) {
                return null;
            }
            try {
                var fis = new java.io.FileInputStream(new java.io.File(metadataFilePath));
                if (fis.available() == 0) {
                    return null;
                }
                var metadata = Array.create("byte", fis.available());
                while (fis.read(metadata) != -1) { }
                fis.close();
                return metadata;
            }
            catch (e) {
                return null;
            }
        };
        _this.destroyCore = function () {
            if (_this.mInitCore.get()) {
                _this.mInitCore.compareAndSet(true, false);
                var result = _this.mSolMusicOne.destroy();
                android.util.Log.d("[GaudioSolMusicOne] ", "destroyCore : " + result);
            }
        };
        _this.resetCore = function () {
            if (_this.mInitCore.get()) {
                _this.mInitCore.compareAndSet(true, false);
                var result = _this.mSolMusicOne.reset();
                android.util.Log.d("[GaudioSolMusicOne] ", "resetCore : " + result);
            }
        };
        _this.flushCore = function () {
            if (_this.mInitCore.get()) {
                var result = _this.mSolMusicOne.flush();
                android.util.Log.d("[GaudioSolMusicOne] ", "flushCore : " + result);
            }
        };
        _this.isActive = function () {
            return true;
        };
        _this.getOutputChannelCount = function () {
            return _this.mConfig.numInputChannels;
        };
        _this.getOutputEncoding = function () {
            return com.google.android.exoplayer2.C.ENCODING_PCM_16BIT;
        };
        _this.getOutputSampleRateHz = function () {
            return _this.mConfig.sampleRate;
        };
        _this.update = function () {
            _this.mIsUpdated.compareAndSet(false, true);
        };
        _this.queueInput = function (buffer) {
            if (_this.mSetupResult != 0) {
                _this.mOutputBuffer = buffer;
            }
            else if (buffer.hasRemaining()) {
                var inputSize = buffer.remaining();
                if (_this.mInputShortBuffer.capacity() < inputSize) {
                    _this.mInputShortBuffer.flip();
                    _this.mTempShortBuffer = java.nio.ShortBuffer.allocate(_this.mInputShortBuffer.limit());
                    _this.mTempShortBuffer.put(_this.mInputShortBuffer);
                    _this.mTempShortBuffer.position(0);
                    _this.initBuffer(inputSize + _this.mStackBufferSize * _this.mBytesPerSample);
                    _this.mInputShortBuffer.put(_this.mTempShortBuffer);
                    _this.mTempShortBuffer.clear();
                }
                _this.mProcessedBuffer.clear();
                _this.mProcessedShortBuffer.clear();
                _this.mInputShortBuffer.put(buffer.asShortBuffer());
                _this.mInputShortBuffer.flip();
                _this.mStackBufferSize += inputSize / _this.mBytesPerSample;
                var processingCount = _this.mStackBufferSize / _this.mFrameBufferSize;
                _this.process(processingCount);
                _this.mInputShortBuffer.compact();
                _this.mProcessedBuffer.flip();
                _this.mProcessedShortBuffer.flip();
                _this.mOutputBuffer = _this.mProcessedBuffer;
                buffer.position(buffer.position() + inputSize);
            }
        };
        _this.process = function (count) {
            for (var i = 0; i < count; i++) {
                _this.mInputShortBuffer.get(_this.mInputNativeShortArray, 0, _this.mFrameBufferSize);
                if (_this.mInitCore.get()) {
                    if (_this.mIsUpdated.get()) {
                        var result = _this.mSolMusicOne.update(_this.mInfo.params);
                        _this.mIsUpdated.compareAndSet(true, false);
                        android.util.Log.d("[GaudioSolMusicOne] ", "update : " + result);
                    }
                    _this.mSolMusicOne.runShort(_this.mInputNativeShortArray, _this.mOutputProcessedShortArray, _this.mConfig.samplesPerBlock);
                    _this.mProcessedShortBuffer.put(_this.mOutputProcessedShortArray);
                    _this.mProcessedBuffer.position(_this.mProcessedShortBuffer.position() * _this.mBytesPerSample);
                }
                _this.mStackBufferSize -= _this.mFrameBufferSize;
            }
        };
        _this.setTrackIndex = function (index) {
            _this.mTrackIndex = index;
        };
        _this.queueEndOfStream = function () {
            _this.mInputEnded = true;
        };
        _this.getOutput = function () {
            return _this.mOutputBuffer;
        };
        _this.isEnded = function () {
            return _this.mInputEnded;
        };
        _this.flush = function () {
            if (_this.mInitCore.get()) {
                _this.mInputEnded = false;
                _this.mInputShortBuffer.clear();
                _this.mOutputBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;
                _this.mStackBufferSize = 0;
                _this.flushCore();
            }
        };
        _this.reset = function () {
            _this.mInputEnded = false;
            _this.mConfig.sampleRate = com.google.android.exoplayer2.Format.NO_VALUE;
            _this.mConfig.numInputChannels = com.google.android.exoplayer2.Format.NO_VALUE;
            _this.mProcessedBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;
            if (_this.mInitCore.get()) {
                _this.resetCore();
            }
        };
        _this.mInfo = mInfo;
        _this.mOutputBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;
        _this.mProcessedBuffer = com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER;
        _this.mProcessedShortBuffer = _this.mProcessedBuffer.asShortBuffer();
        _this.mStackBufferSize = 0;
        _this.mInitCore = new java.util.concurrent.atomic.AtomicBoolean(false);
        _this.mIsUpdated = new java.util.concurrent.atomic.AtomicBoolean(false);
        _this.mSolMusicOne = new com.gaudiolab.sol.android.SolMusicOne();
        _this.mSolMusicOne.addListener(_this);
        _this.mConfig = new com.gaudiolab.sol.android.Configuration();
        _this.mSolMusicOne.create();
        _this.mSolMusicOne.setLogLevel(1);
        return global.__native(_this);
    }
    ;
    GaudioProcessor = __decorate([
        Interfaces([com.google.android.exoplayer2.audio.AudioProcessor, com.gaudiolab.sol.android.SolMusicOneStatisticsEvent])
    ], GaudioProcessor);
    return GaudioProcessor;
}(java.lang.Object));
exports.GaudioProcessor = GaudioProcessor;
var ProcessorFactory = (function (_super) {
    __extends(ProcessorFactory, _super);
    function ProcessorFactory(context, solEqualizer) {
        var _this = _super.call(this, context) || this;
        _this.buildAudioProcessors = function () {
            return [_this.solEqualizer];
        };
        _this.context = context;
        _this.solEqualizer = solEqualizer;
        return global.__native(_this);
    }
    return ProcessorFactory;
}(com.google.android.exoplayer2.DefaultRenderersFactory));
exports.ProcessorFactory = ProcessorFactory;
var PlaybackInformation = (function (_super) {
    __extends(PlaybackInformation, _super);
    function PlaybackInformation() {
        var _this = _super.call(this) || this;
        _this.getEqualizerBandGainDbFloatArray = function () {
            return _this.params.equalizerBandGainDb;
        };
        _this.params = new com.gaudiolab.sol.android.ControlParams();
        _this.params.isEnable = true;
        _this.params.preferenceFeatures = 0;
        _this.params.loudnessType = com.gaudiolab.sol.android.SolMusicOne.LoudnessType.Basic.ordinal();
        _this.params.targetLoudness = -16;
        _this.params.loudnessType = 0;
        _this.params.environmentOffset = 0;
        _this.params.equalizerBandCount = PlaybackInformation_1.EQ_BAND_COUNT;
        _this.params.equalizerBandGainDb = Array(PlaybackInformation_1.EQ_BAND_COUNT);
        _this.params.equalizerGlobalGainDb = 0;
        _this.params.volumeGains = 0;
        _this.params.eleqVolume = 0;
        _this.params.upmixType = 0;
        _this.params.upmixGenre = 0;
        _this.params.reverbIntensity = 0;
        _this.params.metadataLength = 0;
        _this.params.metadata = null;
        _this.presetType = 0;
        _this.deviceType = 0;
        return global.__native(_this);
    }
    PlaybackInformation_1 = PlaybackInformation;
    var PlaybackInformation_1;
    PlaybackInformation.KEY_PLAYBACK_INFORMATION = "PlaybackInformation";
    PlaybackInformation.EQ_BAND_COUNT = 10;
    PlaybackInformation = PlaybackInformation_1 = __decorate([
        Interfaces([java.io.Serializable])
    ], PlaybackInformation);
    return PlaybackInformation;
}(java.lang.Object));
exports.PlaybackInformation = PlaybackInformation;

package technology.master.exoplayer;

import android.util.Log;

import com.gaudiolab.sol.android.ControlParams;
import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.Format;
import com.google.android.exoplayer2.audio.AudioProcessor;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ShortBuffer;
import java.util.concurrent.atomic.AtomicBoolean;
import com.gaudiolab.sol.android.SolMusicOne;
import com.gaudiolab.sol.android.Configuration;
import com.gaudiolab.sol.android.SolMusicOneStatisticsEvent;
import com.google.android.exoplayer2.DefaultRenderersFactory;


public class GaudioProcessor implements AudioProcessor, SolMusicOneStatisticsEvent {
  private int NUM_BUFFER_FOR_GUARD = 10;;
  private int SAMPLES_PER_BLOCK = 512;
  private int BITS_PER_BYTE = 8;

  private int mFrameBufferSize = 0;
  private int mStackBufferSize = 0;
  private int mBytesPerSample = 0;
  private int mBitsPerSample = 0;
  private boolean mInputEnded = false;

  private AtomicBoolean mInitCore;
  private SolMusicOne mSolMusicOne;

  private Configuration mConfig;


  // Buffers
  private short[] mInputNativeShortArray;
  private short[] mOutputProcessedShortArray;

  private ShortBuffer mInputShortBuffer;
  private ShortBuffer mTempShortBuffer;
  private ShortBuffer mProcessedShortBuffer;

  private ByteBuffer mOutputBuffer;
  private ByteBuffer mProcessedBuffer;
  private int mTrackIndex = 0;
  private int mSetupResult = 0;

  private AtomicBoolean mIsUpdated;
  private PlaybackInformation mInfo;

  public GaudioProcessor(PlaybackInformation mInfo) {
    this.mInfo = mInfo;

    mOutputBuffer = AudioProcessor.EMPTY_BUFFER;
    mProcessedBuffer = AudioProcessor.EMPTY_BUFFER;
    mProcessedShortBuffer = mProcessedBuffer.asShortBuffer();
    mStackBufferSize = 0;

    mInitCore = new AtomicBoolean(false);
    mIsUpdated = new AtomicBoolean(false);
    mSolMusicOne = new SolMusicOne();
    mSolMusicOne.addListener(this);

    mConfig = new Configuration();

    mSolMusicOne.create();
    // 1: Info, 2: Warning, 3: Error
    mSolMusicOne.setLogLevel(1);
  }

  @Override
  public void onSolStatisticsNCPLStarted(float gain, float startTime) {
    Log.d("[NCPL Start]", "Start Time: " + startTime + "   Gain: " + gain);
  }

  @Override
  public void onSolStatisticsNCPLEnded(float gain, float endTime) {
    Log.d("[NCPL End]", "End Time: " + endTime + "   Gain: " + gain);
  }

  @Override
  public void onSolStatisticsPumpingDetected(float time, float pumpingValue) {
    Log.d("[Pumping Detected]", "Time: " + time + "   Gain: " + pumpingValue);
  }

  @Override
  public boolean configure(int sampleRateHz, int channelCount, int encoding) throws UnhandledFormatException {
    if (encoding != C.ENCODING_PCM_16BIT) {
      throw new AudioProcessor.UnhandledFormatException(sampleRateHz, channelCount, encoding);
    } else {
      mBitsPerSample = 16;
    }
    if (mInitCore.get()) {
      resetCore();
    }
    mConfig.sampleRate = sampleRateHz;
    mConfig.numInputChannels = channelCount;
    mConfig.samplesPerBlock = SAMPLES_PER_BLOCK;
    mConfig.format = SolMusicOne.Format.S16leI.ordinal();

    mFrameBufferSize = SAMPLES_PER_BLOCK * mConfig.numInputChannels;
    mBytesPerSample = mBitsPerSample / BITS_PER_BYTE;
    int initBufferSize = mFrameBufferSize * mBytesPerSample * NUM_BUFFER_FOR_GUARD;

    if (!mInitCore.get()) {
      initBuffer(initBufferSize);
      setupCore();
    }
    mTrackIndex++;
    return true;
  }

  private void initBuffer(int initBufferSize) {
    mInputNativeShortArray = new short[mFrameBufferSize];
    mOutputProcessedShortArray = new short[mFrameBufferSize];

    mInputShortBuffer = ShortBuffer.allocate(initBufferSize);
    mProcessedBuffer = ByteBuffer.allocateDirect(initBufferSize * mBytesPerSample).order(ByteOrder.nativeOrder());
    mProcessedShortBuffer = mProcessedBuffer.asShortBuffer();
    mProcessedBuffer.flip();
    mProcessedShortBuffer.flip();
  }

  private void setupCore() {
    if (!mInitCore.get()) {
      mInitCore.compareAndSet(false, true);
      if (mTrackIndex >= mInfo.solFilePath.size()) {
        mTrackIndex = 0;
      }

      byte[] metadata = getByteArrayFromFilePath(mInfo.solFilePath.get(mTrackIndex));
      ControlParams controlParams = new ControlParams();
      controlParams.metadata = null;
      controlParams.metadataLength = 0;

      if (metadata != null){
        controlParams.metadata = metadata;
        controlParams.metadataLength = metadata.length;
      }

      mInfo.params = controlParams;
      mSetupResult = mSolMusicOne.setup(mConfig, mInfo.params);
      Log.d("[GaudioSolMusicOne] ", "setupCore : " + mSetupResult);
    }
  }

  private byte[] getByteArrayFromFilePath(String metadataFilePath) {
    if (!new File(metadataFilePath).isFile()) {
      return null;
    }
    try {
      FileInputStream fis = new FileInputStream(new File(metadataFilePath));
      if (fis.available() == 0) {
        return null;
      }
      byte[] metadata = new byte[fis.available()];
      while (fis.read(metadata) != -1) {
      }
      fis.close();
      return metadata;
    } catch (IOException e) {
      e.printStackTrace();
      return null;
    }
  }

  public void destroyCore() {
    if (mInitCore.get()) {
      mInitCore.compareAndSet(true, false);
      int result = mSolMusicOne.destroy();
      Log.d("[GaudioSolMusicOne] ", "destroyCore : " + result);
    }
  }

  private void resetCore() {
    if (mInitCore.get()) {
      mInitCore.compareAndSet(true, false);
      int result = mSolMusicOne.reset();
      Log.d("[GaudioSolMusicOne] ", "resetCore : " + result);
    }
  }

  private void flushCore() {
    if (mInitCore.get()) {
      int result = mSolMusicOne.flush();
      Log.d("[GaudioSolMusicOne] ", "flushCore : " + result);
    }
  }

  @Override
  public boolean isActive() {
    return true;
  }

  @Override
  public int getOutputChannelCount() {
    return mConfig.numInputChannels;
  }

  @Override
  public int getOutputEncoding() {
    return C.ENCODING_PCM_16BIT;
  }

  @Override
  public int getOutputSampleRateHz() {
    return mConfig.sampleRate;
  }

  public void update() {
    mIsUpdated.compareAndSet(false, true);
  }

  @Override
  public void queueInput(ByteBuffer buffer) {
    if (mSetupResult != 0) {
      mOutputBuffer = buffer;
    } else if (buffer.hasRemaining()) {
      int inputSize = buffer.remaining();

      if (mInputShortBuffer.capacity() < inputSize) {
        // Put stacked input buffer in mTempShortBuffer
        mInputShortBuffer.flip();
        mTempShortBuffer = ShortBuffer.allocate(mInputShortBuffer.limit());
        mTempShortBuffer.put(mInputShortBuffer);
        mTempShortBuffer.position(0);

        initBuffer(inputSize + mStackBufferSize * mBytesPerSample);

        mInputShortBuffer.put(mTempShortBuffer);
        mTempShortBuffer.clear();
      }

      // Increase the limit to the capacity
      mProcessedBuffer.clear();
      mProcessedShortBuffer.clear();

      // Put input buffer and prepare to read the input buffer
      mInputShortBuffer.put(buffer.asShortBuffer());
      mInputShortBuffer.flip();

      // Gaudio processes processingCount times
      mStackBufferSize += inputSize / mBytesPerSample;
      int processingCount = mStackBufferSize / mFrameBufferSize;
      process(processingCount);

      // Move unread data to the beginning of the input buffer.
      mInputShortBuffer.compact();

      // Prepare to read the processed buffer
      mProcessedBuffer.flip();
      mProcessedShortBuffer.flip();

      mOutputBuffer = mProcessedBuffer;
      buffer.position(buffer.position() + inputSize);
    }
  }

  private void process(int count) {
    for (int i = 0; i < count; i++) {
      mInputShortBuffer.get(mInputNativeShortArray, 0, mFrameBufferSize);
      if (mInitCore.get()) {
        if (mIsUpdated.get()) {
          int result = mSolMusicOne.update(mInfo.params);
          mIsUpdated.compareAndSet(true, false);
          Log.d("[GaudioSolMusicOne] ", "update : " + result);
        }
        mSolMusicOne.runShort(mInputNativeShortArray, mOutputProcessedShortArray, mConfig.samplesPerBlock);


        mProcessedShortBuffer.put(mOutputProcessedShortArray);
        mProcessedBuffer.position(mProcessedShortBuffer.position() * mBytesPerSample);
      }
      mStackBufferSize -= mFrameBufferSize;
    }
  }

  public void setTrackIndex(int index) {
    mTrackIndex = index;
  }

  @Override
  public void queueEndOfStream() {
    mInputEnded = true;
  }

  @Override
  public ByteBuffer getOutput() {
    return mOutputBuffer;
  }

  @Override
  public boolean isEnded() {
    return mInputEnded;
  }

  @Override
  public void flush() {
    if(mInitCore.get()) {
      mInputEnded = false;
      mInputShortBuffer.clear();
      mOutputBuffer = AudioProcessor.EMPTY_BUFFER;
      mStackBufferSize = 0;
      flushCore();
    }
  }

  @Override
  public void reset() {
    mInputEnded = false;
    mConfig.sampleRate = Format.NO_VALUE;
    mConfig.numInputChannels = Format.NO_VALUE;
    mProcessedBuffer = AudioProcessor.EMPTY_BUFFER;
    if (mInitCore.get()) {
        resetCore();
    }
  }
}

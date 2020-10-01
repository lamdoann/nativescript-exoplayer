package technology.master.exoplayer;

import android.content.Context;

import com.google.android.exoplayer2.DefaultRenderersFactory;
import com.google.android.exoplayer2.audio.AudioProcessor;

public class ProcessorFactory extends DefaultRenderersFactory {
  Context context;
  AudioProcessor solEqualizer;
  public ProcessorFactory(Context context, AudioProcessor solEqualizer) {
    super((context));
    this.context = context;
    this.solEqualizer = solEqualizer;
  }

  @Override
  protected AudioProcessor[] buildAudioProcessors() {
    return new AudioProcessor[]{solEqualizer}; 
  }
}
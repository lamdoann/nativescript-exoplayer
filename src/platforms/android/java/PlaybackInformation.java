package technology.master.exoplayer;

import com.gaudiolab.sol.android.ControlParams;
import com.gaudiolab.sol.android.SolMusicOne;

import java.io.Serializable;
import java.util.ArrayList;

public class PlaybackInformation implements Serializable {
  static String KEY_PLAYBACK_INFORMATION = "PlaybackInformation";
  static int EQ_BAND_COUNT = 10;

  ControlParams params;

  /** user param **/
  int presetType;
  int deviceType;

  ArrayList<String> videoFilePath;
  ArrayList<String> solFilePath;
  boolean hasReadPermission;

  float[] equalizerBandGainDbFloatArray;

  public PlaybackInformation() {
    params = new ControlParams();

    params.isEnable = true;
    params.preferenceFeatures = 0;
    params.loudnessType = SolMusicOne.LoudnessType.Basic.ordinal();

    params.targetLoudness = -16f;
    params.loudnessType = 0;
    params.environmentOffset = 0f;

    params.equalizerBandCount = EQ_BAND_COUNT;
    params.equalizerBandGainDb = new float[EQ_BAND_COUNT];
    params.equalizerGlobalGainDb = 0f;

    params.volumeGains = 0f;
    params.eleqVolume = 0f;

    params.upmixType = 0;
    params.upmixGenre = 0;
    params.reverbIntensity = 0f;

    params.metadataLength = 0;
    params.metadata = null;

    presetType = 0;
    deviceType = 0;

    for (int i = 0; i < EQ_BAND_COUNT; i++) {
        params.equalizerBandGainDb[i] = 0.0f;
    }

    videoFilePath = new ArrayList();
    solFilePath = new ArrayList();
    hasReadPermission = false;
  }

  public float[] getEqualizerBandGainDbFloatArray() {
    return params.equalizerBandGainDb;
  }
}

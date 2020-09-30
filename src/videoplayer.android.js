"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Video = void 0;
var videoplayer_common_1 = require("./videoplayer-common");
var nsUtils = require("tns-core-modules/utils/utils");
var nsApp = require("tns-core-modules/application");
var gaudio_processor_android_1 = require("./gaudio-processor/gaudio-processor.android");
__exportStar(require("./videoplayer-common"), exports);
var STATE_IDLE = 1;
var STATE_BUFFERING = 2;
var STATE_READY = 3;
var STATE_ENDED = 4;
var SURFACE_WAITING = 0;
var SURFACE_READY = 1;
var Video = (function (_super) {
    __extends(Video, _super);
    function Video() {
        var _this = _super.call(this) || this;
        _this._boundStart = _this.resumeEvent.bind(_this);
        _this._boundStop = _this.suspendEvent.bind(_this);
        _this.enableSubtitles = false;
        _this.TYPE = { DETECT: 0, SS: 1, DASH: 2, HLS: 3, OTHER: 4 };
        _this._textureView = null;
        _this.nativeView = null;
        _this.videoWidth = 0;
        _this.videoHeight = 0;
        _this._onReadyEmitEvent = [];
        _this._suspendLocation = null;
        _this._src = null;
        _this.mediaState = SURFACE_WAITING;
        _this.textureSurface = null;
        _this.textureSurfaceSet = false;
        _this.mediaPlayer = null;
        _this.mediaController = null;
        _this.preSeekTime = -1;
        _this.videoOpened = false;
        _this.eventPlaybackReady = false;
        _this.eventPlaybackStart = false;
        _this.lastTimerUpdate = -1;
        _this.interval = null;
        _this._mInfo = new gaudio_processor_android_1.PlaybackInformation();
        _this._gaudioProcessor = new gaudio_processor_android_1.GaudioProcessor(_this._mInfo);
        return _this;
    }
    Object.defineProperty(Video.prototype, "playState", {
        get: function () {
            if (!this.mediaPlayer) {
                return STATE_IDLE;
            }
            return this.mediaPlayer.getPlaybackState();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Video.prototype, "android", {
        get: function () {
            return this.nativeView;
        },
        enumerable: false,
        configurable: true
    });
    Video.prototype[videoplayer_common_1.videoSourceProperty.setNative] = function (value) {
        this._setNativeVideo(value ? value.android : null);
    };
    Video.prototype[videoplayer_common_1.subtitleSourceProperty.setNative] = function (value) {
        this._updateSubtitles(value ? value.android : null);
    };
    Video.prototype._setupTextureSurface = function () {
        if (!this.textureSurface) {
            if (!this._textureView.isAvailable()) {
                return;
            }
            this.textureSurface = new android.view.Surface(this._textureView.getSurfaceTexture());
        }
        if (this.textureSurface) {
            if (!this.mediaPlayer) {
                return;
            }
            if (!this.textureSurfaceSet) {
                this.mediaPlayer.setVideoSurface(this.textureSurface);
                this.mediaState = SURFACE_READY;
            }
            else {
                this.mediaState = SURFACE_WAITING;
            }
            if (!this.videoOpened) {
                this._openVideo();
            }
        }
    };
    Video.prototype.createNativeView = function () {
        var nativeView = new android.widget.RelativeLayout(this._context);
        this._textureView = new android.view.TextureView(this._context);
        this._textureView.setFocusable(true);
        this._textureView.setFocusableInTouchMode(true);
        this._textureView.requestFocus();
        nativeView.addView(this._textureView);
        if (this.enableSubtitles) {
            this._subtitlesView = new com.google.android.exoplayer2.ui.SubtitleView(this._context);
            this._subtitlesView.setUserDefaultStyle();
            this._subtitlesView.setUserDefaultTextSize();
            nativeView.addView(this._subtitlesView);
        }
        return nativeView;
    };
    Video.prototype.initNativeView = function () {
        _super.prototype.initNativeView.call(this);
        var that = new WeakRef(this);
        this._setupMediaController();
        this._textureView.setOnTouchListener(new android.view.View.OnTouchListener({
            get owner() {
                return that.get();
            },
            onTouch: function () {
                if (this.owner) {
                    this.owner.toggleMediaControllerVisibility();
                }
                return false;
            }
        }));
        this._textureView.setSurfaceTextureListener(new android.view.TextureView.SurfaceTextureListener({
            get owner() {
                return that.get();
            },
            onSurfaceTextureSizeChanged: function (surface, width, height) {
                console.log("SurfaceTexutureSizeChange", width, height);
                this.owner._setupAspectRatio();
            },
            onSurfaceTextureAvailable: function () {
                if (this.owner) {
                    this.owner._setupTextureSurface();
                }
            },
            onSurfaceTextureDestroyed: function () {
                if (!this.owner) {
                    return true;
                }
                if (this.owner.textureSurface !== null) {
                    this.owner.textureSurfaceSet = false;
                    this.owner.textureSurface.release();
                    this.owner.textureSurface = null;
                }
                if (this.owner.mediaController !== null) {
                    this.owner.mediaController.hide();
                }
                this.owner.release();
                return true;
            },
            onSurfaceTextureUpdated: function () {
            }
        }));
        nsApp.on(nsApp.suspendEvent, this._boundStop);
        nsApp.on(nsApp.resumeEvent, this._boundStart);
    };
    Video.prototype.disposeNativeView = function () {
        this.disableEventTracking();
    };
    Video.prototype.disableEventTracking = function () {
        nsApp.off(nsApp.suspendEvent, this._boundStop);
        nsApp.off(nsApp.resumeEvent, this._boundStart);
    };
    Video.prototype.toggleMediaControllerVisibility = function () {
        if (!this.mediaController || !this.mediaPlayer) {
            return;
        }
        if (this.mediaController.isVisible()) {
            this.mediaController.hide();
        }
        else {
            this.mediaController.show();
        }
    };
    Video.prototype._setupMediaPlayerListeners = function () {
        var that = new WeakRef(this);
        var vidListener = new com.google.android.exoplayer2.SimpleExoPlayer.VideoListener({
            get owner() {
                return that.get();
            },
            onRenderedFirstFrame: function () {
                if (this.owner && !this.owner.eventPlaybackReady) {
                    this.owner.eventPlaybackReady = true;
                    this.owner._emit(videoplayer_common_1.Video.playbackReadyEvent);
                }
            },
            onVideoSizeChanged: function (width, height) {
                if (this.owner) {
                    this.owner.videoWidth = width;
                    this.owner.videoHeight = height;
                    if (this.owner.fill !== videoplayer_common_1.VideoFill.aspectFill) {
                        this.owner._setupAspectRatio();
                    }
                }
            }
        });
        var evtListener = new com.google.android.exoplayer2.ExoPlayer.EventListener({
            get owner() {
                return that.get();
            },
            onLoadingChanged: function () {
            },
            onPlayerError: function (error) {
                console.error("PlayerError", error);
            },
            onPlayerStateChanged: function (playWhenReady, playbackState) {
                if (!this.owner) {
                    return;
                }
                if (!this.owner.textureSurfaceSet) {
                    this.owner._setupTextureSurface();
                }
                if (playbackState === STATE_READY) {
                    if (!this.owner.textureSurfaceSet && !this.owner.eventPlaybackReady) {
                        this.owner.eventPlaybackReady = true;
                        this.owner._emit(videoplayer_common_1.Video.playbackReadyEvent);
                    }
                    if (this.owner._onReadyEmitEvent.length) {
                        do {
                            this.owner._emit(this.owner._onReadyEmitEvent.shift());
                        } while (this.owner._onReadyEmitEvent.length);
                    }
                    if (playWhenReady && !this.owner.eventPlaybackStart) {
                        this.owner.eventPlaybackStart = true;
                    }
                }
                else if (playbackState === STATE_ENDED) {
                    if (!this.owner.loop) {
                        this.owner.eventPlaybackStart = false;
                        this.owner.stopCurrentTimer();
                    }
                    this.owner._emit(videoplayer_common_1.Video.finishedEvent);
                    if (this.owner.loop) {
                        this.owner.play();
                    }
                }
            },
            onPositionDiscontinuity: function () {
            },
            onSeekProcessed: function () {
            },
            onTimelineChanged: function () {
            },
            onTracksChanged: function () {
            }
        });
        this.mediaPlayer.setVideoListener(vidListener);
        this.mediaPlayer.addListener(evtListener);
    };
    Video.prototype._setupMediaController = function () {
        if (this.controls !== false || this.controls === undefined) {
            if (this.mediaController == null) {
                this.mediaController = new com.google.android.exoplayer2.ui.PlaybackControlView(this._context);
                this.nativeView.addView(this.mediaController);
                var params = this.mediaController.getLayoutParams();
                params.addRule(14);
                params.addRule(12);
                this.mediaController.setLayoutParams(params);
            }
            else {
                return;
            }
        }
    };
    Video.prototype._setupAspectRatio = function () {
        if (!this._textureView) {
            return;
        }
        var viewWidth = this._textureView.getWidth();
        var viewHeight = this._textureView.getHeight();
        var aspectRatio = this.videoHeight / this.videoWidth;
        var newWidth;
        var newHeight;
        if (viewHeight > (viewWidth * aspectRatio)) {
            newWidth = viewWidth;
            newHeight = (viewWidth * aspectRatio);
        }
        else {
            newWidth = (viewHeight / aspectRatio);
            newHeight = viewHeight;
        }
        var xoff = (viewWidth - newWidth) / 2;
        var yoff = (viewHeight - newHeight) / 2;
        var txform = new android.graphics.Matrix();
        this._textureView.getTransform(txform);
        txform.setScale(newWidth / viewWidth, newHeight / viewHeight);
        txform.postTranslate(xoff, yoff);
        this._textureView.setTransform(txform);
    };
    Video.prototype._detectTypeFromSrc = function (uri) {
        if (this.srcType > 0 && this.srcType <= 4) {
            if (this.srcType == 1)
                return this.TYPE.SS;
            if (this.srcType == 2)
                return this.TYPE.DASH;
            if (this.srcType == 3)
                return this.TYPE.HLS;
            if (this.srcType == 4)
                return this.TYPE.OTHER;
        }
        var type = com.google.android.exoplayer2.util.Util.inferContentType(uri);
        switch (type) {
            case 0:
                return this.TYPE.DASH;
            case 1:
                return this.TYPE.SS;
            case 2:
                return this.TYPE.HLS;
            default:
                return this.TYPE.OTHER;
        }
    };
    Video.prototype._openVideo = function () {
        if (this._src === null) {
            return;
        }
        this.release();
        if (!this.interval && this.observeCurrentTime) {
            this.startCurrentTimer();
        }
        this.videoOpened = true;
        var am = nsUtils.ad.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        am.requestAudioFocus(null, android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.AUDIOFOCUS_GAIN);
        try {
            var bm = new com.google.android.exoplayer2.upstream.DefaultBandwidthMeter();
            var trackSelection = new com.google.android.exoplayer2.trackselection.AdaptiveTrackSelection.Factory(bm);
            var trackSelector = new com.google.android.exoplayer2.trackselection.DefaultTrackSelector(trackSelection);
            var loadControl = new com.google.android.exoplayer2.DefaultLoadControl();
            this.mediaPlayer = com.google.android.exoplayer2.ExoPlayerFactory.newSimpleInstance(new gaudio_processor_android_1.ProcessorFactory(this._context, this._gaudioProcessor), trackSelector);
            if (this.textureSurface && !this.textureSurfaceSet) {
                this.textureSurfaceSet = true;
                this.mediaPlayer.setVideoSurface(this.textureSurface);
            }
            else {
                this._setupTextureSurface();
            }
            if (this.enableSubtitles) {
                this.mediaPlayer.setTextOutput(this._subtitlesView);
            }
            var dsf = new com.google.android.exoplayer2.upstream.DefaultDataSourceFactory(this._context, "NativeScript", bm);
            var ef = new com.google.android.exoplayer2.extractor.DefaultExtractorsFactory();
            var vs = void 0, uri = void 0;
            if (this._src instanceof String || typeof this._src === "string") {
                uri = android.net.Uri.parse(this._src);
                var type = this._detectTypeFromSrc(uri);
                switch (type) {
                    case this.TYPE.SS:
                        vs = new com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource(uri, dsf, new com.google.android.exoplayer2.source.smoothstreaming.DefaultSsChunkSource.Factory(dsf), null, null);
                        break;
                    case this.TYPE.DASH:
                        vs = new com.google.android.exoplayer2.source.dash.DashMediaSource(uri, dsf, new com.google.android.exoplayer2.source.dash.DefaultDashChunkSource.Factory(dsf), null, null);
                        break;
                    case this.TYPE.HLS:
                        vs = new com.google.android.exoplayer2.source.hls.HlsMediaSource(uri, dsf, null, null);
                        break;
                    default:
                        if (this.encryptionKey) {
                            var cipherFactory = new CipherFactory(this.encryptionKey);
                            dsf = new EncryptedDataSourceFactory(cipherFactory.cipher, cipherFactory.secretKeySpec, cipherFactory.ivParameterSpec);
                        }
                        vs = new com.google.android.exoplayer2.source.ExtractorMediaSource(uri, dsf, ef, null, null);
                }
            }
            else if (typeof this._src.typeSource === "number") {
                uri = android.net.Uri.parse(this._src.url);
                switch (this._src.typeSource) {
                    case this.TYPE.SS:
                        vs = new com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource(uri, dsf, new com.google.android.exoplayer2.source.smoothstreaming.DefaultSsChunkSource.Factory(dsf), null, null);
                        break;
                    case this.TYPE.DASH:
                        vs = new com.google.android.exoplayer2.source.dash.DashMediaSource(uri, dsf, new com.google.android.exoplayer2.source.dash.DefaultDashChunkSource.Factory(dsf), null, null);
                        break;
                    case this.TYPE.HLS:
                        vs = new com.google.android.exoplayer2.source.hls.HlsMediaSource(uri, dsf, null, null);
                        break;
                    default:
                        vs = new com.google.android.exoplayer2.source.ExtractorMediaSource(uri, dsf, ef, null, null, null);
                }
            }
            else {
                vs = this._src;
            }
            try {
                if (this._subtitlesSrc != null && this._subtitlesSrc.trim() != "") {
                    var subtitleUri = android.net.Uri.parse(this._subtitlesSrc.trim());
                    var textFormat = com.google.android.exoplayer2.Format.createTextSampleFormat(null, com.google.android.exoplayer2.util.MimeTypes.APPLICATION_SUBRIP, null, com.google.android.exoplayer2.Format.NO_VALUE, com.google.android.exoplayer2.Format.NO_VALUE, "en", null, com.google.android.exoplayer2.Format.OFFSET_SAMPLE_RELATIVE);
                    var subtitlesSrc = new com.google.android.exoplayer2.source.SingleSampleMediaSource.Factory(dsf).createMediaSource(subtitleUri, textFormat, com.google.android.exoplayer2.C.TIME_UNSET);
                    var mergedArray = Array.create(com.google.android.exoplayer2.source.MediaSource, 2);
                    mergedArray[0] = vs;
                    mergedArray[1] = subtitlesSrc;
                    vs = new com.google.android.exoplayer2.source.MergingMediaSource(mergedArray);
                }
            }
            catch (ex) {
                console.log("Error loading subtitles:", ex, ex.stack);
            }
            if (this.mediaController) {
                this.mediaController.setPlayer(this.mediaPlayer);
            }
            this._setupMediaPlayerListeners();
            this.mediaPlayer.prepare(vs);
            if (this.autoplay === true) {
                this.mediaPlayer.setPlayWhenReady(true);
            }
            if (this.preSeekTime > 0) {
                this.mediaPlayer.seekTo(this.preSeekTime);
                this.preSeekTime = -1;
            }
            this.mediaState = SURFACE_READY;
        }
        catch (ex) {
            console.log("Error:", ex, ex.stack);
        }
    };
    Video.prototype._setNativeVideo = function (nativeVideo) {
        this._src = nativeVideo;
        this._suspendLocation = 0;
        this._openVideo();
    };
    Video.prototype.setNativeSource = function (nativePlayerSrc) {
        this._src = nativePlayerSrc;
        this._suspendLocation = 0;
        this._openVideo();
    };
    Video.prototype._updateSubtitles = function (subtitlesSrc) {
        if (this.enableSubtitles) {
            this._subtitlesSrc = subtitlesSrc;
            if (this.mediaPlayer != null) {
                this.preSeekTime = this.mediaPlayer.getCurrentPosition();
            }
            this._openVideo();
        }
    };
    Video.prototype.play = function () {
        if (!this.mediaPlayer || this.mediaState === SURFACE_WAITING) {
            this._openVideo();
        }
        else if (this.playState === STATE_ENDED) {
            this.eventPlaybackStart = false;
            this.mediaPlayer.seekToDefaultPosition();
            this.startCurrentTimer();
        }
        else {
            this.mediaPlayer.setPlayWhenReady(true);
            this.startCurrentTimer();
        }
    };
    Video.prototype.pause = function () {
        if (this.mediaPlayer) {
            this.mediaPlayer.setPlayWhenReady(false);
        }
    };
    Video.prototype.mute = function (mute) {
        if (this.mediaPlayer) {
            if (mute === true) {
                this.mediaPlayer.setVolume(0);
            }
            else if (mute === false) {
                this.mediaPlayer.setVolume(1);
            }
        }
    };
    Video.prototype.stop = function () {
        if (this.mediaPlayer) {
            this.stopCurrentTimer();
            this.mediaPlayer.stop();
            this.release();
        }
    };
    Video.prototype._addReadyEvent = function (value) {
        if (this._onReadyEmitEvent.indexOf(value)) {
            return;
        }
        this._onReadyEmitEvent.push(value);
    };
    Video.prototype.seekToTime = function (ms) {
        this._addReadyEvent(videoplayer_common_1.Video.seekToTimeCompleteEvent);
        if (!this.mediaPlayer) {
            this.preSeekTime = ms;
            return;
        }
        else {
            this.preSeekTime = -1;
        }
        this.mediaPlayer.seekTo(ms);
    };
    Video.prototype.isPlaying = function () {
        if (!this.mediaPlayer) {
            return false;
        }
        if (this.playState === STATE_READY) {
            return this.mediaPlayer.getPlayWhenReady();
        }
        return false;
    };
    Video.prototype.getDuration = function () {
        if (!this.mediaPlayer || this.mediaState === SURFACE_WAITING || this.playState === STATE_IDLE) {
            return 0;
        }
        var duration = this.mediaPlayer.getDuration();
        if (isNaN(duration)) {
            return 0;
        }
        else {
            return duration;
        }
    };
    Video.prototype.getCurrentTime = function () {
        if (!this.mediaPlayer) {
            return 0;
        }
        return this.mediaPlayer.getCurrentPosition();
    };
    Video.prototype.setVolume = function (volume) {
        if (this.mediaPlayer) {
            this.mediaPlayer.setVolume(volume);
        }
    };
    Video.prototype.destroy = function () {
        this.release();
        this.src = null;
        this._textureView = null;
        this.mediaPlayer = null;
        this.mediaController = null;
    };
    Video.prototype.release = function () {
        this.stopCurrentTimer();
        this.videoOpened = false;
        this.eventPlaybackReady = false;
        this.eventPlaybackStart = false;
        this.textureSurfaceSet = false;
        if (this.mediaPlayer !== null) {
            this.mediaState = SURFACE_WAITING;
            this.mediaPlayer.release();
            this.mediaPlayer = null;
            if (this.mediaController && this.mediaController.isVisible()) {
                this.mediaController.hide();
            }
            var am = nsUtils.ad.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            am.abandonAudioFocus(null);
        }
    };
    Video.prototype.suspendEvent = function () {
        this._suspendLocation = this.getCurrentTime();
        this.release();
    };
    Video.prototype.resumeEvent = function () {
        if (this._suspendLocation) {
            this.seekToTime(this._suspendLocation);
            this._suspendLocation = 0;
        }
        this._openVideo();
    };
    Video.prototype.startCurrentTimer = function () {
        var _this = this;
        if (this.interval) {
            return;
        }
        this.lastTimerUpdate = -1;
        this.interval = setInterval(function () {
            _this.fireCurrentTimeEvent();
        }, 200);
    };
    Video.prototype.fireCurrentTimeEvent = function () {
        if (!this.mediaPlayer) {
            return;
        }
        var curTimer = this.mediaPlayer.getCurrentPosition();
        if (curTimer !== this.lastTimerUpdate) {
            this.notify({
                eventName: videoplayer_common_1.Video.currentTimeUpdatedEvent,
                object: this,
                position: curTimer
            });
            this.lastTimerUpdate = curTimer;
        }
    };
    Video.prototype.stopCurrentTimer = function () {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.fireCurrentTimeEvent();
    };
    return Video;
}(videoplayer_common_1.Video));
exports.Video = Video;
var EncryptedDataSourceFactory = (function (_super) {
    __extends(EncryptedDataSourceFactory, _super);
    function EncryptedDataSourceFactory(cipher, secretKeySpec, ivParameterSpec) {
        var _this = _super.call(this) || this;
        _this.createDataSource = function () {
            return new EncryptedDataSource(_this.cipher, _this.secretKeySpec, _this.ivParameterSpec);
        };
        _this.cipher = cipher;
        _this.secretKeySpec = secretKeySpec;
        _this.ivParameterSpec = ivParameterSpec;
        return global.__native(_this);
    }
    EncryptedDataSourceFactory = __decorate([
        Interfaces([com.google.android.exoplayer2.upstream.DataSource.Factory])
    ], EncryptedDataSourceFactory);
    return EncryptedDataSourceFactory;
}(java.lang.Object));
var EncryptedDataSource = (function (_super) {
    __extends(EncryptedDataSource, _super);
    function EncryptedDataSource(cipher, secretKeySpec, ivParameterSpec) {
        var _this = _super.call(this) || this;
        _this.getResponseHeaders = function () {
        };
        _this.addTransferListener = function (transferListener) { };
        _this.open = function (dataSpec) {
            if (_this.opened) {
                return _this.bytesRemaining;
            }
            _this.uri = dataSpec.uri;
            try {
                _this.setupInputStream();
                _this.skipToPosition(dataSpec);
                _this.computeBytesRemaining(dataSpec);
            }
            catch (err) {
                throw new EncryptedFileDataSourceException(err);
            }
            _this.opened = true;
            return _this.bytesRemaining;
        };
        _this.setupInputStream = function () {
            var encryptedFile = new java.io.File(_this.uri.getPath());
            var fileInputStream = new java.io.FileInputStream(encryptedFile);
            _this.inputStream = new StreamingCipherInputStream(fileInputStream, _this.cipher, _this.secretKeySpec, _this.ivParameterSpec);
        };
        _this.skipToPosition = function (dataSpec) {
            _this.inputStream.forceSkip(dataSpec.position);
        };
        _this.computeBytesRemaining = function (dataSpec) {
            if (dataSpec.length != com.google.android.exoplayer2.C.LENGTH_UNSET) {
                _this.bytesRemaining = dataSpec.length;
            }
            else {
                _this.bytesRemaining = _this.inputStream.available();
                if (_this.bytesRemaining == java.lang.Integer.MAX_VALUE) {
                    _this.bytesRemaining = com.google.android.exoplayer2.C.LENGTH_UNSET;
                }
            }
        };
        _this.read = function (buffer, offset, readLength) {
            if (readLength == 0) {
                return 0;
            }
            else if (_this.bytesRemaining == 0) {
                return com.google.android.exoplayer2.C.RESULT_END_OF_INPUT;
            }
            var bytesToRead = _this.getBytesToRead(readLength);
            var bytesRead;
            try {
                bytesRead = _this.inputStream.read(buffer, offset, bytesToRead);
            }
            catch (e) {
                throw new EncryptedFileDataSourceException(e);
            }
            if (bytesRead == -1) {
                if (_this.bytesRemaining != com.google.android.exoplayer2.C.LENGTH_UNSET) {
                    throw new EncryptedFileDataSourceException(new java.io.EOFException());
                }
                return com.google.android.exoplayer2.C.RESULT_END_OF_INPUT;
            }
            if (_this.bytesRemaining != com.google.android.exoplayer2.C.LENGTH_UNSET) {
                _this.bytesRemaining += -bytesRead;
            }
            return bytesRead;
        };
        _this.getBytesToRead = function (bytesToRead) {
            if (_this.bytesRemaining === com.google.android.exoplayer2.C.LENGTH_UNSET) {
                return bytesToRead;
            }
            var minBytesToRead = java.lang.Math.min(_this.bytesRemaining, bytesToRead);
            return Number.parseInt(minBytesToRead);
        };
        _this.getUri = function () {
            return _this.uri;
        };
        _this.close = function () {
            _this.uri = null;
            try {
                if (_this.inputStream != null) {
                    _this.inputStream.close();
                }
            }
            catch (e) {
                throw new EncryptedFileDataSourceException(e);
            }
            finally {
                _this.inputStream = null;
                if (_this.opened) {
                    _this.opened = false;
                }
            }
        };
        _this.cipher = cipher;
        _this.secretKeySpec = secretKeySpec;
        _this.ivParameterSpec = ivParameterSpec;
        return global.__native(_this);
    }
    EncryptedDataSource = __decorate([
        Interfaces([com.google.android.exoplayer2.upstream.DataSource])
    ], EncryptedDataSource);
    return EncryptedDataSource;
}(java.lang.Object));
var StreamingCipherInputStream = (function (_super) {
    __extends(StreamingCipherInputStream, _super);
    function StreamingCipherInputStream(inputStream, cipher, secretKeySpec, ivParameterSpec) {
        var _this = _super.call(this, inputStream, cipher) || this;
        _this.read = function (b, off, len) {
            return _super.prototype.read.call(_this, b, off, len);
        };
        _this.forceSkip = function (bytesToSkip) {
            var skipped = _this.upstream.skip(bytesToSkip);
            try {
                var skip = Number.parseInt((bytesToSkip % StreamingCipherInputStream.AES_BLOCK_SIZE));
                var blockOffset = bytesToSkip - skip;
                var numberOfBlocks = blockOffset / StreamingCipherInputStream.AES_BLOCK_SIZE;
                var ivForOffsetAsBigInteger = new java.math.BigInteger(1, _this.ivParameterSpec.getIV()).add(java.math.BigInteger.valueOf(numberOfBlocks));
                var ivForOffsetByteArray = ivForOffsetAsBigInteger.toByteArray();
                var computedIvParameterSpecForOffset = void 0;
                if (ivForOffsetByteArray.length < StreamingCipherInputStream.AES_BLOCK_SIZE) {
                    var resizedIvForOffsetByteArray = Array.create("byte", StreamingCipherInputStream.AES_BLOCK_SIZE);
                    java.lang.System.arraycopy(ivForOffsetByteArray, 0, resizedIvForOffsetByteArray, StreamingCipherInputStream.AES_BLOCK_SIZE - ivForOffsetByteArray.length, ivForOffsetByteArray.length);
                    computedIvParameterSpecForOffset = new javax.crypto.spec.IvParameterSpec(resizedIvForOffsetByteArray);
                }
                else {
                    computedIvParameterSpecForOffset = new javax.crypto.spec.IvParameterSpec(ivForOffsetByteArray, ivForOffsetByteArray.length - StreamingCipherInputStream.AES_BLOCK_SIZE, StreamingCipherInputStream.AES_BLOCK_SIZE);
                }
                _this.cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, _this.secretKeySpec, computedIvParameterSpecForOffset);
                var skipBuffer = Array.create("byte", skip);
                _this.cipher.update(skipBuffer, 0, skip, skipBuffer);
                java.util.Arrays.fill(skipBuffer, (new java.lang.Byte("0")).byteValue());
            }
            catch (e) {
                return 0;
            }
            return skipped;
        };
        _this.available = function () {
            return _this.upstream.available();
        };
        _this.upstream = inputStream;
        _this.cipher = cipher;
        _this.secretKeySpec = secretKeySpec;
        _this.ivParameterSpec = ivParameterSpec;
        return global.__native(_this);
    }
    StreamingCipherInputStream.AES_BLOCK_SIZE = 16;
    return StreamingCipherInputStream;
}(javax.crypto.CipherInputStream));
var CipherFactory = (function () {
    function CipherFactory(encryptionKey) {
        var _this = this;
        this.createCipher = function (keySpec, ivSpec) {
            var cipher = javax.crypto.Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, keySpec, ivSpec);
            return cipher;
        };
        this.createSecretKeySpec = function () {
            var secretKey = new java.lang.String(_this.encryptionKey).getBytes('UTF-8');
            var keySpec = new javax.crypto.spec.SecretKeySpec(secretKey, "AES");
            return keySpec;
        };
        this.createIvParameterSpec = function () {
            var ivKey = new java.lang.String(_this.encryptionKey).getBytes('UTF-8');
            var ivSpec = new javax.crypto.spec.IvParameterSpec(ivKey);
            return ivSpec;
        };
        this.encryptionKey = encryptionKey;
        this.secretKeySpec = this.createSecretKeySpec();
        this.ivParameterSpec = this.createIvParameterSpec();
        this.cipher = this.createCipher(this.secretKeySpec, this.ivParameterSpec);
    }
    return CipherFactory;
}());
var EncryptedFileDataSourceException = (function (_super) {
    __extends(EncryptedFileDataSourceException, _super);
    function EncryptedFileDataSourceException(cause) {
        return _super.call(this, cause) || this;
    }
    return EncryptedFileDataSourceException;
}(java.io.IOException));

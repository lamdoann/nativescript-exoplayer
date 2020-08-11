"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Video = void 0;
var application_1 = require("tns-core-modules/application");
var videoplayer_common_1 = require("./videoplayer-common");
__exportStar(require("./videoplayer-common"), exports);
var Video = (function (_super) {
    __extends(Video, _super);
    function Video() {
        var _this = _super.call(this) || this;
        _this.enableSubtitles = false;
        _this._playerController = new AVPlayerViewController();
        var audioSession = AVAudioSession.sharedInstance();
        var output = audioSession.currentRoute.outputs.lastObject.portType;
        if (output.match(/Receiver/)) {
            try {
                audioSession.setCategoryError(AVAudioSessionCategoryPlayAndRecord);
                audioSession.overrideOutputAudioPortError(AVAudioSessionPortOverride.Speaker);
                audioSession.setActiveError(true);
            }
            catch (err) {
            }
        }
        _this._player = new AVPlayer();
        _this._playerController.player = _this._player;
        _this._playerController.showsPlaybackControls = false;
        _this.nativeView = _this._playerController.view;
        _this._observer = PlayerObserverClass.alloc();
        _this._observer["_owner"] = _this;
        _this._videoFinished = false;
        if (_this.enableSubtitles) {
            _this._subtitling = new ASBPlayerSubtitling();
            _this._setupSubtitleLabel();
        }
        return _this;
    }
    Object.defineProperty(Video.prototype, "ios", {
        get: function () {
            return this.nativeView;
        },
        enumerable: false,
        configurable: true
    });
    Video.prototype[videoplayer_common_1.videoSourceProperty.setNative] = function (value) {
        this._setNativeVideo(value ? value.ios : null);
    };
    Video.prototype[videoplayer_common_1.fillProperty.setNative] = function (value) {
        var videoGravity = AVLayerVideoGravityResize;
        switch (value) {
            case videoplayer_common_1.VideoFill.aspect:
                videoGravity = AVLayerVideoGravityResizeAspect;
                break;
            case videoplayer_common_1.VideoFill.aspectFill:
                videoGravity = AVLayerVideoGravityResizeAspectFill;
                break;
        }
        if (this._playerController) {
            this._playerController.videoGravity = videoGravity;
        }
    };
    Video.prototype[videoplayer_common_1.subtitleSourceProperty.setNative] = function (value) {
        this._updateSubtitles(value ? value.ios : null);
    };
    Video.prototype._setNativeVideo = function (nativeVideoPlayer) {
        if (nativeVideoPlayer != null) {
            var currentItem = this._player.currentItem;
            this._addStatusObserver(nativeVideoPlayer);
            this._autoplayCheck();
            this._videoFinished = false;
            if (currentItem !== null) {
                this._videoLoaded = false;
                this._videoPlaying = false;
                this._removeStatusObserver(currentItem);
                this._player.replaceCurrentItemWithPlayerItem(null);
                this._player.replaceCurrentItemWithPlayerItem(nativeVideoPlayer);
            }
            else {
                this._player.replaceCurrentItemWithPlayerItem(nativeVideoPlayer);
                this._init();
            }
        }
    };
    Video.prototype.updateAsset = function (nativeVideoAsset) {
        var newPlayerItem = AVPlayerItem.playerItemWithAsset(nativeVideoAsset);
        this._setNativeVideo(newPlayerItem);
    };
    Video.prototype._setNativePlayerSource = function (nativePlayerSrc) {
        this._src = nativePlayerSrc;
        var url = NSURL.URLWithString(this._src);
        this._player = new AVPlayer(url);
        this._init();
    };
    Video.prototype._init = function () {
        if (this.controls !== false) {
            this._playerController.showsPlaybackControls = true;
        }
        this._playerController.player = this._player;
        if (isNaN(this.width) || isNaN(this.height)) {
            this.requestLayout();
        }
        if (this.muted === true) {
            this._player.muted = true;
        }
        if (!this._didPlayToEndTimeActive) {
            this._didPlayToEndTimeObserver = application_1.ios.addNotificationObserver(AVPlayerItemDidPlayToEndTimeNotification, this.AVPlayerItemDidPlayToEndTimeNotification.bind(this));
            this._didPlayToEndTimeActive = true;
        }
        if (this.enableSubtitles) {
            this._subtitling.label = this._subtitleLabel;
            this._subtitling.containerView = this._subtitleLabelContainer;
            this._subtitling.player = this._player;
        }
    };
    Video.prototype._setupSubtitleLabel = function () {
        var contentOverlayView = this._playerController.contentOverlayView;
        this._subtitleLabel = new UILabel();
        this._subtitleLabelContainer = new UIView();
        contentOverlayView.addSubview(this._subtitleLabelContainer);
        this._subtitleLabelContainer.addSubview(this._subtitleLabel);
        this._subtitleLabelContainer.backgroundColor = UIColor.blackColor;
        this._subtitleLabelContainer.layer.cornerRadius = 2;
        this._subtitleLabelContainer.layer.masksToBounds = true;
        this._subtitleLabel.translatesAutoresizingMaskIntoConstraints = false;
        this._subtitleLabelContainer.translatesAutoresizingMaskIntoConstraints = false;
        var containerViewsDictionary = new NSDictionary([this._subtitleLabel], ['subtitleLabel']);
        this._subtitleLabelContainer.addConstraints(NSLayoutConstraint.constraintsWithVisualFormatOptionsMetricsViews("H:|-(5)-[subtitleLabel]-(5)-|", NSLayoutFormatOptions.DirectionLeadingToTrailing, null, containerViewsDictionary));
        this._subtitleLabelContainer.addConstraints(NSLayoutConstraint.constraintsWithVisualFormatOptionsMetricsViews("V:|-(0)-[subtitleLabel]-(0)-|", NSLayoutFormatOptions.DirectionLeadingToTrailing, null, containerViewsDictionary));
        this._subtitleLabel.textColor = UIColor.whiteColor;
        this._subtitleLabel.textAlignment = NSTextAlignment.Center;
        this._subtitleLabel.lineBreakMode = NSLineBreakMode.ByWordWrapping;
        this._subtitleLabel.font = UIFont.systemFontOfSizeWeight(15, UIFontWeightRegular);
        this._subtitleLabel.numberOfLines = 0;
        this._subtitleLabel.translatesAutoresizingMaskIntoConstraints = false;
        var viewsDictionary = new NSDictionary([this._subtitleLabelContainer, contentOverlayView], ['subtitleLabelContainer', 'superview']);
        contentOverlayView.addConstraints(NSLayoutConstraint.constraintsWithVisualFormatOptionsMetricsViews("H:|-(>=20)-[subtitleLabelContainer]-(>=20)-|", 0, null, viewsDictionary));
        contentOverlayView.addConstraints(NSLayoutConstraint.constraintsWithVisualFormatOptionsMetricsViews("V:[superview]-(<=1)-[subtitleLabelContainer]", NSLayoutFormatOptions.AlignAllCenterX, null, viewsDictionary));
        contentOverlayView.addConstraints(NSLayoutConstraint.constraintsWithVisualFormatOptionsMetricsViews("V:[subtitleLabelContainer]-(20)-|", 0, null, viewsDictionary));
    };
    Video.prototype._updateSubtitles = function (subtitles) {
        if (this.enableSubtitles) {
            try {
                this._subtitling.loadSRTContentError(subtitles);
            }
            catch (e) {
                console.log("Failed to load subtitles: " + e);
            }
        }
    };
    Video.prototype.AVPlayerItemDidPlayToEndTimeNotification = function (notification) {
        if (this._player.currentItem && this._player.currentItem === notification.object) {
            this._emit(videoplayer_common_1.Video.finishedEvent);
            this._videoFinished = true;
            if (this.loop === true && this._player !== null) {
                this._player.seekToTime(CMTimeMake(5, 100));
                this._player.play();
            }
        }
    };
    Video.prototype.play = function () {
        if (this._videoFinished) {
            this._videoFinished = false;
            this.seekToTime(CMTimeMake(5, 100));
        }
        if (this.observeCurrentTime && !this._playbackTimeObserverActive) {
            this._addPlaybackTimeObserver();
        }
        this._player.play();
    };
    Video.prototype.pause = function () {
        this._player.pause();
        if (this._playbackTimeObserverActive) {
            this._removePlaybackTimeObserver();
        }
    };
    Video.prototype.mute = function (mute) {
        this._player.muted = mute;
    };
    Video.prototype.seekToTime = function (ms) {
        var _this = this;
        if (this._player.currentItem && this._player.currentItem.status === AVPlayerItemStatus.ReadyToPlay) {
            var seconds = ms / 1000.0;
            var time = CMTimeMakeWithSeconds(seconds, this._player.currentTime().timescale);
            try {
                this._player.seekToTimeToleranceBeforeToleranceAfterCompletionHandler(time, kCMTimeZero, kCMTimeZero, function (isFinished) {
                    _this._emit(videoplayer_common_1.Video.seekToTimeCompleteEvent);
                });
            }
            catch (e) {
                console.error(e);
            }
        }
        else {
            console.log("AVPlayerItem cannot service a seek request with a completion handler until its status is ReadyToPlay.");
        }
    };
    Video.prototype.getDuration = function () {
        var seconds = CMTimeGetSeconds(this._player.currentItem.asset.duration);
        var milliseconds = seconds * 1000.0;
        return milliseconds;
    };
    Video.prototype.getCurrentTime = function () {
        if (this._player === null) {
            return false;
        }
        return (this._player.currentTime().value / this._player.currentTime().timescale) * 1000;
    };
    Video.prototype.setVolume = function (volume) {
        this._player.volume = volume;
    };
    Video.prototype.destroy = function () {
        this._removeStatusObserver(this._player.currentItem);
        if (this._didPlayToEndTimeActive) {
            application_1.ios.removeNotificationObserver(this._didPlayToEndTimeObserver, AVPlayerItemDidPlayToEndTimeNotification);
            this._didPlayToEndTimeActive = false;
        }
        if (this._playbackTimeObserverActive) {
            this._removePlaybackTimeObserver();
        }
        this.pause();
        this._player.replaceCurrentItemWithPlayerItem(null);
        this._playerController = null;
        this._player = null;
    };
    Video.prototype._addStatusObserver = function (currentItem) {
        this._observerActive = true;
        currentItem.addObserverForKeyPathOptionsContext(this._observer, "status", 0, null);
    };
    Video.prototype._removeStatusObserver = function (currentItem) {
        if (!this._observerActive) {
            return;
        }
        this._observerActive = false;
        if (currentItem) {
            currentItem.removeObserverForKeyPath(this._observer, "status");
        }
    };
    Video.prototype._addPlaybackTimeObserver = function () {
        var _this = this;
        this._playbackTimeObserverActive = true;
        var _interval = CMTimeMake(1, 5);
        this._playbackTimeObserver = this._player.addPeriodicTimeObserverForIntervalQueueUsingBlock(_interval, null, function (currentTime) {
            var _seconds = CMTimeGetSeconds(currentTime);
            var _milliseconds = _seconds * 1000.0;
            _this.notify({
                eventName: Video.currentTimeUpdatedEvent,
                object: _this,
                position: _milliseconds
            });
        });
    };
    Video.prototype._removePlaybackTimeObserver = function () {
        this._playbackTimeObserverActive = false;
        this._player.removeTimeObserver(this._playbackTimeObserver);
    };
    Video.prototype._autoplayCheck = function () {
        if (this.autoplay) {
            this.play();
        }
    };
    Video.prototype.playbackReady = function () {
        this._videoLoaded = true;
        this._emit(videoplayer_common_1.Video.playbackReadyEvent);
    };
    Video.prototype.playbackStart = function () {
        this._videoPlaying = true;
        this._emit(videoplayer_common_1.Video.playbackStartEvent);
    };
    return Video;
}(videoplayer_common_1.Video));
exports.Video = Video;
var PlayerObserverClass = (function (_super) {
    __extends(PlayerObserverClass, _super);
    function PlayerObserverClass() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PlayerObserverClass.prototype.observeValueForKeyPathOfObjectChangeContext = function (path, obj, change, context) {
        if (path === "status") {
            if (this["_owner"]._player.currentItem.status === AVPlayerItemStatus.ReadyToPlay && !this["_owner"]._videoLoaded) {
                this["_owner"].playbackReady();
            }
        }
    };
    return PlayerObserverClass;
}(NSObject));

﻿

import { Video as VideoBase, VideoFill, videoSourceProperty, subtitleSourceProperty } from "./videoplayer-common";
import * as nsUtils from "tns-core-modules/utils/utils";
import * as nsApp from "tns-core-modules/application";

export * from "./videoplayer-common";

declare const android: any, com: any, java: any, javax: any;

// States from Exo Player
const STATE_IDLE: number = 1;
const STATE_BUFFERING: number = 2;
const STATE_READY: number = 3;
const STATE_ENDED: number = 4;

const SURFACE_WAITING: number = 0;
const SURFACE_READY: number = 1;

export class Video extends VideoBase {
	private _textureView: any; /// android.widget.VideoView
	private _subtitlesView: any; /// com.google.android.exoplayer2.ui.SubtitleView
	private videoWidth: number;
	private videoHeight: number;
	private _src: any;
	private _subtitlesSrc: any;
	private mediaState: number;
	private textureSurface: any;
	private textureSurfaceSet: boolean;
	private mediaPlayer: any;
	private mediaController: any;
	private preSeekTime: number;
	private _onReadyEmitEvent: Array<any>;
	private videoOpened: boolean;
	private eventPlaybackReady: boolean;
	private eventPlaybackStart: boolean;
	private lastTimerUpdate: number;
	private interval: number;
	private _suspendLocation: number;
	private _boundStart = this.resumeEvent.bind(this);
	private _boundStop = this.suspendEvent.bind(this);
	private enableSubtitles: boolean = false;

	public TYPE = { DETECT: 0, SS: 1, DASH: 2, HLS: 3, OTHER: 4 };
	public nativeView: any;


	constructor() {
		super();
		this._textureView = null;
		this.nativeView = null;
		this.videoWidth = 0;
		this.videoHeight = 0;
		this._onReadyEmitEvent = [];
		this._suspendLocation = null;

		this._src = null;

		this.mediaState = SURFACE_WAITING;
		this.textureSurface = null;
		this.textureSurfaceSet = false;
		this.mediaPlayer = null;
		this.mediaController = null;
		this.preSeekTime = -1;

		this.videoOpened = false;
		this.eventPlaybackReady = false;
		this.eventPlaybackStart = false;
		this.lastTimerUpdate = -1;
		this.interval = null;
	}

	get playState(): any {
		if (!this.mediaPlayer) {
			return STATE_IDLE;
		}
		return this.mediaPlayer.getPlaybackState();
	}

	get android(): any {
		return this.nativeView;
	}

	[videoSourceProperty.setNative](value) {
		this._setNativeVideo(value ? value.android : null);
	}

	[subtitleSourceProperty.setNative](value) {
		this._updateSubtitles(value ? value.android : null);
	}

	private _setupTextureSurface(): void {
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
			} else {
				this.mediaState = SURFACE_WAITING;
			}

			if (!this.videoOpened) {
				this._openVideo();
			}
		}
	}

	public createNativeView(): any {
		const nativeView = new android.widget.RelativeLayout(this._context);
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
	}

	public initNativeView(): void {
		super.initNativeView();
		let that = new WeakRef(this);
		this._setupMediaController();
		this._textureView.setOnTouchListener(new android.view.View.OnTouchListener({
			get owner(): Video {
				return that.get();
			},
			onTouch: function (/* view, event */) {
				if (this.owner) {
					this.owner.toggleMediaControllerVisibility();
				}
				return false;
			}
		}));

		this._textureView.setSurfaceTextureListener(new android.view.TextureView.SurfaceTextureListener(
			{
				get owner(): Video {
					return that.get();
				},
				onSurfaceTextureSizeChanged: function (surface, width, height) {
					console.log("SurfaceTexutureSizeChange", width, height);
					this.owner._setupAspectRatio();
				},

				onSurfaceTextureAvailable: function (/* surface, width, height */) {
					if (this.owner) {
						this.owner._setupTextureSurface();
					}
				},

				onSurfaceTextureDestroyed: function (/* surface */) {
					// after we return from this we can't use the surface any more
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

				onSurfaceTextureUpdated: function (/* surface */) {
					// do nothing
				}
			}
		));

		nsApp.on(nsApp.suspendEvent, this._boundStop);
		nsApp.on(nsApp.resumeEvent, this._boundStart);

	}

	public disposeNativeView() {
		this.disableEventTracking();
	}

	public disableEventTracking() {
		nsApp.off(nsApp.suspendEvent, this._boundStop);
		nsApp.off(nsApp.resumeEvent, this._boundStart);
	}

	public toggleMediaControllerVisibility(): void {
		if (!this.mediaController || !this.mediaPlayer) {
			return;
		}
		if (this.mediaController.isVisible()) {
			this.mediaController.hide();
		} else {
			this.mediaController.show();
		}
	}

	private _setupMediaPlayerListeners(): void {
		let that = new WeakRef(this);

		let vidListener = new com.google.android.exoplayer2.SimpleExoPlayer.VideoListener({
			get owner(): Video {
				return that.get();
			},
			onRenderedFirstFrame: function () {
				// Once the first frame has rendered it is ready to start playing...
				if (this.owner && !this.owner.eventPlaybackReady) {
					this.owner.eventPlaybackReady = true;
					this.owner._emit(VideoBase.playbackReadyEvent);
				}
			},
			onVideoSizeChanged: function (width, height /*, unappliedRotationDegrees, pixelWidthHeightRatio */) {
				if (this.owner) {
					this.owner.videoWidth = width;
					this.owner.videoHeight = height;
					if (this.owner.fill !== VideoFill.aspectFill) {
						this.owner._setupAspectRatio();
					}
				}
			}
		});
		let evtListener = new com.google.android.exoplayer2.ExoPlayer.EventListener({
			get owner(): Video {
				return that.get();
			},
			onLoadingChanged: function (/* isLoading */) {
				// Do nothing
			},
			onPlayerError: function (error) {
				console.error("PlayerError", error);
			},
			onPlayerStateChanged: function (playWhenReady, playbackState) {
				// console.log("OnPlayerStateChanged", playWhenReady, playbackState);
				if (!this.owner) {
					return;
				}
				if (!this.owner.textureSurfaceSet) {
					this.owner._setupTextureSurface();
				}

				// PlayBackState
				// 1 = IDLE
				// 2 = BUFFERING
				// 3 = Ready
				// 4 = Ended

				if (playbackState === STATE_READY) {

					// We have to fire this from here in the event the textureSurface isn't set yet...
					if (!this.owner.textureSurfaceSet && !this.owner.eventPlaybackReady) {
						this.owner.eventPlaybackReady = true;
						this.owner._emit(VideoBase.playbackReadyEvent);
					}
					if (this.owner._onReadyEmitEvent.length) {
						do {
							this.owner._emit(this.owner._onReadyEmitEvent.shift());
						} while (this.owner._onReadyEmitEvent.length);
					}
					if (playWhenReady && !this.owner.eventPlaybackStart) {
						this.owner.eventPlaybackStart = true;
						// this.owner._emit(VideoBase.playbackStartEvent);
					}
				} else if (playbackState === STATE_ENDED) {
					if (!this.owner.loop) {
						this.owner.eventPlaybackStart = false;
						this.owner.stopCurrentTimer();
					}
					this.owner._emit(VideoBase.finishedEvent);
					if (this.owner.loop) {
						this.owner.play();
					}
				}

			},
			onPositionDiscontinuity: function () {
				// Do nothing
			},
			onSeekProcessed: function () {
				// Do nothing
			},
			onTimelineChanged: function (/* timeline, manifest */) {
				// Do nothing
			},
			onTracksChanged: function (/* trackGroups, trackSelections */) {
				// Do nothing
			}
		});
		this.mediaPlayer.setVideoListener(vidListener);
		this.mediaPlayer.addListener(evtListener);

	}

	private _setupMediaController(): void {
		if (this.controls !== false || this.controls === undefined) {
			if (this.mediaController == null) {
				this.mediaController = new com.google.android.exoplayer2.ui.PlaybackControlView(this._context);
				this.nativeView.addView(this.mediaController);

				let params = this.mediaController.getLayoutParams();
				params.addRule(14); // Center Horiz
				params.addRule(12); // Align bottom

				this.mediaController.setLayoutParams(params);
			} else {
				return;
			}
		}
	}

	private _setupAspectRatio(): void {
		if (!this._textureView) {
			return
		}
		let viewWidth = this._textureView.getWidth();
		let viewHeight = this._textureView.getHeight();
		let aspectRatio = this.videoHeight / this.videoWidth;

		let newWidth;
		let newHeight;
		if (viewHeight > (viewWidth * aspectRatio)) {
			// limited by narrow width; restrict height
			newWidth = viewWidth;
			newHeight = (viewWidth * aspectRatio);
		} else {
			// limited by short height; restrict width
			newWidth = (viewHeight / aspectRatio);
			newHeight = viewHeight;
		}

		let xoff = (viewWidth - newWidth) / 2;
		let yoff = (viewHeight - newHeight) / 2;

		let txform = new android.graphics.Matrix();
		this._textureView.getTransform(txform);
		txform.setScale(newWidth / viewWidth, newHeight / viewHeight);
		txform.postTranslate(xoff, yoff);
		this._textureView.setTransform(txform);

	}

	private _detectTypeFromSrc(uri: any): number {
		if (this.srcType > 0 && this.srcType <= 4) {
			if (this.srcType == 1) return this.TYPE.SS;
			if (this.srcType == 2) return this.TYPE.DASH;
			if (this.srcType == 3) return this.TYPE.HLS;
			if (this.srcType == 4) return this.TYPE.OTHER;
		}
		let type = com.google.android.exoplayer2.util.Util.inferContentType(uri);
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
	}

	private _openVideo(): void {
		if (this._src === null) {
			return;
		}
		this.release();

		if (!this.interval && this.observeCurrentTime) {
			this.startCurrentTimer();
		}

		this.videoOpened = true; // we don't want to come back in here from texture system...

		let am = nsUtils.ad.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE);
		am.requestAudioFocus(null, android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.AUDIOFOCUS_GAIN);
		try {
			let bm = new com.google.android.exoplayer2.upstream.DefaultBandwidthMeter();
			let trackSelection = new com.google.android.exoplayer2.trackselection.AdaptiveTrackSelection.Factory(bm);
			let trackSelector = new com.google.android.exoplayer2.trackselection.DefaultTrackSelector(trackSelection);
			let loadControl = new com.google.android.exoplayer2.DefaultLoadControl();
			this.mediaPlayer =
				com.google.android.exoplayer2.ExoPlayerFactory.newSimpleInstance(this._context, trackSelector, loadControl);

			if (this.textureSurface && !this.textureSurfaceSet) {
				this.textureSurfaceSet = true;
				this.mediaPlayer.setVideoSurface(this.textureSurface);
			} else {
				this._setupTextureSurface();
			}

			if (this.enableSubtitles) {
				//subtitles view
				this.mediaPlayer.setTextOutput(this._subtitlesView);
			}


			let dsf = new com.google.android.exoplayer2.upstream.DefaultDataSourceFactory(this._context, "NativeScript", bm);
			let ef = new com.google.android.exoplayer2.extractor.DefaultExtractorsFactory();

			let vs, uri;
			if (this._src instanceof String || typeof this._src === "string") {
				uri = android.net.Uri.parse(this._src);

				const type = this._detectTypeFromSrc(uri);
				switch (type) {
					case this.TYPE.SS:
						vs = new com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.smoothstreaming.DefaultSsChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.DASH:
						vs = new com.google.android.exoplayer2.source.dash.DashMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.dash.DefaultDashChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.HLS:
						vs = new com.google.android.exoplayer2.source.hls.HlsMediaSource(uri, dsf, null, null);
						break;
					default:
						if (this.encryptionKey) {
							const cipherFactory = new CipherFactory(this.encryptionKey);
							dsf = new EncryptedDataSourceFactory(
								cipherFactory.cipher,
								cipherFactory.secretKeySpec,
								cipherFactory.ivParameterSpec
							);
						}
						vs = new com.google.android.exoplayer2.source.ExtractorMediaSource(uri, dsf, ef, null, null)
				}

				/* if (this.loop) {
					vs = new com.google.android.exoplayer2.source.LoopingMediaSource(vs);
				} */
			} else if (typeof this._src.typeSource === "number") {
				uri = android.net.Uri.parse(this._src.url);
				switch (this._src.typeSource) {
					case this.TYPE.SS:
						vs = new com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.smoothstreaming.DefaultSsChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.DASH:
						vs = new com.google.android.exoplayer2.source.dash.DashMediaSource(uri, dsf,
							new com.google.android.exoplayer2.source.dash.DefaultDashChunkSource.Factory(dsf), null, null);
						break;
					case this.TYPE.HLS:
						vs = new com.google.android.exoplayer2.source.hls.HlsMediaSource(uri, dsf, null, null);
						break;
					default:
						vs = new com.google.android.exoplayer2.source.ExtractorMediaSource(uri, dsf, ef, null, null, null);
				}

				/* if (this.loop) {
					vs = new com.google.android.exoplayer2.source.LoopingMediaSource(vs);
				} */


			} else {
				vs = this._src;
			}

			// subtitles src

			try {
				if (this._subtitlesSrc != null && this._subtitlesSrc.trim() != "") {
					let subtitleUri = android.net.Uri.parse(this._subtitlesSrc.trim());
					//added extra variable to resolve method
					let textFormat = com.google.android.exoplayer2.Format.createTextSampleFormat(
						null,
						com.google.android.exoplayer2.util.MimeTypes.APPLICATION_SUBRIP,
						null,
						com.google.android.exoplayer2.Format.NO_VALUE,
						com.google.android.exoplayer2.Format.NO_VALUE,
						"en",
						null,
						com.google.android.exoplayer2.Format.OFFSET_SAMPLE_RELATIVE );
						//previous  way was deprecated
					let subtitlesSrc = new com.google.android.exoplayer2.source.SingleSampleMediaSource.Factory(dsf).createMediaSource(
						subtitleUri,
						textFormat,
						com.google.android.exoplayer2.C.TIME_UNSET);

					let mergedArray = (<any>Array).create(com.google.android.exoplayer2.source.MediaSource, 2);
					mergedArray[0] = vs;
					mergedArray[1] = subtitlesSrc;

					vs = new com.google.android.exoplayer2.source.MergingMediaSource(mergedArray) //constructor is vararg
				}
			} catch (ex) {
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

		} catch (ex) {
			console.log("Error:", ex, ex.stack);
		}
	}

	public _setNativeVideo(nativeVideo: any): void {
		this._src = nativeVideo;
		this._suspendLocation = 0;
		this._openVideo();
	}

	public setNativeSource(nativePlayerSrc: string): void {
		this._src = nativePlayerSrc;
		this._suspendLocation = 0;
		this._openVideo();
	}

	public _updateSubtitles(subtitlesSrc: any): void {
		if (this.enableSubtitles) {
			this._subtitlesSrc = subtitlesSrc;
			if (this.mediaPlayer != null) {
				this.preSeekTime = this.mediaPlayer.getCurrentPosition();
			}
			this._openVideo();
		}
	}

	public play(): void {
		if (!this.mediaPlayer || this.mediaState === SURFACE_WAITING) {
			this._openVideo();
		} else if (this.playState === STATE_ENDED) {
			this.eventPlaybackStart = false;
			this.mediaPlayer.seekToDefaultPosition();
			this.startCurrentTimer();
		} else {
			this.mediaPlayer.setPlayWhenReady(true);
			this.startCurrentTimer();
		}
	}

	public pause(): void {
		if (this.mediaPlayer) {
			this.mediaPlayer.setPlayWhenReady(false);
		}
	}

	public mute(mute: boolean): void {
		if (this.mediaPlayer) {
			if (mute === true) {
				this.mediaPlayer.setVolume(0);
			} else if (mute === false) {
				this.mediaPlayer.setVolume(1);
			}
		}
	}

	public stop(): void {
		if (this.mediaPlayer) {
			this.stopCurrentTimer();
			this.mediaPlayer.stop();
			this.release();
		}
	}

	private _addReadyEvent(value: any) {
		if (this._onReadyEmitEvent.indexOf(value)) {
			return;
		}
		this._onReadyEmitEvent.push(value);
	}

	public seekToTime(ms: number): void {
		this._addReadyEvent(VideoBase.seekToTimeCompleteEvent);

		if (!this.mediaPlayer) {
			this.preSeekTime = ms;
			return;
		} else {
			this.preSeekTime = -1;
		}
		this.mediaPlayer.seekTo(ms);
	}

	public isPlaying(): boolean {
		if (!this.mediaPlayer) {
			return false;
		}
		if (this.playState === STATE_READY) {
			return this.mediaPlayer.getPlayWhenReady();
		}
		return false;
	}

	public getDuration(): number {
		if (!this.mediaPlayer || this.mediaState === SURFACE_WAITING || this.playState === STATE_IDLE) {
			return 0;
		}
		let duration = this.mediaPlayer.getDuration();
		if (isNaN(duration)) {
			return 0;
		} else {
			return duration;
		}
	}

	public getCurrentTime(): number {
		if (!this.mediaPlayer) {
			return 0;
		}
		return this.mediaPlayer.getCurrentPosition();
	}

	public setVolume(volume: number) {
		if (this.mediaPlayer) {
			this.mediaPlayer.setVolume(volume);
		}
	}

	public destroy() {
		this.release();
		this.src = null;
		this._textureView = null;
		this.mediaPlayer = null;
		this.mediaController = null;
	}

	private release(): void {
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
			let am = nsUtils.ad.getApplicationContext().getSystemService(android.content.Context.AUDIO_SERVICE);
			am.abandonAudioFocus(null);
		}
	}

	public suspendEvent(): void {
		this._suspendLocation = this.getCurrentTime();
		this.release();
	}

	public resumeEvent(): void {
		if (this._suspendLocation) {
			this.seekToTime(this._suspendLocation);
			this._suspendLocation = 0;
		}
		this._openVideo();
	}

	private startCurrentTimer(): void {
		if (this.interval) {
			return;
		}
		this.lastTimerUpdate = -1;
		this.interval = <any>setInterval(() => {
			this.fireCurrentTimeEvent();
		}, 200);
	}

	private fireCurrentTimeEvent(): void {
		if (!this.mediaPlayer) {
			return;
		}
		let curTimer = this.mediaPlayer.getCurrentPosition();
		if (curTimer !== this.lastTimerUpdate) {
			this.notify({
				eventName: VideoBase.currentTimeUpdatedEvent,
				object: this,
				position: curTimer
			});
			this.lastTimerUpdate = curTimer;
		}
	}

	private stopCurrentTimer(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		this.fireCurrentTimeEvent();
	}
}

@Interfaces([com.google.android.exoplayer2.upstream.DataSource.Factory]) 
class EncryptedDataSourceFactory extends java.lang.Object {
	private cipher;
	private secretKeySpec;
	private ivParameterSpec;
	constructor(cipher, secretKeySpec, ivParameterSpec) {
		super();
		this.cipher = cipher;
		this.secretKeySpec = secretKeySpec;
		this.ivParameterSpec = ivParameterSpec;
        return global.__native(this);
	}

	createDataSource = () => {
		return new EncryptedDataSource(this.cipher, this.secretKeySpec, this.ivParameterSpec);
	}
}

@Interfaces([com.google.android.exoplayer2.upstream.DataSource]) 
class EncryptedDataSource extends java.lang.Object {
	private inputStream;
	private uri;
	private bytesRemaining;
	private cipher;
	private secretKeySpec;
	private ivParameterSpec;
	private opened;

	constructor(cipher, secretKeySpec, ivParameterSpec) {
		super();
		this.cipher = cipher;
		this.secretKeySpec = secretKeySpec;
		this.ivParameterSpec =  ivParameterSpec;
        return global.__native(this);
	}

	getResponseHeaders = () => {
	}

	addTransferListener = (transferListener: any) => {}

	open = (dataSpec: any) => {
		if (this.opened) {
			return this.bytesRemaining;
		}

		this.uri = dataSpec.uri;

		try {
			this.setupInputStream();
			this.skipToPosition(dataSpec);
			this.computeBytesRemaining(dataSpec);
		} catch (err) {
			throw new EncryptedFileDataSourceException(err);
		}

		this.opened = true;
		
		return this.bytesRemaining;
	}

	private setupInputStream = () => {
		const encryptedFile = new java.io.File(this.uri.getPath());
		const fileInputStream = new java.io.FileInputStream(encryptedFile);
		this.inputStream = new StreamingCipherInputStream(fileInputStream, this.cipher, this.secretKeySpec, this.ivParameterSpec);
	}

	private skipToPosition = (dataSpec) => {
		this.inputStream.forceSkip(dataSpec.position);
	}

	private computeBytesRemaining = (dataSpec) => {
		// const file = new java.io.File(dataSpec.uri.getPath());
        // if (dataSpec.length != com.google.android.exoplayer2.C.LENGTH_UNSET) {
        //     this.bytesRemaining = dataSpec.length;
        // } else {
        //     this.bytesRemaining = file.length() > java.lang.Integer.MAX_VALUE ? file.length() : this.inputStream.available();
        //     if (this.bytesRemaining == java.lang.Integer.MAX_VALUE) {
        //         this.bytesRemaining = com.google.android.exoplayer2.C.LENGTH_UNSET;
        //     }
		// }

		if (dataSpec.length != com.google.android.exoplayer2.C.LENGTH_UNSET) {
			this.bytesRemaining = dataSpec.length;
		} else {
			this.bytesRemaining = this.inputStream.available();
			if (this.bytesRemaining == java.lang.Integer.MAX_VALUE) {
			  this.bytesRemaining = com.google.android.exoplayer2.C.LENGTH_UNSET;
			}
		}
	}

	read = (buffer: any, offset: any, readLength: any) => {
		if (readLength == 0) {
			return 0;
		} else if (this.bytesRemaining == 0) {
			return com.google.android.exoplayer2.C.RESULT_END_OF_INPUT;
		}

		let bytesToRead = this.getBytesToRead(readLength);
		let bytesRead;
		
		try {
			bytesRead = this.inputStream.read(buffer, offset, bytesToRead);
		} catch (e) {
			throw new EncryptedFileDataSourceException(e);
		}

		if (bytesRead == -1) {
			if (this.bytesRemaining != com.google.android.exoplayer2.C.LENGTH_UNSET) {
				throw new EncryptedFileDataSourceException(new java.io.EOFException());
			}
			return com.google.android.exoplayer2.C.RESULT_END_OF_INPUT;
		}

		if (this.bytesRemaining != com.google.android.exoplayer2.C.LENGTH_UNSET) {
			this.bytesRemaining += -bytesRead;
		}
	  
		return bytesRead;
	}

	private getBytesToRead = (bytesToRead) => {
		if (this.bytesRemaining === com.google.android.exoplayer2.C.LENGTH_UNSET) {
		  return bytesToRead;
		}
		const minBytesToRead = java.lang.Math.min(this.bytesRemaining, bytesToRead)

		return Number.parseInt(minBytesToRead);
	  }

	getUri = () => {
		return this.uri;
	}

	close = () => {
		this.uri = null;
		try {
			if (this.inputStream != null) {
				this.inputStream.close();
			}
		} catch (e) {
			throw new EncryptedFileDataSourceException(e);
		} finally {
			this.inputStream = null;
			if (this.opened) {
				this.opened = false;
			}
		}
	}
}

class StreamingCipherInputStream extends javax.crypto.CipherInputStream {
    private static AES_BLOCK_SIZE = 16;

    private upstream;
    private cipher;
    private secretKeySpec;
	private ivParameterSpec;
	
    constructor(inputStream, cipher, secretKeySpec, ivParameterSpec) {
		super(inputStream, cipher);
		this.upstream = inputStream;
		this.cipher = cipher;
		this.secretKeySpec = secretKeySpec;
		this.ivParameterSpec = ivParameterSpec;

		return global.__native(this);
	}

	public read = (b, off, len) =>  {
		return super.read(b, off, len);
	}

	public forceSkip = (bytesToSkip) => {
		let skipped = this.upstream.skip(bytesToSkip);
        try {
            let skip = Number.parseInt((bytesToSkip % StreamingCipherInputStream.AES_BLOCK_SIZE) as any);
            let blockOffset = bytesToSkip - skip;
            let numberOfBlocks = blockOffset / StreamingCipherInputStream.AES_BLOCK_SIZE;
            let ivForOffsetAsBigInteger = new java.math.BigInteger(1, this.ivParameterSpec.getIV()).add(java.math.BigInteger.valueOf(numberOfBlocks));
            let ivForOffsetByteArray = ivForOffsetAsBigInteger.toByteArray();
            let computedIvParameterSpecForOffset;
            if (ivForOffsetByteArray.length < StreamingCipherInputStream.AES_BLOCK_SIZE) {
                let resizedIvForOffsetByteArray = (Array as any).create("byte", StreamingCipherInputStream.AES_BLOCK_SIZE);
                java.lang.System.arraycopy(ivForOffsetByteArray, 0, resizedIvForOffsetByteArray, StreamingCipherInputStream.AES_BLOCK_SIZE - ivForOffsetByteArray.length, ivForOffsetByteArray.length);
                computedIvParameterSpecForOffset = new javax.crypto.spec.IvParameterSpec(resizedIvForOffsetByteArray);
            } else {
                computedIvParameterSpecForOffset = new javax.crypto.spec.IvParameterSpec(ivForOffsetByteArray, ivForOffsetByteArray.length - StreamingCipherInputStream.AES_BLOCK_SIZE, StreamingCipherInputStream.AES_BLOCK_SIZE);
            }
            this.cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, this.secretKeySpec, computedIvParameterSpecForOffset);
            let skipBuffer = (Array as any).create("byte", skip);
            this.cipher.update(skipBuffer, 0, skip, skipBuffer);
            java.util.Arrays.fill(skipBuffer, (new java.lang.Byte("0")).byteValue());
        } catch (e) {
            return 0;
        }
        return skipped;
	}

    public available = () => {
        return this.upstream.available();
    }
}

class CipherFactory {
	public cipher;
	public secretKeySpec;
	public ivParameterSpec;
	private encryptionKey; 
	constructor(encryptionKey: string) {
		this.encryptionKey = encryptionKey;
		this.secretKeySpec = this.createSecretKeySpec();
		this.ivParameterSpec = this.createIvParameterSpec();
		this.cipher = this.createCipher(this.secretKeySpec, this.ivParameterSpec);
	}

	private createCipher = (keySpec, ivSpec) => {
		const cipher = javax.crypto.Cipher.getInstance("AES/CTR/NoPadding");
		cipher.init(javax.crypto.Cipher.DECRYPT_MODE, keySpec, ivSpec);

		return cipher;
	}

	private createSecretKeySpec = () => {
		const secretKey = new java.lang.String(this.encryptionKey).getBytes('UTF-8');
		const keySpec = new javax.crypto.spec.SecretKeySpec(secretKey, "AES");
		return keySpec;
	}

	private createIvParameterSpec = () => {
		const ivKey = new java.lang.String(this.encryptionKey).getBytes('UTF-8');
		const ivSpec = new javax.crypto.spec.IvParameterSpec(ivKey);
		return ivSpec;
	}
}

class EncryptedFileDataSourceException extends java.io.IOException {
    constructor(cause) {
      super(cause);
    }
  }
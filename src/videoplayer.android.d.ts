import { Video as VideoBase } from "./videoplayer-common";
export * from "./videoplayer-common";
export declare class Video extends VideoBase {
    private _textureView;
    private _subtitlesView;
    private videoWidth;
    private videoHeight;
    private _src;
    private _subtitlesSrc;
    private mediaState;
    private textureSurface;
    private textureSurfaceSet;
    private mediaPlayer;
    private mediaController;
    private preSeekTime;
    private _onReadyEmitEvent;
    private videoOpened;
    private eventPlaybackReady;
    private eventPlaybackStart;
    private lastTimerUpdate;
    private interval;
    private _suspendLocation;
    private _boundStart;
    private _boundStop;
    private enableSubtitles;
    TYPE: {
        DETECT: number;
        SS: number;
        DASH: number;
        HLS: number;
        OTHER: number;
    };
    nativeView: any;
    constructor();
    get playState(): any;
    get android(): any;
    private _setupTextureSurface;
    createNativeView(): any;
    initNativeView(): void;
    disposeNativeView(): void;
    disableEventTracking(): void;
    toggleMediaControllerVisibility(): void;
    private _setupMediaPlayerListeners;
    private _setupMediaController;
    private _setupAspectRatio;
    private _detectTypeFromSrc;
    private _openVideo;
    _setNativeVideo(nativeVideo: any): void;
    setNativeSource(nativePlayerSrc: string): void;
    _updateSubtitles(subtitlesSrc: any): void;
    play(): void;
    pause(): void;
    mute(mute: boolean): void;
    stop(): void;
    private _addReadyEvent;
    seekToTime(ms: number): void;
    isPlaying(): boolean;
    getDuration(): number;
    getCurrentTime(): number;
    setVolume(volume: number): void;
    destroy(): void;
    private release;
    suspendEvent(): void;
    resumeEvent(): void;
    private startCurrentTimer;
    private fireCurrentTimeEvent;
    private stopCurrentTimer;
}

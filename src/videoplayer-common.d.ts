import { View, Property } from "tns-core-modules/ui/core/view";
export declare enum VideoFill {
    default = "default",
    aspect = "aspect",
    aspectFill = "aspectFill"
}
export declare class Video extends View {
    static finishedEvent: string;
    static playbackReadyEvent: string;
    static playbackStartEvent: string;
    static seekToTimeCompleteEvent: string;
    static currentTimeUpdatedEvent: string;
    _emit: any;
    android: any;
    ios: any;
    src: string;
    srcType: number;
    imgSrc: string;
    imgType: number;
    subtitles: string;
    subtitleSource: string;
    observeCurrentTime: boolean;
    autoplay: boolean;
    controls: boolean;
    loop: boolean;
    muted: boolean;
    fill: VideoFill;
    encryptionKey: string;
    static IMAGETYPEMONO: number;
    static IMAGETYPESTEREOTOPBOTTOM: number;
    static IMAGETYPESTEREOLEFTRIGHT: number;
}
export declare const srcProperty: Property<Video, any>;
export declare const srcTypeProperty: Property<Video, any>;
export declare const imgSrcProperty: Property<Video, any>;
export declare const imgTypeProperty: Property<Video, any>;
export declare const subtitlesProperty: Property<Video, any>;
export declare const subtitleSourceProperty: Property<Video, any>;
export declare const videoSourceProperty: Property<Video, any>;
export declare const imageSourceProperty: Property<Video, any>;
export declare const isLoadingProperty: Property<Video, boolean>;
export declare const observeCurrentTimeProperty: Property<Video, boolean>;
export declare const autoplayProperty: Property<Video, boolean>;
export declare const controlsProperty: Property<Video, boolean>;
export declare const loopProperty: Property<Video, boolean>;
export declare const mutedProperty: Property<Video, boolean>;
export declare const fillProperty: Property<Video, VideoFill>;
export declare const encryptionKeyProperty: Property<Video, string>;

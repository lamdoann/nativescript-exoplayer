import definition = require("./video-source");
export declare function fromResource(name: string): definition.VideoSource;
export declare function fromFile(path: string): definition.VideoSource;
export declare function fromNativeSource(source: any): definition.VideoSource;
export declare function fromUrl(url: string): definition.VideoSource;
export declare function fromFileOrResource(path: string): definition.VideoSource;
export declare function isFileOrResourcePath(path: string): boolean;

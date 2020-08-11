import definition = require("./subtitle-source");
export declare function fromResource(name: string): definition.SubtitleSource;
export declare function fromFile(path: string): definition.SubtitleSource;
export declare function fromUrl(url: string): definition.SubtitleSource;
export declare function fromFileOrResource(path: string): definition.SubtitleSource;
export declare function isFileOrResourcePath(path: string): boolean;

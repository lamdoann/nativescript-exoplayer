import definition = require("./video-source");
export declare class VideoSource implements definition.VideoSource {
    android: any;
    ios: any;
    loadFromResource(name: string): boolean;
    loadFromUrl(url: string): boolean;
    loadFromFile(path: string): boolean;
    setNativeSource(source: any): boolean;
    get height(): number;
    get width(): number;
}

import definition = require("./video-source");
export declare class VideoSource implements definition.VideoSource {
    android: any;
    ios: any;
    height: any;
    width: any;
    loadFromResource(name: string): boolean;
    loadFromFile(path: string): boolean;
    loadFromUrl(url: string): boolean;
    setNativeSource(source: any): boolean;
}

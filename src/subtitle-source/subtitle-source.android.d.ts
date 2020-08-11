import definition = require("./subtitle-source");
export declare class SubtitleSource implements definition.SubtitleSource {
    android: any;
    ios: any;
    loadFromResource(name: string): boolean;
    loadFromUrl(url: string): boolean;
    loadFromFile(path: string): boolean;
}

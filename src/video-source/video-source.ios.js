"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoSource = void 0;
var types = require("utils/types");
var fs = require("file-system");
var common = require("./video-source-common");
global.moduleMerge(common, exports);
var VideoSource = (function () {
    function VideoSource() {
    }
    VideoSource.prototype.loadFromResource = function (name) {
        var videoURL = NSBundle.mainBundle().URLForResourceWithExtension(name, null);
        var player = new AVPlayerItem(videoURL);
        this.ios = player;
        return this.ios != null;
    };
    VideoSource.prototype.loadFromFile = function (path) {
        var fileName = types.isString(path) ? path.trim() : "";
        if (fileName.indexOf("~/") === 0) {
            fileName = fs.path.join(fs.knownFolders.currentApp().path, fileName.replace("~/", ""));
        }
        var videoURL = NSURL.fileURLWithPath(fileName);
        var player = new AVPlayerItem(videoURL);
        this.ios = player;
        return this.ios != null;
    };
    VideoSource.prototype.loadFromUrl = function (url) {
        var videoURL = NSURL.URLWithString(url);
        var player = new AVPlayerItem(videoURL);
        this.ios = player;
        return this.ios != null;
    };
    VideoSource.prototype.setNativeSource = function (source) {
        this.ios = source;
        return source != null;
    };
    return VideoSource;
}());
exports.VideoSource = VideoSource;

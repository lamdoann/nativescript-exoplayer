"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubtitleSource = void 0;
var types = require("utils/types");
var fs = require("file-system");
var common = require("./subtitle-source-common");
global.moduleMerge(common, exports);
var SubtitleSource = (function () {
    function SubtitleSource() {
    }
    SubtitleSource.prototype.loadFromResource = function (name) {
        var subtitleUrl = NSBundle.mainBundle().URLForResourceWithExtension(name, null);
        var subtitles = NSString.stringWithContentsOfURLEncodingError(subtitleUrl, NSUTF8StringEncoding, null);
        this.ios = subtitles;
        return this.ios != null;
    };
    SubtitleSource.prototype.loadFromFile = function (path) {
        var fileName = types.isString(path) ? path.trim() : "";
        if (fileName.indexOf("~/") === 0) {
            fileName = fs.path.join(fs.knownFolders.currentApp().path, fileName.replace("~/", ""));
        }
        var subtitleUrl = NSURL.fileURLWithPath(fileName);
        var subtitles = NSString.stringWithContentsOfURLEncodingError(subtitleUrl, NSUTF8StringEncoding, null);
        this.ios = subtitles;
        return this.ios != null;
    };
    SubtitleSource.prototype.loadFromUrl = function (url) {
        var subtitleUrl = NSURL.URLWithString(url);
        var subtitles = NSString.stringWithContentsOfURLEncodingError(subtitleUrl, NSUTF8StringEncoding, null);
        this.ios = subtitles;
        return this.ios != null;
    };
    return SubtitleSource;
}());
exports.SubtitleSource = SubtitleSource;

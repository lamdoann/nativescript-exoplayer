"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubtitleSource = void 0;
var types = require("utils/types");
var common = require("./subtitle-source-common");
global.moduleMerge(common, exports);
var utils;
function ensureUtils() {
    if (!utils) {
        utils = require("utils/utils");
    }
}
var fs;
function ensureFS() {
    if (!fs) {
        fs = require("file-system");
    }
}
var SubtitleSource = (function () {
    function SubtitleSource() {
    }
    SubtitleSource.prototype.loadFromResource = function (name) {
        this.android = null;
        ensureUtils();
        var res = utils.ad.getApplicationContext().getResources();
        if (res) {
            var UrlPath = "android.resource://org.nativescript.videoPlayer/R.raw." + name;
            this.android = UrlPath;
        }
        return this.android != null;
    };
    SubtitleSource.prototype.loadFromUrl = function (url) {
        this.android = null;
        this.android = url;
        return this.android != null;
    };
    SubtitleSource.prototype.loadFromFile = function (path) {
        ensureFS();
        var fileName = types.isString(path) ? path.trim() : "";
        if (fileName.indexOf("~/") === 0) {
            fileName = fs.path.join(fs.knownFolders.currentApp().path, fileName.replace("~/", ""));
        }
        this.android = fileName;
        return this.android != null;
    };
    return SubtitleSource;
}());
exports.SubtitleSource = SubtitleSource;

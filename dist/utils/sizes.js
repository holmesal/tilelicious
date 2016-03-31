'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var sizes = exports.sizes = {
    '18x24': {
        printWidth: 5400,
        printHeight: 7200,
        paddingTop: 404,
        mapWidth: 4592,
        mapHeight: 5584,
        fontSize: 118,
        copyrightFontSize: 26,
        textMarginTop: 528,
        letterSpacing: 0
    },
    '12x16': {
        printWidth: 3600,
        printHeight: 4800,
        paddingTop: 269,
        mapWidth: 3062,
        mapHeight: 3724,
        fontSize: 78,
        copyrightFontSize: 26,
        textMarginTop: 318,
        letterSpacing: 0
    },
    preview: {
        printWidth: 1200,
        printHeight: 1600,
        paddingTop: 90,
        mapWidth: 1020,
        mapHeight: 1241,
        fontSize: 26,
        copyrightFontSize: 12,
        textMarginTop: 117,
        letterSpacing: 0
    }
};

var getDims = exports.getDims = function getDims(size) {
    if (sizes[size]) {
        return sizes[size];
    } else {
        throw new Error('we don\'t have paper in that size....');
    }
};
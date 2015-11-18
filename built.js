'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();
//import latLngToTileXY from './tileUtils';

var _canvas = require('canvas');

var _canvas2 = _interopRequireDefault(_canvas);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _geoViewport = require('geo-viewport');

var _geoViewport2 = _interopRequireDefault(_geoViewport);

var _sphericalmercator = require('sphericalmercator');

var _sphericalmercator2 = _interopRequireDefault(_sphericalmercator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var sm = new _sphericalmercator2.default({ size: 256 });

var dims = {
    w: 3508,
    h: 2480
};

var BORDER = 50;

var z = 15;

// Maximum static map size, from mapbox
var MAX_SIZE = {
    w: 256,
    h: 256
};

//// Example
var focus = {
    center: [-122.2708, 37.8044],
    zoom: z
};
var bbox = _geoViewport2.default.bounds(focus.center, z, [dims.w, dims.h]);
var debug = false;
var basemapOpacity = 0.2;

// W-S-E-N
//let bbox = [
//    -122.347269,
//    37.77621,
//    -122.217321,
//    37.837513
//];

var canvas = new _canvas2.default(dims.w, dims.h);

var ctx = canvas.getContext('2d');

//ctx.font = '10px Arial';
//ctx.rotate(.1);
//ctx.fillText("Awesome!", 0, 100);

//var te = ctx.measureText('Awesome!');
//ctx.strokeStyle = 'rgba(0,0,0,0.5)';
//ctx.beginPath();
//ctx.lineTo(50, 102);
//ctx.lineTo(50 + te.width, 102);
//ctx.stroke();

// Draw the white background
var bg = function bg(color) {
    ctx.rect(0, 0, dims.w, dims.h);
    ctx.fillStyle = color;
    ctx.fill();
};

// Render the mapbox tiles
var render = function render() {
    // Render out to a png
    var out = _fs2.default.createWriteStream(__dirname + '/test.png');
    var stream = canvas.pngStream();

    stream.on('data', function (chunk) {
        out.write(chunk);
    });

    stream.on('end', function () {
        console.log('saved png');
    });
};

var fetchMapboxImages = function fetchMapboxImages() {
    console.log('bbox', bbox);
    // How many images should we fetch from mapbox?
    var numCols = Math.ceil(dims.w / MAX_SIZE.w);
    var numRows = Math.ceil(dims.h / MAX_SIZE.h);
    // How much lat/lng should each image be responsible for?
    var intervals = {
        lon: (bbox[2] - bbox[0]) / numCols,
        lat: (bbox[3] - bbox[1]) / numRows,
        pixelsX: dims.w / numCols,
        pixelsY: dims.h / numRows
    };
    // Request one image for each range
    console.log('fetching ' + numCols + ' x ' + numRows + ' images');
    for (var x = 0; x < numCols; x++) {
        for (var y = 0; y < numRows; y++) {
            //W-S-E-N
            var edges = [bbox[0] + intervals.lon * x, //minlon
            bbox[1] + intervals.lat * y, bbox[0] + intervals.lon * (x + 1), bbox[1] + intervals.lat * (y + 1)];
            var _z = 14;
            var xyzBounds = sm.xyz(edges, _z);
            console.log(xyzBounds);
            // Pixel bounds
            var pixels = [Math.round(intervals.pixelsX * x), Math.round(intervals.pixelsY * y), Math.round(intervals.pixelsX * (x + 1)), Math.round(intervals.pixelsY * (y + 1))];
            //let center = [
            //    (edges[2] + edges[0]) / 2,
            //    (edges[3] + edges[1]) / 2
            //];
            //let bounds = geoViewport.bounds(center, 14, [MAX_SIZE.w, MAX_SIZE.h]);
            //let size = [
            //    pixels[2] - pixels[0],
            //    pixels[3] - pixels[1]
            //];
            //// Calculate center and zoom
            //let viewport = geoViewport.viewport(bounds, [MAX_SIZE.w, MAX_SIZE.h]);
            //console.log(x, y);
            //console.log('bounds', bounds);
            //console.log(pixels);
            //console.log(size);
            //console.log('viewport', viewport);
            //console.log('recomputed bounds', geoViewport.bounds(viewport.center, viewport.zoom, [dims.w, dims.h]))
            //console.log('\n\n --- \n\n');
            //
            //let pos = [
            //    MAX_SIZE.w * x,
            //    MAX_SIZE.h * y
            //];
            //
            var mapboxTile = new ImageFetcher(xyzBounds.minX, xyzBounds.minY, _z);
            break;
        }
        break;
    }
};

var tileThings = function tileThings() {
    var tileBounds = sm.xyz(bbox, z);
    var count = (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1);
    var ic = 0;
    var promises = [];
    for (var x = tileBounds.minX; x <= tileBounds.maxX; x++) {
        for (var y = tileBounds.minY; y <= tileBounds.maxY; y++) {
            var relX = x - tileBounds.minX;
            var relY = y - tileBounds.minY;
            //console.log(`tile [${ic}/${count}]`);
            var tile = new ImageFetcher(x, y, z, relX, relY, ic, count);
            var tilePromise = tile.fetchImage();
            promises.push(tilePromise);
        }
    }
    Promise.all(promises).then(function () {
        render();
    });
};

var renderCount = 0;

var ImageFetcher = (function () {
    function ImageFetcher(x, y, z, relX, relY, ic, count) {
        _classCallCheck(this, ImageFetcher);

        this.count = count;
        this.relX = relX;
        this.relY = relY;
        //console.info('rendering tile at ' + pos)
        //console.info(viewport)
        //this.dims = dims;
        //let pos = [0,0];
        //let url = `https://api.mapbox.com/v4/mapbox.streets/${viewport.center[0]},${viewport.center[1]},${viewport.zoom}/${size[0]}x${size[1]}.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ`;
        this.url = 'https://api.mapbox.com/v4/mapbox.streets/' + z + '/' + x + '/' + y + '.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ';
        //console.log(url);
        //this.fetchImage(url, relX, relY);
    }

    _createClass(ImageFetcher, [{
        key: 'fetchImage',
        value: function fetchImage() {
            var _this = this;

            return new Promise(function (resolve, reject) {
                _superagent2.default.get(_this.url).end(function (err, res) {
                    if (err) {
                        console.error(err);
                    }
                    var size = 256;
                    renderCount++;
                    var pX = _this.relX * size;
                    var pY = _this.relY * size;
                    console.log('tile [' + renderCount + '/' + _this.count + '] ... drawing ' + _this.relX + ', ' + _this.relY + ' @ ' + pX + ', ' + pY);
                    var img = new _canvas.Image();
                    img.src = res.body;
                    ctx.drawImage(img, pX, pY);

                    if (debug) {
                        ctx.rect(pX, pY, size, size);
                        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                        ctx.stroke();
                    }
                    resolve();
                    //ctx.drawImage(img, 0, 0, 100, 100);
                    //    //img = new Image;
                    //    img.src = canvas.toBuffer();
                    //    ctx.drawImage(img, 100, 100, 50, 50);
                    //    ctx.drawImage(img, 200, 100, 50, 50);
                });
            });
        }
    }]);

    return ImageFetcher;
})();

ctx.globalAlpha = basemapOpacity;
bg('#202020');
tileThings();

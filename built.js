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

var _mapnik = require('mapnik');

var _mapnik2 = _interopRequireDefault(_mapnik);

var _togeojson = require('togeojson');

var _togeojson2 = _interopRequireDefault(_togeojson);

var _geojsonMapnikify = require('geojson-mapnikify');

var _geojsonMapnikify2 = _interopRequireDefault(_geojsonMapnikify);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _sizes = require('./sizes');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var sm = new _sphericalmercator2.default({ size: 256 });

// Knobs to turn
var debug = true; // turns on tile box renderings
var basemapOpacity = 1;

// Constants
// should this change per image size?
var BORDER = 50;
var MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ';
// Maximum static map size, from mapbox
var TILE_SIZE = 256;

// TODO - make these inputs
//let size = 'a4';
var size = 'debug';
var z = 12; //15;
var center = [-122.2708, 37.8044]; // lon, lat

var StravaMap = (function () {
    function StravaMap(center, z, size, mapid) {
        var _this = this;

        _classCallCheck(this, StravaMap);

        this.center = center;
        this.z = z;
        this.size = size;
        this.mapid = mapid;

        // Get the dims for this paper size
        this.dims = (0, _sizes.getDims)(size);

        // Init the canvas
        this.initCanvas();

        // Initialize geo extents
        this.initGeo(center, z, this.dims);

        // Fetch ze images!
        this.fetchMapboxImages().then(function () {
            console.info('done fetching images!');
            _this.renderVectors().then(function () {
                console.info('done drawing vectors!');
                console.info('rendering to file!');
                _this.renderToFile();
            });
        }).catch(function (err) {
            console.error(err);
        });
    }

    _createClass(StravaMap, [{
        key: 'initGeo',
        value: function initGeo(center, z, dims) {
            // First, get the bounds of the viewport, using:
            //   * the pixel dimensions of the mask
            //   * the geographic center
            //   * the zoom level
            // W-S-E-N
            var bbox = _geoViewport2.default.bounds(center, z, [this.dims.w, this.dims.h]);

            // Next, find the tile extent that covers bbox
            this.xyzBounds = sm.xyz(bbox, z);

            // Find the geographic bbox of the above tiles
            var tileBbox = sm.bbox(this.xyzBounds.minX, this.xyzBounds.minY, z);

            // Get pixel position for each bounding box
            var bboxPx = sm.px([bbox[0], bbox[3]], z);
            var tilePx = sm.px([tileBbox[0], tileBbox[3]], z);

            // Get the vector from the corner of the tile bbox to the corner of the view bbox
            this.offset = [bboxPx[0] - tilePx[0], bboxPx[1] - tilePx[1]];

            if (debug) {
                console.log('.....bbox.....\n', bbox);
                console.log('.....xyzBounds.....\n', this.xyzBounds);
                console.log('.....tileBbox.....\n', tileBbox);
                console.log('.....pixels.....\n', bboxPx, tilePx);
                console.log('.....offset.....\n', this.offset);
            }
        }
    }, {
        key: 'initCanvas',
        value: function initCanvas() {
            this.canvas = new _canvas2.default(this.dims.w, this.dims.h);
            this.ctx = this.canvas.getContext('2d');
        }
    }, {
        key: 'drawBackground',
        value: function drawBackground(color) {
            this.ctx.rect(0, 0, this.dims.w, this.dims.h);
            this.ctx.fillStyle = color;
            this.ctx.fill();
        }
    }, {
        key: 'renderToFile',
        value: function renderToFile() {
            // Render out to a png
            var out = _fs2.default.createWriteStream(__dirname + '/test.png');
            var stream = this.canvas.pngStream();

            stream.on('data', function (chunk) {
                out.write(chunk);
            });

            stream.on('end', function () {
                console.log('saved png');
            });
        }
    }, {
        key: 'fetchMapboxImages',
        value: function fetchMapboxImages() {
            var _this2 = this;

            return new Promise(function (resolve, reject) {
                // Render count starts off at 0
                _this2.renderCount = 0;

                // Calculate the tile x and y ranges for the current bounding box
                var tileBounds = _this2.xyzBounds;
                // Count the tiles
                var count = (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1);
                var ic = 0;
                var promises = [];
                console.info('fetching ' + count);
                for (var x = tileBounds.minX; x <= tileBounds.maxX; x++) {
                    var _loop = function _loop(y) {
                        var relX = x - tileBounds.minX;
                        var relY = y - tileBounds.minY;
                        //if (debug) console.info(`fetching ${x}, ${y}`);

                        //let tile = new ImageFetcher(x, y, z, relX, relY, ic, count);
                        var tilePromise = _this2.fetchImage(x, y, z);
                        promises.push(tilePromise);
                        tilePromise.then(function (tileBuffer) {
                            // Target pixels
                            var pX = relX * TILE_SIZE;
                            var pY = relY * TILE_SIZE;

                            // Log
                            renderCount++;
                            console.log('tile [' + renderCount + '/' + count + '] ... drawing ' + relX + ', ' + relY + ' @ ' + pX + ' [+ ' + _this2.offset[0] + '], ' + pY + ' [+' + _this2.offset[1] + ']');

                            // Adjust by corner offset and render
                            _this2.renderTile(tileBuffer, pX - _this2.offset[0], pY - _this2.offset[1]);

                            // Doneskis
                            resolve();
                        }).catch(function (err) {
                            console.error(err);throw new Error(err);
                        });
                    };

                    for (var y = tileBounds.minY; y <= tileBounds.maxY; y++) {
                        _loop(y);
                    }
                }
                Promise.all(promises).then(function () {
                    resolve();
                }).catch(function (err) {
                    reject(err);
                });
            });
        }
    }, {
        key: 'fetchImage',
        value: function fetchImage(x, y, z) {
            var _this3 = this;

            return new Promise(function (resolve, reject) {
                // Build the URL
                var url = 'https://api.mapbox.com/v4/' + _this3.mapid + '/' + z + '/' + x + '/' + y + '.png?access_token=' + MAPBOX_ACCESS_TOKEN;
                //if (debug) console.info(url);

                // Make the request
                _superagent2.default.get(url).end(function (err, res) {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(res.body);
                    }
                });
            });
        }
    }, {
        key: 'renderTile',
        value: function renderTile(tileBuffer, x, y) {
            console.info(x, y);
            // Create a new image
            var img = new _canvas.Image();
            img.src = tileBuffer;
            // Fade the basemap, if needed
            this.ctx.globalAlpha = basemapOpacity;
            // Draw
            this.ctx.drawImage(img, x, y);
            // Reset opacity
            this.ctx.globalAlpha = 1;
            // If debugging, stroke tile
            if (debug) {
                this.ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
                this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                this.ctx.stroke();
            }
        }
    }, {
        key: 'renderVectors',
        value: function renderVectors() {
            var _this4 = this;

            return new Promise(function (resolve, reject) {
                // Mapnik defaults
                _mapnik2.default.register_default_fonts();
                _mapnik2.default.register_default_input_plugins();

                // Create a new mapnik map
                var map = new _mapnik2.default.Map(dims.w, dims.h);

                // Load the geojson
                var geojson = require('./data/1.json');

                // Update the loaded geojson with styles
                _lodash2.default.assign(geojson.features[0].properties, {
                    stroke: '#FFFFFF',
                    'stroke-width': 1,
                    'stroke-opacity': 0.5
                });

                // Ensure context opacity is at 1
                ctx.globalAlpha = 1;

                // Convert to mapnik xml format
                var xml = (0, _geojsonMapnikify2.default)(geojson, false, function (err, xml) {
                    //console.log(xml);
                    map.fromString(xml, {}, function (err, map) {
                        //map.zoomAll();

                        // Convert to the bbox desired
                        var bounds = sm.convert(_this4.bbox, '900913');

                        // Zoom the map to this bbox
                        map.zoomToBox(bounds);

                        // Create the output image
                        var im = new _mapnik2.default.Image(_this4.dims.w, _this4.dims.h);

                        // Render this map to an image buffer
                        map.render(im, function (err, im) {
                            if (err) {
                                reject(err);return;
                            }
                            // Encode as a png
                            im.encode('png', function (err, buffer) {
                                console.info('vector buffer', buffer);
                                if (err) {
                                    reject(err);return;
                                }
                                var img = new _canvas.Image();
                                img.src = buffer;
                                _this4.ctx.drawImage(img, 0, 0);
                                resolve();
                            });
                        });
                    });
                });
            });
        }
    }]);

    return StravaMap;
})();

//ctx.font = '10px Arial';
//ctx.rotate(.1);
//ctx.fillText("Awesome!", 0, 100);

//var te = ctx.measureText('Awesome!');
//ctx.strokeStyle = 'rgba(0,0,0,0.5)';
//ctx.beginPath();
//ctx.lineTo(50, 102);
//ctx.lineTo(50 + te.width, 102);
//ctx.stroke();

//let fetchMapboxImages = () => {
//    console.log('bbox', bbox);
//
//    // How many images should we fetch from mapbox?
//    let numCols = Math.ceil(dims.w / MAX_SIZE.w);
//    let numRows = Math.ceil(dims.h / MAX_SIZE.h);
//    // How much lat/lng should each image be responsible for?
//    let intervals = {
//        lon: (bbox[2] - bbox[0]) / numCols,
//        lat: (bbox[3] - bbox[1]) / numRows,
//        pixelsX: dims.w / numCols,
//        pixelsY: dims.h / numRows
//    };
//    // Request one image for each range
//    console.log(`fetching ${numCols} x ${numRows} images`)
//    for (let x = 0; x < numCols; x++) {
//        for (let y = 0; y < numRows; y++) {
//             //W-S-E-N
//            let edges = [
//                bbox[0] + intervals.lon * x, //minlon
//                bbox[1] + intervals.lat * y,
//                bbox[0] + intervals.lon * (x + 1),
//                bbox[1] + intervals.lat * (y + 1)
//            ];
//            let z = 14;
//            let xyzBounds = sm.xyz(edges, z);
//            console.log(xyzBounds);
//            // Pixel bounds
//            let pixels = [
//                Math.round(intervals.pixelsX * x),
//                Math.round(intervals.pixelsY * y),
//                Math.round(intervals.pixelsX * (x + 1)),
//                Math.round(intervals.pixelsY * (y + 1))
//            ];
//            //let center = [
//            //    (edges[2] + edges[0]) / 2,
//            //    (edges[3] + edges[1]) / 2
//            //];
//            //let bounds = geoViewport.bounds(center, 14, [MAX_SIZE.w, MAX_SIZE.h]);
//            //let size = [
//            //    pixels[2] - pixels[0],
//            //    pixels[3] - pixels[1]
//            //];
//            //// Calculate center and zoom
//            //let viewport = geoViewport.viewport(bounds, [MAX_SIZE.w, MAX_SIZE.h]);
//            //console.log(x, y);
//            //console.log('bounds', bounds);
//            //console.log(pixels);
//            //console.log(size);
//            //console.log('viewport', viewport);
//            //console.log('recomputed bounds', geoViewport.bounds(viewport.center, viewport.zoom, [dims.w, dims.h]))
//            //console.log('\n\n --- \n\n');
//            //
//            //let pos = [
//            //    MAX_SIZE.w * x,
//            //    MAX_SIZE.h * y
//            //];
//            //
//            let mapboxTile = new ImageFetcher(xyzBounds.minX, xyzBounds.minY, z);
//            break;
//        }
//        break;
//    }
//};

var tileThings = function tileThings() {
    ctx.globalAlpha = basemapOpacity;
    var tileBounds = sm.xyz(bbox, z);
    console.log(tileBounds);
    var count = (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1);
    var ic = 0;
    var promises = [];
    for (var x = tileBounds.minX; x <= tileBounds.maxX; x++) {
        for (var y = tileBounds.minY; y <= tileBounds.maxY; y++) {
            var _relX = x - tileBounds.minX;
            var _relY = y - tileBounds.minY;
            //console.log(`tile [${ic}/${count}]`);
            var tile = new ImageFetcher(x, y, z, _relX, _relY, ic, count);
            var tilePromise = tile.fetchImage();
            promises.push(tilePromise);
        }
    }
    Promise.all(promises).then(function () {
        render();
        ctx.globalAlpha = 1;
        vectorThings();
    });
};

//let renderCount = 0;
//
//
//class ImageFetcher {
//
//    constructor(x, y, z, relX, relY, ic, count) {
//        this.count = count;
//        this.relX = relX;
//        this.relY = relY;
//        //console.info('rendering tile at ' + pos)
//        //console.info(viewport)
//        //this.dims = dims;
//        //let pos = [0,0];
//        //let url = `https://api.mapbox.com/v4/mapbox.streets/${viewport.center[0]},${viewport.center[1]},${viewport.zoom}/${size[0]}x${size[1]}.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ`;
//        this.url = `https://api.mapbox.com/v4/mapbox.streets/${z}/${x}/${y}.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ`;
//        //console.log(url);
//        //this.fetchImage(url, relX, relY);
//    }
//
//    fetchImage() {
//        return new Promise((resolve, reject) => {
//            request.get(this.url)
//                .end((err, res) => {
//                    if (err) {
//                        console.error(err);
//                    }
//                    let size = 256;
//                    renderCount++;
//                    let pX = this.relX * size;
//                    let pY = this.relY * size;
//                    console.log(`tile [${renderCount}/${this.count}] ... drawing ${this.relX}, ${this.relY} @ ${pX}, ${pY}`);
//                    let img = new Image;
//                    img.src = res.body;
//                    // this shifts thing to the proper location
//                    //ctx.drawImage(img, pX - 200, pY - 80);
//
//                    ctx.drawImage(img, pX - offset[0], pY - offset[1]);
//
//                    if (debug) {
//                        ctx.rect(pX - offset[0], pY - offset[1], size, size);
//                        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
//                        ctx.stroke();
//                    }
//                    resolve();
//                    //ctx.drawImage(img, 0, 0, 100, 100);
//                //    //img = new Image;
//                //    img.src = canvas.toBuffer();
//                //    ctx.drawImage(img, 100, 100, 50, 50);
//                //    ctx.drawImage(img, 200, 100, 50, 50);
//                });
//        })
//    }
//
//}

var vectorThings = function vectorThings() {

    // https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0
    _lodash2.default.assign(geojson.features[0].properties, {
        stroke: '#FFFFFF',
        'stroke-width': 1,
        'stroke-opacity': 0.5
    });

    //let l = new mapnik.Layer('rides');
    //l.datasource = new mapnik.Datasource({type:'geojson',file:'data/1.json'});
    //map.add_layer(l);
};

//ctx.globalAlpha = basemapOpacity;
//bg('#202020');
//tileThings();
////vectorThings();

//bg('#202020');
//tileThings();
//vectorThings();

var map = new StravaMap(center, z, size, 'mapbox.streets');

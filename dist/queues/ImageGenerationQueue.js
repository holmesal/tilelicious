'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
//import latLngToTileXY from './tileUtils';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _canvas = require('canvas');

var _canvas2 = _interopRequireDefault(_canvas);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _geoViewport = require('geo-viewport');

var _geoViewport2 = _interopRequireDefault(_geoViewport);

var _sphericalmercator = require('sphericalmercator');

var _sphericalmercator2 = _interopRequireDefault(_sphericalmercator);

var _mapnik = require('mapnik');

var _mapnik2 = _interopRequireDefault(_mapnik);

var _mapnikPool = require('mapnik-pool');

var _mapnikPool2 = _interopRequireDefault(_mapnikPool);

var _togeojson = require('togeojson');

var _togeojson2 = _interopRequireDefault(_togeojson);

var _geojsonMapnikify = require('geojson-mapnikify');

var _geojsonMapnikify2 = _interopRequireDefault(_geojsonMapnikify);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _sizes = require('../utils/sizes');

var _superagentRetry = require('superagent-retry');

var _superagentRetry2 = _interopRequireDefault(_superagentRetry);

var _limiter = require('limiter');

var _fb = require('../utils/fb');

var _firebaseQueue = require('firebase-queue');

var _firebaseQueue2 = _interopRequireDefault(_firebaseQueue);

var _s = require('../utils/s3');

var _s2 = _interopRequireDefault(_s);

var _slack = require('../utils/slack');

var _slack2 = _interopRequireDefault(_slack);

var _renderText = require('../utils/renderText');

var _renderText2 = _interopRequireDefault(_renderText);

var _errors = require('../utils/errors');

var _errors2 = _interopRequireDefault(_errors);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

var _bytes = require('bytes');

var _bytes2 = _interopRequireDefault(_bytes);

var _stringifyObject = require('stringify-object');

var _stringifyObject2 = _interopRequireDefault(_stringifyObject);

var _memwatchNext = require('memwatch-next');

var _memwatchNext2 = _interopRequireDefault(_memwatchNext);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SKIP_TILES = process.env.NODE_ENV != 'production' && false;
var SKIP_ACTIVITIES = process.env.NODE_ENV != 'production' && false;

_memwatchNext2.default.on('leak', function (info) {
    console.info('memory leak!', info);
});

// Shim with custom text rendering function
_canvas.Context2d.prototype.renderText = _renderText2.default;

// Superagent retry requests
(0, _superagentRetry2.default)(_superagent2.default);

var sm = new _sphericalmercator2.default({ size: 256 });

// Knobs to turn
var debug = false; // turns on tile box renderings
var basemapOpacity = 1; // fade the basemap

// Use mapnik renderers in a pool
var mapnikPool = (0, _mapnikPool2.default)(_mapnik2.default);

// Rate-limit tile requests
//let limiter = new RateLimiter(1, 20);
var limiter = new _limiter.RateLimiter(1, 20);

// Load the font
var fontPath = '/assets/Victorious-LeagueGothic-Regular.otf';
_log2.default.info(fontPath);
_log2.default.info(process.env.PWD + fontPath);
var leagueGothic = new _canvas.Font('LeagueGothicRegular', process.env.PWD + fontPath);

// Constants
// should this change per image size?
var BORDER = 50;
// Maximum static map size, from mapbox
var TILE_SIZE = 256;

function logMemory() {
    var mem = process.memoryUsage();
    console.info('memory usage: ' + (0, _bytes2.default)(mem.heapUsed) + ' / ' + (0, _bytes2.default)(mem.heapTotal));
}

var StravaMap = function () {
    function StravaMap(pixelsScreen, zScreen, bboxScreen, paperSize, theme, vectorScaleScale, uid, activities, imageLocation, text) {
        var _this = this;

        _classCallCheck(this, StravaMap);

        this.textColor = theme.textColor;
        this.copyrightTextColor = theme.copyrightTextColor;
        this.mapCreds = theme.mapCreds;
        this.zScreen = zScreen;
        this.vectorStyle = theme.vectorStyle;
        this.vectorScaleScale = vectorScaleScale;
        this.uid = uid;
        this.backgroundColor = theme.backgroundColor;
        this.activities = activities;
        this.paperSize = paperSize;
        this.imageLocation = imageLocation;
        this.text = text;

        logMemory();

        this.startTime = Date.now();

        // Promise for completion
        this.complete = new Promise(function (resolve, reject) {
            _this.resolve = resolve;
            _this.reject = reject;
        });

        // Our bounding box is (and always will be) the geographic bounding box from the screen
        this.bbox = bboxScreen;

        // Get the pixel dimensions to print at this paper size
        this.pixelsPrint = (0, _sizes.getDims)(paperSize);
        // Calc some useful dimensions
        this.calcPixels();
        _log2.default.info(paperSize, this.pixelsPrint);

        // How much bigger is the paper than the screen?
        var widthScaleFactor = this.pixelsPrint.mapWidth / pixelsScreen.w;

        // How many zoom levels do we have to go up to cover this screen
        var zSteps = undefined;
        for (zSteps = 0; zSteps < 28; zSteps++) {
            if (Math.pow(2, zSteps) >= widthScaleFactor) {
                break;
            }
        }

        // Request tiles at this level
        this.tileZ = zScreen + zSteps;

        // The residual scale is what will effect fine-grained tile scaling
        var residualScale = Math.pow(2, zSteps) - widthScaleFactor;

        // What's the "width" of this zoom interval?
        var intervalWidth = undefined;
        if (zSteps > 0) {
            intervalWidth = Math.pow(2, zSteps) - Math.pow(2, zSteps - 1);
        } else {
            intervalWidth = 2;
        }

        // The fraction of scale between the pixel-based scale factor and the next power of 2
        var fractionalResidualScale = residualScale / intervalWidth;

        // Figure out the tile scale factor
        this.tileScaleFactor = 1 - 0.5 * fractionalResidualScale;
        //this.tileScaleFactor = 0.75;  // works at 1.5 (0.5 residual)
        //this.tileScaleFactor = 0.625; // works at 1.25 (0.75 residual)
        //this.tileScaleFactor = 0.875; // works at 1.75 (0.25 residual)

        // Figure out the vector scale factor
        this.vectorScaleFactor = widthScaleFactor;

        if (debug) {
            _log2.default.info('.....pixelsScreen.....\n', pixelsScreen);
            _log2.default.info('.....pixelsPrint.....\n', this.pixelsPrint);
            _log2.default.info('.....widthScaleFactor.....\n', widthScaleFactor);
            _log2.default.info('.....zSteps (additional zoom).....\n', zSteps);
            _log2.default.info('.....tileZ (request tiles at this zoom).....\n', this.tileZ);
            _log2.default.info('.....fractionalResidualScale (correct tiles for this).....\n', fractionalResidualScale);
            _log2.default.info('.....tileScaleFactor.....\n', this.tileScaleFactor);
            _log2.default.info('.....vectorScaleFactor.....\n', this.vectorScaleFactor);
        }

        // Init the canvas
        this.initCanvas();

        // Initialize geo extents
        this.initGeo();

        // Fetch ze images!
        this.fetchMapboxImages().then(function () {
            _log2.default.info('done fetching images!');
            _this.renderActivities().then(function () {
                _log2.default.info('done drawing vectors!');
                _this.renderToFile().then(function (url) {
                    _this.cleanup();
                    _this.resolve(url);
                }).catch(function (err) {
                    _this.reject(err);
                });
            }).catch(function (err) {
                _this.reject(err);
            });
        }).catch(function (err) {
            _this.reject(err);
        });

        //this.renderActivities().then(() => {
        //    log.info('done drawing vectors!');
        //    log.info('rendering to file!');
        //    this.renderToFile();
        //}).catch((err) => {log.error(err)});
    }

    _createClass(StravaMap, [{
        key: 'calcPixels',
        value: function calcPixels() {
            var mapUpperLeftX = Math.floor((this.pixelsPrint.printWidth - this.pixelsPrint.mapWidth) / 2);
            this.locations = {
                mapUpperLeft: {
                    x: mapUpperLeftX,
                    y: this.pixelsPrint.paddingTop
                }
            };
        }
    }, {
        key: 'initGeo',
        value: function initGeo() {
            // First, get the bounds of the viewport, using:
            //   * the pixel dimensions of the mask
            //   * the geographic center
            //   * the zoom level
            // W-S-E-N

            // Next, find the tile extent that covers bbox
            this.xyzBounds = sm.xyz(this.bbox, this.tileZ);

            // Find the geographic bbox of the lower-left corner tile
            var tileBbox = sm.bbox(this.xyzBounds.minX, this.xyzBounds.minY, this.tileZ);

            // Get corner pixel position for each bounding box
            var bboxPx = sm.px([this.bbox[0], this.bbox[3]], this.tileZ);
            var tilePx = sm.px([tileBbox[0], tileBbox[3]], this.tileZ);

            // Get the vector from the corner of the tile bbox to the corner of the view bbox
            this.offset = [Math.floor((bboxPx[0] - tilePx[0]) * this.tileScaleFactor), Math.floor((bboxPx[1] - tilePx[1]) * this.tileScaleFactor)];

            //this.offset = [0, 0]

            if (debug) {
                _log2.default.info('.....bbox.....\n', this.bbox);
                _log2.default.info('.....xyzBounds.....\n', this.xyzBounds);
                _log2.default.info('.....tileBbox.....\n', tileBbox);
                _log2.default.info('.....pixels.....\n', bboxPx, tilePx);
                _log2.default.info('.....offset.....\n', this.offset);
            }
        }
    }, {
        key: 'initCanvas',
        value: function initCanvas() {
            // Create a canvas for the print
            this.canvas = new _canvas2.default(this.pixelsPrint.printWidth, this.pixelsPrint.printHeight);
            this.ctx = this.canvas.getContext('2d');

            // Add the font
            this.ctx.addFont(leagueGothic);

            // Create an intermediate canvas to hold image tiles
            // This makes it easy to render image tiles "off the edge" of this canvas without having to fuck with masking
            // each and every time
            this.mapCanvas = new _canvas2.default(this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
            this.mapCtx = this.mapCanvas.getContext('2d');

            // Fill the canvas with white
            //this.fillPaperBackground('#FFFFFF');
            // Fill the map background with map color
            // This makes cracks less apparent
            this.fillMapBackground(this.backgroundColor);
        }
    }, {
        key: 'fillPaperBackground',
        value: function fillPaperBackground(color) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, 0, this.pixelsPrint.printWidth, this.pixelsPrint.printHeight);
        }
    }, {
        key: 'fillMapBackground',
        value: function fillMapBackground(color) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(this.locations.mapUpperLeft.x, this.pixelsPrint.paddingTop, this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
        }
    }, {
        key: 'renderToFile',
        value: function renderToFile() {
            var _this2 = this;

            return new Promise(function (resolve, reject) {
                // Encode the mapnik map as a png
                // Encode as a png
                _this2.im.encode('png', function (err, buffer) {
                    //log.info('vector buffer', buffer);
                    if (err) {
                        reject(err);return;
                    }
                    var img = new _canvas.Image();
                    img.src = buffer;

                    // Draw the map
                    _this2.drawVectorsToCanvas(img);

                    // Draw the text
                    _this2.drawTextToCanvas();

                    // Render out to a png
                    var stream = _this2.canvas.pngStream();

                    // Create a unique key for this upload
                    var key = _this2.uid + '-' + _this2.paperSize + '-' + Date.now() + '.png';

                    // Render to the local filesystem
                    //this.streamToLocalFS(stream, key, resolve, reject);

                    // Upload to amazon s3
                    _this2.streamToAmazonS3(stream, key, resolve, reject);
                });
            });
        }
    }, {
        key: 'drawVectorsToCanvas',
        value: function drawVectorsToCanvas(img) {
            _log2.default.info('drawing map starting at ', this.locations.mapUpperLeft.x, img.width, img.height);
            this.ctx.drawImage(img, this.locations.mapUpperLeft.x, this.locations.mapUpperLeft.y, this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
        }
    }, {
        key: 'drawTextToCanvas',
        value: function drawTextToCanvas() {
            // Insert spaces between each character
            var text = this.text.split('').join(' ');
            var _pixelsPrint = this.pixelsPrint;
            var printHeight = _pixelsPrint.printHeight;
            var printWidth = _pixelsPrint.printWidth;
            var paddingTop = _pixelsPrint.paddingTop;
            var mapHeight = _pixelsPrint.mapHeight;
            var mapWidth = _pixelsPrint.mapWidth;
            var fontSize = _pixelsPrint.fontSize;
            var copyrightFontSize = _pixelsPrint.copyrightFontSize;
            var letterSpacing = _pixelsPrint.letterSpacing;
            var textMarginTop = _pixelsPrint.textMarginTop;
            // Figure out the top left of the rectangle

            var bottomAreaHeight = printHeight - mapHeight - paddingTop;
            // Text is drawn from the lower-left! Importante!
            var relTextY = textMarginTop + fontSize; //bottomAreaHeight / 2;
            var textY = paddingTop + mapHeight + relTextY;

            // Measure the text
            this.ctx.font = fontSize + 'px LeagueGothicRegular';
            var textWidth = Math.floor(this.ctx.measureText(text).width);
            var textX = this.locations.mapUpperLeft.x + mapWidth / 2;
            _log2.default.info('text width is', textWidth, 'and is at x', textX);

            this.ctx.fillStyle = this.textColor;
            this.ctx.textAlign = 'center';
            //this.ctx.fillRect(textX, textY, textWidth, fontSize);
            this.ctx.fillText(text, textX, textY, 0);
            //this.ctx.renderText(this.text, textX+letterSpacing/2, textY, letterSpacing);

            // Draw the copyright text
            var copyrightTextPadding = 20;
            var copyrightTextY = paddingTop + mapHeight - copyrightTextPadding;
            var copyrightTextX = (printWidth - mapWidth) / 2 + mapWidth - copyrightTextPadding;
            this.ctx.font = copyrightFontSize + 'px HelveticaNeue';
            this.ctx.fillStyle = this.copyrightTextColor;
            this.ctx.textAlign = 'right';
            //this.ctx.fillRect(copyrightTextX, copyrightTextY, 200, fontSize);
            console.info('rendering copyright text at ' + copyrightTextX + ', ' + copyrightTextY);
            this.ctx.fillText('© Mapbox, © OpenStreetMap', copyrightTextX, copyrightTextY, 0);
        }
    }, {
        key: 'streamToLocalFS',
        value: function streamToLocalFS(stream, key, resolve, reject) {
            _log2.default.info('rendering to local filesystem!');
            var out = _fs2.default.createWriteStream(__dirname + 'renders/' + key);
            stream.on('data', function (chunk) {
                out.write(chunk);
            });

            stream.on('end', function () {
                _log2.default.info('saved png');
                resolve();
            });
        }
    }, {
        key: 'streamToAmazonS3',
        value: function streamToAmazonS3(stream, key, resolve, reject) {
            var _this3 = this;

            _log2.default.info('streaming to amazon s3!');
            var keys = ['textColor', 'mapCreds', 'zScreen', 'vectorStyle', 'vectorScaleScale', 'uid', 'backgroundColor', 'activities', 'paperSize', 'imageLocation', 'text'];
            var metadata = {};
            keys.forEach(function (key) {
                return metadata[key] = JSON.stringify(_this3[key]);
            });
            //metadata.text = _.escape(metadata.text);
            metadata.text = metadata.text.replace(/[^\x00-\x7F]/g, "");
            (0, _s2.default)(stream, key, metadata).then(function (details) {
                var elapsed = Math.round((Date.now() - _this3.startTime) / 100) / 10;
                var url = details.Location;
                (0, _slack2.default)(':frame_with_picture: new *' + _this3.paperSize + '* _"' + _this3.text + '"_ generated in *' + elapsed + 's*!\n' + url);
                _this3.pointFirebaseToS3(url, elapsed);
                resolve(url);
            }).catch(reject);
        }
    }, {
        key: 'pointFirebaseToS3',
        value: function pointFirebaseToS3(location, time) {
            if (this.imageLocation) {
                var completedImageRef = _fb.rootRef.child(this.imageLocation);
                completedImageRef.set({
                    url: location,
                    generationTime: time
                });
            } else {
                _log2.default.info('no complete firebase location provided');
            }
        }
    }, {
        key: 'fetchMapboxImages',
        value: function fetchMapboxImages() {
            var _this4 = this;

            return new Promise(function (resolve, reject) {
                // Skip if on debug
                if (SKIP_TILES) {
                    resolve();
                    return;
                }
                // Render count starts off at 0
                _this4.renderCount = 0;

                // Calculate the tile x and y ranges for the current bounding box
                var tileBounds = _this4.xyzBounds;
                // Count the tiles
                var count = (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1);
                var ic = 0;
                var promises = [];
                _log2.default.info('fetching ' + count);

                var _loop = function _loop(x) {
                    var _loop2 = function _loop2(y) {
                        var relX = x - tileBounds.minX;
                        var relY = y - tileBounds.minY;
                        //if (debug) log.info(`fetching ${x}, ${y}`);

                        //let tile = new ImageFetcher(x, y, z, relX, relY, ic, count);
                        // Return a promise for all operations on this tile
                        var tilePromise = new Promise(function (resolveTile, reject) {
                            // Fetchimage returns a promise that resolves when the image comes back
                            _this4.fetchImage(x, y, _this4.tileZ).then(function (tileBuffer) {
                                // Target pixels
                                var pX = relX * Math.floor(TILE_SIZE * _this4.tileScaleFactor);
                                var pY = relY * Math.floor(TILE_SIZE * _this4.tileScaleFactor);

                                // Log
                                _this4.renderCount++;
                                _log2.default.info('tile [' + _this4.renderCount + '/' + count + '] ... drawing ' + relX + ', ' + relY + ' @ ' + pX + ' [+ ' + _this4.offset[0] + '], ' + pY + ' [+' + _this4.offset[1] + ']');

                                // Adjust by corner offset and render
                                try {
                                    _this4.renderTile(tileBuffer, pX - _this4.offset[0], pY - _this4.offset[1]);
                                } catch (err) {
                                    _log2.default.error(err);
                                    reject({
                                        stage: 'rendering image tile',
                                        error: err,
                                        data: {
                                            x: x, y: y,
                                            z: _this4.tileZ
                                        }
                                    });
                                    return false;
                                }

                                // Done with all tile operations
                                resolveTile();
                            }).catch(function (err) {
                                reject(err);
                            });
                        });
                        promises.push(tilePromise);
                    };

                    for (var y = tileBounds.minY; y <= tileBounds.maxY; y++) {
                        _loop2(y);
                    }
                };

                for (var x = tileBounds.minX; x <= tileBounds.maxX; x++) {
                    _loop(x);
                }
                Promise.all(promises).then(function () {
                    // Draw map canvas to print canvas
                    _this4.drawMapCanvasToPrintCanvas();
                    resolve();
                }).catch(function (err) {
                    reject(err);
                });
            });
        }
    }, {
        key: 'fetchImage',
        value: function fetchImage(x, y, z) {
            var _this5 = this;

            return new Promise(function (resolve, reject) {
                // Build the URL
                var url = 'https://api.mapbox.com/v4/' + _this5.mapCreds.mapId + '/' + z + '/' + x + '/' + y + '.png?access_token=' + _this5.mapCreds.accessToken;
                //if (debug) log.info(url);

                // Make the request
                // rate-limited
                limiter.removeTokens(1, function () {
                    _superagent2.default.get(url).retry(5).timeout(10000).end(function (err, res) {
                        if (err) {
                            _log2.default.error('error fetching image tile from mapbox', err);
                            //dumpError(err);
                            reject({
                                stage: 'fetching image tile from mapbox',
                                error: err,
                                data: {
                                    url: url
                                }
                            });
                        } else {
                            resolve(res.body);
                        }
                    });
                });
            });
        }
    }, {
        key: 'renderTile',
        value: function renderTile(tileBuffer, x, y) {
            // Create a new image
            var img = new _canvas.Image();
            img.src = tileBuffer;
            // Fade the basemap, if needed
            //this.ctx.globalAlpha = basemapOpacity;
            // Reset opacity
            this.mapCtx.globalAlpha = 1;
            // Draw
            this.mapCtx.drawImage(img, Math.floor(x), Math.floor(y), Math.floor(TILE_SIZE * this.tileScaleFactor), Math.floor(TILE_SIZE * this.tileScaleFactor));
            // If debugging, stroke tile
            if (debug) {
                this.mapCtx.rect(x, y, TILE_SIZE * this.tileScaleFactor, TILE_SIZE * this.tileScaleFactor);
                this.mapCtx.strokeStyle = 'rgba(255,0,0,0.7)';
                this.mapCtx.stroke();
            }
        }
    }, {
        key: 'drawMapCanvasToPrintCanvas',
        value: function drawMapCanvasToPrintCanvas() {
            var img = this.mapCanvas.toBuffer();
            this.ctx.drawImage(this.mapCanvas, this.locations.mapUpperLeft.x, this.locations.mapUpperLeft.y, this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
        }
    }, {
        key: 'renderActivities',
        value: function renderActivities() {
            var _this6 = this;

            return new Promise(function (resolve, reject) {
                // Mapnik defaults
                _mapnik2.default.register_default_fonts();
                _mapnik2.default.register_default_input_plugins();

                // Create the output image
                _this6.im = new _mapnik2.default.Image(_this6.pixelsPrint.mapWidth, _this6.pixelsPrint.mapHeight);

                // Create a mapnik pool
                _this6.pool = new mapnikPool.fromString('<Map></Map>', { size: { width: _this6.pixelsPrint.mapWidth, height: _this6.pixelsPrint.mapHeight } });

                if (SKIP_ACTIVITIES) {
                    resolve();
                    return;
                }

                //// Render the activites
                var promises = [];
                _this6.activities.forEach(function (activityId) {
                    promises.push(_this6.renderActivity(activityId));
                });
                //for (let i=1; i<=14; i++) {
                //    let geojson = require(`../data/geojson/${i}.json`);
                //    log.info('rendering geojson ' + i);
                //    promises.push(this.renderGeoJSONVector(geojson));
                //}

                Promise.all(promises).then(function () {
                    resolve();
                }).catch(function (err) {
                    reject(err);
                });
            });
        }
    }, {
        key: 'renderActivity',
        value: function renderActivity(activityId) {
            var _this7 = this;

            return new Promise(function (resolve, reject) {
                _log2.default.info('--- rendering activity ' + activityId);
                (0, _fb.activityStreamRef)(activityId).once('value', function (snap) {
                    var activity = snap.val();
                    if (activity) {
                        _log2.default.info('--- fetched data for activity ' + activityId);
                        //log.info(activity.geojson);
                        _this7.renderGeoJSONVector(activity.geojson, activityId).then(function () {
                            resolve();
                        }).catch(reject);
                    } else {
                        var rej = JSON.stringify({
                            stage: 'fetching geojson for activity',
                            error: 'no geojson found for activityId: ' + activityId,
                            data: { activityId: activityId }
                        });
                        (0, _slack2.default)('*Tried to render a GeoJSON that didn\'t exist... :-/*\n`' + rej + '`\n' + (0, _fb.activityStreamRef)(activityId).toString());
                        resolve();
                    }
                });
            });
        }
    }, {
        key: 'renderGeoJSONVector',
        value: function renderGeoJSONVector(geojson, activityId) {
            var _this8 = this;

            return new Promise(function (resolve, reject) {
                var strokeWidth = _this8.vectorStyle.strokeWidth;
                if (_this8.vectorScaleScale) {
                    strokeWidth = strokeWidth * _this8.vectorScaleFactor * _this8.vectorScaleScale;
                }
                // Update the loaded geojson with styles
                //log.info(geojson.features[0])
                geojson.features[0].properties = {
                    stroke: _this8.vectorStyle.stroke,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': _this8.vectorStyle.opacity,
                    'smooth': 1,
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round'
                };

                //log.info(geojson.features[0]);

                // Ensure context opacity is at 1
                _this8.ctx.globalAlpha = 1;

                // Convert to mapnik xml format
                var xml = (0, _geojsonMapnikify2.default)(geojson, false, function (err, xml) {
                    //log.info(xml);
                    _this8.pool.acquire(function (err, map) {
                        if (err) {
                            _log2.default.error(err);
                            _this8.reject({
                                stage: 'acquiring map from pool',
                                error: err
                            });
                            return false;
                        }
                        map.fromString(xml, {}, function (err, map) {
                            //map.zoomAll();

                            // Convert to the bbox desired
                            var bounds = sm.convert(_this8.bbox, '900913');

                            // Zoom the map to this bbox
                            map.zoomToBox(bounds);

                            // Render this map to an image buffer
                            map.render(_this8.im, function (err, im) {
                                if (err) {
                                    _log2.default.error(err);
                                    reject({
                                        stage: 'rendering map to image buffer',
                                        error: err
                                    });
                                    return false;
                                }
                                _log2.default.info('--- done rendering activity ' + activityId);
                                // Release this map so other threads can draw on it
                                _this8.pool.release(map);
                                // We're done here.
                                resolve();
                            });
                        });
                    });
                });
            });
        }
    }, {
        key: 'cleanup',
        value: function cleanup() {
            logMemory();
            _log2.default.info('cleaning up...');
            this.pool.destroy();
            logMemory();
        }
    }]);

    return StravaMap;
}();

// light

var themes = {
    dark: {
        mapCreds: {
            mapId: 'mkulp.84ae055a',
            accessToken: 'pk.eyJ1IjoibWt1bHAiLCJhIjoiY2loc2V6aWVtMDBweHRma2g3N29mMXRzaSJ9.Qpo0BatZeR2genlYpumd5Q'
        },
        vectorStyle: {
            opacity: 0.15,
            stroke: '#FFFFFF',
            strokeWidth: 1
        },
        backgroundColor: '#202020',
        textColor: '#202020',
        copyrightTextColor: '#535353'
    },
    light: {
        mapCreds: {
            mapId: 'matthewkulp.789e1a95',
            accessToken: 'pk.eyJ1IjoibWF0dGhld2t1bHAiLCJhIjoiY2loNzVzYXpiMGhubnVla3R2NGNvcG1mZSJ9.F_fiMIojh6Dg5kA_-RERMw'
        },
        vectorStyle: {
            opacity: 0.15,
            stroke: '#000000',
            strokeWidth: 1
        },
        backgroundColor: '#FFFFFF',
        textColor: '#202020',
        copyrightTextColor: '#cecece'
    }
};

// light
//let mapCreds = {
//
//};
//let vectorStyle = {
//    opacity: 0.15,
//    stroke: '#000000',
//    strokeWidth: 1
//};

//// For testing - this will eventually come from the frontend
//let paperSize = 'a4';
//let pixelsScreen = screenSizes[paperSize]; // change this so it doesn't match the paper size
//let zScreen = 13;
//let bboxScreen = [-122.34649658203124,37.78848836594184,-122.24349975585938,37.88745395776327];

//let map = new StravaMap(pixelsScreen, zScreen, bboxScreen, paperSize, mapCreds.dark, vectorStyle.dark, vectorScaleScale)
//map.complete.then(() => {
//    log.info('promise ran!')
//});

//let set = [
//    {theme: 'light', size: '18x24'},
//    //{theme: 'light', size: '18x24', vectorScaleScale: 1},
//    //{theme: 'light', size: '18x24', vectorScaleScale: 0.5},
//    //{theme: 'light', size: '12x16'},
//    //{theme: 'light', size: '12x16', vectorScaleScale: 1},
//    //{theme: 'light', size: '12x16', vectorScaleScale: 0.5},
//    //{theme: 'dark', size: '18x24'},
//    //{theme: 'dark', size: '18x24', vectorScaleScale: 1},
//    //{theme: 'dark', size: '18x24', vectorScaleScale: 0.5},
//    //{theme: 'dark', size: '12x16'},
//    //{theme: 'dark', size: '12x16', vectorScaleScale: 1},
//    //{theme: 'dark', size: '12x16', vectorScaleScale: 0.5},
//];
//
//let processSet = () => {
//    if (set.length === 0) return false;
//    let option = set.shift();
//    let path = '/export/';
//    let vectorScaleScale = option.vectorScaleScale || false;
//    let filename = `${path}${option.size}_vectorScale=${vectorScaleScale}_${option.theme}.png`;
//    log.info(`\n\n\nstarting ${filename}\n\n`);
//
//    let backgroundColor = option.theme === 'dark' ? '#202020' : '#FFFFFF'
//
//    let pixelsScreen = screenSizes[option.size];
//
//    let map = new StravaMap(screenSizes[option.size], zScreen, bboxScreen, option.size, mapCreds[option.theme], vectorStyle[option.theme], vectorScaleScale, filename, backgroundColor);
//    map.complete.then(() => {
//        processSet();
//    });
//
//};

//processSet();

// TODO - make this a property of print size
var vectorScaleScale = 0.65;

var generatePrint = function generatePrint(data) {
    return new Promise(function (resolve, reject) {
        _log2.default.info('generating print...');
        _log2.default.info(data);
        if (!data.pixelsScreen || !data.paperSize || !data.zScreen || !data.bboxScreen || !data.theme || !data.activities || !data.uid || !data.imageLocation) {
            _log2.default.error('parameter missing', data);
            reject({
                stage: 'checking validity of queue item data',
                error: 'missing parameter',
                data: data
            });
        } else {
            (function () {
                var hd = new _memwatchNext2.default.HeapDiff();
                var map = new StravaMap(data.pixelsScreen, data.zScreen, data.bboxScreen, data.paperSize, themes[data.theme], vectorScaleScale, data.uid, data.activities, data.imageLocation, data.text);
                map.complete.then(function (url) {
                    var diff = hd.end();
                    console.info('vvv heap diff ---');
                    console.info((0, _stringifyObject2.default)(diff));
                    resolve(url);
                    map = null;
                }).catch(function (err) {
                    _log2.default.error('image generation request failed...');
                    //dumpError(err);
                    reject(err);
                    map = null;
                });
            })();
        }
    });
};

var queue = new _firebaseQueue2.default(_fb.imageGenerationQueueRef, function (data, progress, resolve, reject) {
    _log2.default.info('imageGeneration queue running for user: ', data.uid, data);
    generatePrint(data).then(resolve).catch(function (err) {
        err.meta = data;
        (0, _errors2.default)(err);
        _log2.default.info('rejecting image queue!');
        reject(err);
    });
});

_log2.default.info('imageGeneration queue up and running');

exports.default = generatePrint;
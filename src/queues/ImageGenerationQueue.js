import Canvas, {Image, Font, Context2d} from 'canvas';
import fs from 'fs';
import util from 'util';
import path from 'path';
import request from 'superagent';
import geoViewport from 'geo-viewport';
//import latLngToTileXY from './tileUtils';
import SM from 'sphericalmercator';
import mapnik from 'mapnik';
import MapnikPool from 'mapnik-pool';
import toGeoJSON from 'togeojson';
import mapnikify from 'geojson-mapnikify';
import _ from 'lodash';
import {getDims, screenSizes} from '../utils/sizes';
import retry from 'superagent-retry';
import {RateLimiter} from 'limiter';
import {imageGenerationQueueRef, activityStreamRef, rootRef} from '../utils/fb';
import Queue from 'firebase-queue';
import streamToS3 from '../utils/s3';
import slack from '../utils/slack';
import renderText from '../utils/renderText';
import dumpError from '../utils/errors';
import log from '../log';

// Shim with custom text rendering function
Context2d.prototype.renderText = renderText;

// Superagent retry requests
retry(request);

let sm = new SM({size: 256});

// Knobs to turn
let debug = false;                     // turns on tile box renderings
let basemapOpacity = 1;               // fade the basemap

// Use mapnik renderers in a pool
let mapnikPool = MapnikPool(mapnik);

// Rate-limit tile requests
//let limiter = new RateLimiter(1, 20);
let limiter = new RateLimiter(1, 20);

// Load the font
let fontPath = '/assets/Victorious-LeagueGothic-Regular.otf';
log.info(fontPath);
log.info(process.env.PWD + fontPath);
let leagueGothic = new Font('LeagueGothicRegular', process.env.PWD + fontPath);

// Constants
// should this change per image size?
let BORDER = 50;
// Maximum static map size, from mapbox
let TILE_SIZE = 256;

class StravaMap {
    constructor(pixelsScreen, zScreen, bboxScreen, paperSize, theme, vectorScaleScale, uid, activities, imageLocation, text) {
        this.textColor = theme.textColor;
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

        this.startTime = Date.now();

        // Promise for completion
        this.complete = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });

        // Our bounding box is (and always will be) the geographic bounding box from the screen
        this.bbox = bboxScreen;

        // Get the pixel dimensions to print at this paper size
        this.pixelsPrint = getDims(paperSize);
        // Calc some useful dimensions
        this.calcPixels();
        log.info(paperSize, this.pixelsPrint);

        // How much bigger is the paper than the screen?
        let widthScaleFactor = this.pixelsPrint.mapWidth / pixelsScreen.w;

        // How many zoom levels do we have to go up to cover this screen
        let zSteps;
        for (zSteps = 0; zSteps < 28; zSteps++) {
            if (Math.pow(2, zSteps) >= widthScaleFactor) {
                break;
            }
        }

        // Request tiles at this level
        this.tileZ = zScreen + zSteps;

        // The residual scale is what will effect fine-grained tile scaling
        let residualScale = Math.pow(2, zSteps) - widthScaleFactor;

        // What's the "width" of this zoom interval?
        let intervalWidth;
        if (zSteps > 0) {
            intervalWidth = Math.pow(2, zSteps) - Math.pow(2, zSteps - 1);
        } else {
            intervalWidth = 2;
        }

        // The fraction of scale between the pixel-based scale factor and the next power of 2
        let fractionalResidualScale = (residualScale / intervalWidth);

        // Figure out the tile scale factor
        this.tileScaleFactor = 1 - 0.5 * fractionalResidualScale;
        //this.tileScaleFactor = 0.75;  // works at 1.5 (0.5 residual)
        //this.tileScaleFactor = 0.625; // works at 1.25 (0.75 residual)
        //this.tileScaleFactor = 0.875; // works at 1.75 (0.25 residual)

        // Figure out the vector scale factor
        this.vectorScaleFactor = widthScaleFactor;

        if (debug) {
            log.info('.....pixelsScreen.....\n', pixelsScreen);
            log.info('.....pixelsPrint.....\n', this.pixelsPrint);
            log.info('.....widthScaleFactor.....\n', widthScaleFactor);
            log.info('.....zSteps (additional zoom).....\n', zSteps);
            log.info('.....tileZ (request tiles at this zoom).....\n', this.tileZ);
            log.info('.....fractionalResidualScale (correct tiles for this).....\n', fractionalResidualScale);
            log.info('.....tileScaleFactor.....\n', this.tileScaleFactor);
            log.info('.....vectorScaleFactor.....\n', this.vectorScaleFactor);
        }

        // Init the canvas
        this.initCanvas();

        // Initialize geo extents
        this.initGeo();


        // Fetch ze images!
        this.fetchMapboxImages().then(() => {
            log.info('done fetching images!');
            this.renderActivities().then(() => {
                log.info('done drawing vectors!');
                this.renderToFile().then((url) => {
                    this.cleanup();
                    this.resolve(url);
                }).catch((err) => {dumpError(err); this.reject(err);})
            }).catch((err) => {dumpError(err); this.reject(err);});
        })
        .catch((err) => {dumpError(err); this.reject(err);});


        //this.renderActivities().then(() => {
        //    log.info('done drawing vectors!');
        //    log.info('rendering to file!');
        //    this.renderToFile();
        //}).catch((err) => {log.error(err)});

    }

    calcPixels() {
        let mapUpperLeftX = Math.floor((this.pixelsPrint.printWidth - this.pixelsPrint.mapWidth) / 2);
        this.locations = {
            mapUpperLeft: {
                x: mapUpperLeftX,
                y: this.pixelsPrint.paddingTop
            }
        }
    }

    initGeo() {
        // First, get the bounds of the viewport, using:
        //   * the pixel dimensions of the mask
        //   * the geographic center
        //   * the zoom level
        // W-S-E-N

        // Next, find the tile extent that covers bbox
        this.xyzBounds = sm.xyz(this.bbox, this.tileZ);

        // Find the geographic bbox of the lower-left corner tile
        let tileBbox = sm.bbox(this.xyzBounds.minX, this.xyzBounds.minY, this.tileZ);

        // Get corner pixel position for each bounding box
        let bboxPx = sm.px([this.bbox[0], this.bbox[3]], this.tileZ);
        let tilePx = sm.px([tileBbox[0], tileBbox[3]], this.tileZ);

        // Get the vector from the corner of the tile bbox to the corner of the view bbox
        this.offset = [
            Math.floor((bboxPx[0] - tilePx[0]) * this.tileScaleFactor),
            Math.floor((bboxPx[1] - tilePx[1]) *this.tileScaleFactor)
        ];

        //this.offset = [0, 0]

        if (debug) {
            log.info('.....bbox.....\n', this.bbox);
            log.info('.....xyzBounds.....\n', this.xyzBounds);
            log.info('.....tileBbox.....\n', tileBbox);
            log.info('.....pixels.....\n', bboxPx, tilePx);
            log.info('.....offset.....\n', this.offset);
        }
    }

    initCanvas() {
        // Create a canvas for the print
        this.canvas = new Canvas(this.pixelsPrint.printWidth, this.pixelsPrint.printHeight);
        this.ctx = this.canvas.getContext('2d');

        // Add the font
        this.ctx.addFont(leagueGothic);

        // Create an intermediate canvas to hold image tiles
        // This makes it easy to render image tiles "off the edge" of this canvas without having to fuck with masking
        // each and every time
        this.mapCanvas = new Canvas(this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
        this.mapCtx = this.mapCanvas.getContext('2d');

        // Fill the canvas with white
        //this.fillPaperBackground('#FFFFFF');
        // Fill the map background with map color
        // This makes cracks less apparent
        this.fillMapBackground(this.backgroundColor);
    }

    fillPaperBackground(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.pixelsPrint.printWidth, this.pixelsPrint.printHeight);
    }

    fillMapBackground(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(this.locations.mapUpperLeft.x, this.pixelsPrint.paddingTop, this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
    }

    renderToFile() {
        return new Promise((resolve, reject) => {
            // Encode the mapnik map as a png
            // Encode as a png
            this.im.encode('png', (err, buffer) => {
                //log.info('vector buffer', buffer);
                if (err) {reject(err); return}
                let img = new Image;
                img.src = buffer;

                // Draw the map
                this.drawVectorsToCanvas(img);

                // Draw the text
                this.drawTextToCanvas();

                // Render out to a png
                let stream = this.canvas.pngStream();

                // Create a unique key for this upload
                let key = `${this.uid}-${this.paperSize}-${Date.now()}.png`;

                // Render to the local filesystem
                //this.streamToLocalFS(stream, key, resolve, reject);

                // Upload to amazon s3
                this.streamToAmazonS3(stream, key, resolve, reject);
            });
        })
    }

    drawVectorsToCanvas(img) {
        log.info('drawing map starting at ', this.locations.mapUpperLeft.x, img.width, img.height);
        this.ctx.drawImage(img, this.locations.mapUpperLeft.x, this.locations.mapUpperLeft.y, this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
    }

    drawTextToCanvas() {
        // Insert spaces between each character
        let text = this.text.split('').join(' ');
        let {printHeight, printWidth, paddingTop, mapHeight, mapWidth, fontSize, letterSpacing} = this.pixelsPrint;
        // Figure out the top left of the rectangle
        let bottomAreaHeight = printHeight - mapHeight - paddingTop;
        // Text is drawn from the lower-left! Importante!
        let relTextY = bottomAreaHeight / 2;
        let textY = paddingTop + mapHeight + relTextY;

        // Measure the text
        this.ctx.font = `${fontSize}px LeagueGothicRegular`;
        let textWidth = Math.floor(this.ctx.measureText(text).width);
        let textX = this.locations.mapUpperLeft.x + (mapWidth) / 2;
        log.info('text width is', textWidth, 'and is at x', textX);

        // Draw a red rectangle for now
        this.ctx.fillStyle = this.textColor;
        this.ctx.textAlign = 'center';
        //this.ctx.fillRect(textX, textY, textWidth, fontSize);
        this.ctx.fillText(text, textX, textY, 0);
        //this.ctx.renderText(this.text, textX+letterSpacing/2, textY, letterSpacing);
    }

    streamToLocalFS(stream, key, resolve, reject) {
        log.info('rendering to local filesystem!');
        let out = fs.createWriteStream(__dirname + 'renders/' + key);
        stream.on('data', function(chunk){
            out.write(chunk);
        });

        stream.on('end', () => {
            log.info('saved png');
            resolve();
        });
    }

    streamToAmazonS3(stream, key, resolve, reject) {
        log.info('streaming to amazon s3!');
        let keys = ['textColor', 'mapCreds', 'zScreen', 'vectorStyle', 'vectorScaleScale', 'uid', 'backgroundColor', 'activities', 'paperSize', 'imageLocation', 'text'];
        let metadata = {};
        keys.forEach(key => metadata[key] = JSON.stringify(this[key]));
        streamToS3(stream, key, metadata).then((details) => {
            let elapsed = Math.round((Date.now() - this.startTime) / 100)/10;
            let url = details.Location;
            slack(`:frame_with_picture: new *${this.paperSize}* _"${this.text}"_ generated in *${elapsed}s*!\n${url}`);
            this.pointFirebaseToS3(url, elapsed);
            resolve(url);
        }).catch(reject)
    }

    pointFirebaseToS3(location, time) {
        if (this.imageLocation) {
            let completedImageRef = rootRef.child(this.imageLocation);
            completedImageRef.set({
                url: location,
                generationTime: time
            })
        } else {
            log.info('no complete firebase location provided');
        }
    }

    fetchMapboxImages() {
        return new Promise((resolve, reject) => {
            // Render count starts off at 0
            this.renderCount = 0;

            // Calculate the tile x and y ranges for the current bounding box
            let tileBounds = this.xyzBounds;
            // Count the tiles
            let count = (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1);
            let ic = 0;
            let promises = [];
            log.info('fetching ' + count);
            for (let x=tileBounds.minX; x <= tileBounds.maxX;x++){
                for (let y=tileBounds.minY; y <= tileBounds.maxY;y++){
                    let relX = x - tileBounds.minX;
                    let relY = y - tileBounds.minY;
                    //if (debug) log.info(`fetching ${x}, ${y}`);

                    //let tile = new ImageFetcher(x, y, z, relX, relY, ic, count);
                    // Return a promise for all operations on this tile
                    let tilePromise = new Promise((resolveTile, reject) => {
                        // Fetchimage returns a promise that resolves when the image comes back
                        this.fetchImage(x, y, this.tileZ).then((tileBuffer) => {
                            // Target pixels
                            let pX = relX * Math.floor(TILE_SIZE * this.tileScaleFactor);
                            let pY = relY * Math.floor(TILE_SIZE * this.tileScaleFactor);

                            // Log
                            this.renderCount++;
                            log.info(`tile [${this.renderCount}/${count}] ... drawing ${relX}, ${relY} @ ${pX} [+ ${this.offset[0]}], ${pY} [+${this.offset[1]}]`);

                            // Adjust by corner offset and render
                            this.renderTile(tileBuffer, pX - this.offset[0], pY - this.offset[1]);

                            // Done with all tile operations
                            resolveTile();
                        }).catch((err) => {
                            log.error('error fetching tile', err); dumpError(err); reject(err);
                        });

                    });
                    promises.push(tilePromise);
                }
            }
            Promise.all(promises)
                .then(() => {
                    // Draw map canvas to print canvas
                    this.drawMapCanvasToPrintCanvas()
                    resolve();
                }).catch((err) => {reject(err)})
        });

    }

    fetchImage(x, y, z) {
        return new Promise((resolve, reject) => {
            // Build the URL
            let url = `https://api.mapbox.com/v4/${this.mapCreds.mapId}/${z}/${x}/${y}.png?access_token=${this.mapCreds.accessToken}`;
            //if (debug) log.info(url);

            // Make the request
            // rate-limited
            limiter.removeTokens(1, () => {
                request.get(url)
                    .retry(5)
                    .timeout(10000)
                    .end((err, res) => {
                        if (err) {
                            dumpError(err);
                            reject(err);
                        } else {
                            resolve(res.body)
                        }
                    });
            });
        })
    }

    renderTile(tileBuffer, x, y) {
        // Create a new image
        let img = new Image;
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

    drawMapCanvasToPrintCanvas() {
        let img = this.mapCanvas.toBuffer();
        this.ctx.drawImage(this.mapCanvas, this.locations.mapUpperLeft.x, this.locations.mapUpperLeft.y, this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);
    }

    renderActivities() {
        return new Promise((resolve, reject) => {
            // Mapnik defaults
            mapnik.register_default_fonts();
            mapnik.register_default_input_plugins();

            // Create the output image
            this.im = new mapnik.Image(this.pixelsPrint.mapWidth, this.pixelsPrint.mapHeight);

            // Create a mapnik pool
            this.pool = new mapnikPool.fromString('<Map></Map>', {size: {width: this.pixelsPrint.mapWidth, height: this.pixelsPrint.mapHeight}});

            //// Render the activites
            let promises = [];
            this.activities.forEach((activityId) => {
                promises.push(this.renderActivity(activityId));
            });
            //for (let i=1; i<=14; i++) {
            //    let geojson = require(`../data/geojson/${i}.json`);
            //    log.info('rendering geojson ' + i);
            //    promises.push(this.renderGeoJSONVector(geojson));
            //}

            Promise.all(promises)
                .then(() => {
                    resolve();
                }).catch((err) => {reject(err)});

        });
    }

    renderActivity(activityId) {
        return new Promise((resolve, reject) => {
            log.info(`--- rendering activity ${activityId}`);
            activityStreamRef(activityId).once('value', (snap) => {
                let activity = snap.val();
                if (activity) {
                    log.info(`--- fetched data for activity ${activityId}`);
                    //log.info(activity.geojson);
                    this.renderGeoJSONVector(activity.geojson, activityId)
                        .then(() => {
                            resolve();
                        })
                        .catch(reject)
                } else {
                    reject(`no geojson found for activity ${activityId}`);
                }
            })
        });
    }

    renderGeoJSONVector(geojson, activityId) {
        return new Promise((resolve, reject) => {
            let strokeWidth = this.vectorStyle.strokeWidth;
            if (this.vectorScaleScale) {
                strokeWidth = strokeWidth * this.vectorScaleFactor * this.vectorScaleScale;
            }
            // Update the loaded geojson with styles
            //log.info(geojson.features[0])
            geojson.features[0].properties = {
                stroke: this.vectorStyle.stroke,
                'stroke-width': strokeWidth,
                'stroke-opacity': this.vectorStyle.opacity,
                'smooth': 1,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
            };

            //log.info(geojson.features[0]);

            // Ensure context opacity is at 1
            this.ctx.globalAlpha = 1;


            // Convert to mapnik xml format
            let xml = mapnikify(geojson, false, (err, xml) => {
                //log.info(xml);
                this.pool.acquire((err, map) => {
                    if (err) dumpError(err);
                    map.fromString(xml, {}, (err, map) => {
                        //map.zoomAll();

                        // Convert to the bbox desired
                        let bounds = sm.convert(this.bbox, '900913');

                        // Zoom the map to this bbox
                        map.zoomToBox(bounds);

                        // Render this map to an image buffer
                        map.render(this.im, (err, im) => {
                            if (err) {reject(err); return}
                            log.info(`--- done rendering activity ${activityId}`)
                            // Release this map so other threads can draw on it
                            this.pool.release(map);
                            // We're done here.
                            resolve();
                        })
                    });

                })
            });
        });
    }

    cleanup() {
        log.info(util.inspect(process.memoryUsage()));
        log.info('cleaning up...')
        this.pool.destroy();
        log.info(util.inspect(process.memoryUsage()));
    }
}



// light
let themes = {
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
        textColor: '#202020'
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
        textColor: '#202020'
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
let vectorScaleScale = 0.65;

const generatePrint = (data) => {
    return new Promise((resolve, reject) => {
        log.info('generating print...');
        log.info(data);
        if (!data.pixelsScreen || !data.paperSize || !data.zScreen || !data.bboxScreen || !data.theme || !data.activities || !data.uid || !data.imageLocation) {
            log.error('parameter missing', data);
            reject('malformed queue item');
        } else {
            let map = new StravaMap(data.pixelsScreen, data.zScreen, data.bboxScreen, data.paperSize, themes[data.theme], vectorScaleScale, data.uid, data.activities, data.imageLocation, data.text);
            map.complete.then((url) => {
                log.info('done!');
                resolve(url);
            })
            .catch((err) => {
                log.error('image generation request failed');
                dumpError(err);
                reject(err);
            })
        }
    });
};

let queue = new Queue(imageGenerationQueueRef, (data, progress, resolve, reject) => {
    log.info('imageGeneration queue running for user: ', data.uid);
    generatePrint(data)
        .then(resolve)
        .catch(reject)
});

log.info('imageGeneration queue up and running');

export default generatePrint;
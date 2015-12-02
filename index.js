import Canvas, {Image} from 'canvas';
import fs from 'fs';
import request from 'superagent';
import geoViewport from 'geo-viewport';
//import latLngToTileXY from './tileUtils';
import SM from 'sphericalmercator';
import mapnik from 'mapnik';
import toGeoJSON from 'togeojson';
import mapnikify from 'geojson-mapnikify';
import _ from 'lodash';
import {getDims, screenSizes} from './sizes';

let sm = new SM({size: 256});

// Knobs to turn
let debug = false;                     // turns on tile box renderings
let basemapOpacity = 1;               // fade the basemap

let vectorStyle = {
    opacity: 0.15,
    stroke: '#000000',
    strokeWidth: 1
};



// Constants
// should this change per image size?
let BORDER = 50;
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWF0dGhld2t1bHAiLCJhIjoiY2loNzVzYXpiMGhubnVla3R2NGNvcG1mZSJ9.F_fiMIojh6Dg5kA_-RERMw';
// Maximum static map size, from mapbox
let TILE_SIZE = 256;

class StravaMap {

    constructor(pixelsScreen, zScreen, bboxScreen, paperSize, mapid) {
        this.mapid = mapid;
        this.zScreen = zScreen;

        // Our bounding box is (and always will be) the geographic bounding box from the screen
        this.bbox = bboxScreen;

        // Get the pixel dimensions to print at this paper size
        this.pixelsPrint = getDims(paperSize);

        // How much bigger is the paper than the screen?
        let widthScaleFactor = this.pixelsPrint.w / pixelsScreen.w;

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
            console.log('.....pixelsScreen.....\n', pixelsScreen);
            console.log('.....pixelsPrint.....\n', this.pixelsPrint);
            console.log('.....widthScaleFactor.....\n', widthScaleFactor);
            console.log('.....zSteps (additional zoom).....\n', zSteps);
            console.log('.....tileZ (request tiles at this zoom).....\n', this.tileZ);
            console.log('.....fractionalResidualScale (correct tiles for this).....\n', fractionalResidualScale);
            console.log('.....tileScaleFactor.....\n', this.tileScaleFactor);
            console.log('.....vectorScaleFactor.....\n', this.vectorScaleFactor);
        }

        // Init the canvas
        this.initCanvas();

        // Initialize geo extents
        this.initGeo();


        // Fetch ze images!
        this.fetchMapboxImages().then(() => {
            console.info('done fetching images!');
            this.renderVectors().then(() => {
                console.info('done drawing vectors!');
                console.info('rendering to file!');
                this.renderToFile();
            }).catch((err) => {console.error(err)});
        })
        .catch((err) => {console.error(err)});

    }

    initGeo() {
        // First, get the bounds of the viewport, using:
        //   * the pixel dimensions of the mask
        //   * the geographic center
        //   * the zoom level
        // W-S-E-N
        //let bbox = geoViewport.bounds(center, z, [this.pixelsPrint.w, this.pixelsPrint.h]);
        //this.bbox = bbox;

        // Next, find the tile extent that covers bbox
        this.xyzBounds = sm.xyz(this.bbox, this.tileZ);

        // Find the geographic bbox of the lower-left corner tile
        let tileBbox = sm.bbox(this.xyzBounds.minX, this.xyzBounds.minY, this.tileZ);

        // Get corner pixel position for each bounding box
        let bboxPx = sm.px([this.bbox[0], this.bbox[3]], this.tileZ);
        let tilePx = sm.px([tileBbox[0], tileBbox[3]], this.tileZ);

        // Get the vector from the corner of the tile bbox to the corner of the view bbox
        this.offset = [
            (bboxPx[0] - tilePx[0]) * this.tileScaleFactor,
            (bboxPx[1] - tilePx[1]) *this.tileScaleFactor
        ];

        //this.offset = [0, 0]

        if (debug) {
            console.log('.....bbox.....\n', this.bbox);
            console.log('.....xyzBounds.....\n', this.xyzBounds);
            console.log('.....tileBbox.....\n', tileBbox);
            console.log('.....pixels.....\n', bboxPx, tilePx);
            console.log('.....offset.....\n', this.offset);
        }
    }

    initCanvas() {
        this.canvas = new Canvas(this.pixelsPrint.w, this.pixelsPrint.h);
        this.ctx = this.canvas.getContext('2d');
    }

    drawBackground(color) {
        this.ctx.rect(0, 0, this.pixelsPrint.w, this.pixelsPrint.h);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    renderToFile() {
        // Render out to a png
        let out = fs.createWriteStream(__dirname + '/test.png');
        let stream = this.canvas.pngStream();

        stream.on('data', function(chunk){
            out.write(chunk);
        });

        stream.on('end', function(){
            console.log('saved png');
        });
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
            console.info('fetching ' + count);
            for (let x=tileBounds.minX; x <= tileBounds.maxX;x++){
                for (let y=tileBounds.minY; y <= tileBounds.maxY;y++){
                    let relX = x - tileBounds.minX;
                    let relY = y - tileBounds.minY;
                    //if (debug) console.info(`fetching ${x}, ${y}`);

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
                            console.log(`tile [${this.renderCount}/${count}] ... drawing ${relX}, ${relY} @ ${pX} [+ ${this.offset[0]}], ${pY} [+${this.offset[1]}]`);

                            // Adjust by corner offset and render
                            this.renderTile(tileBuffer, pX - this.offset[0], pY - this.offset[1]);

                            // Done with all tile operations
                            resolveTile();
                        }).catch((err) => {
                            console.error('error fetching tile', err); throw new Error(err); reject(err)
                        });

                    });
                    promises.push(tilePromise);
                }
            }
            Promise.all(promises)
                .then(() => {
                    resolve();
                }).catch((err) => {reject(err)})
        });

    }

    fetchImage(x, y, z) {
        return new Promise((resolve, reject) => {
            // Build the URL
            let url = `https://api.mapbox.com/v4/${this.mapid}/${z}/${x}/${y}.png?access_token=${MAPBOX_ACCESS_TOKEN}`;
            //if (debug) console.info(url);

            // Make the request
            request.get(url)
                .end((err, res) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(res.body)
                    }

                });
        })
    }

    renderTile(tileBuffer, x, y) {
        console.info(x, y);
        // Create a new image
        let img = new Image;
        img.src = tileBuffer;
        // Fade the basemap, if needed
        this.ctx.globalAlpha = basemapOpacity;
        // Draw
        this.ctx.drawImage(img, Math.floor(x), Math.floor(y), Math.floor(TILE_SIZE * this.tileScaleFactor), Math.floor(TILE_SIZE * this.tileScaleFactor));
        // Reset opacity
        this.ctx.globalAlpha = 1;
        // If debugging, stroke tile
        if (debug) {
            this.ctx.rect(x, y, TILE_SIZE * this.tileScaleFactor, TILE_SIZE * this.tileScaleFactor);
            this.ctx.strokeStyle = 'rgba(255,0,0,0.7)';
            this.ctx.stroke();
        }
    }

    renderVectors() {
        return new Promise((resolve, reject) => {
            // Mapnik defaults
            mapnik.register_default_fonts();
            mapnik.register_default_input_plugins();

            // Create a new mapnik map
            let map = new mapnik.Map(this.pixelsPrint.w, this.pixelsPrint.h);

            // Load the geojson
            let geojson = require('./data/1.json');

            // Update the loaded geojson with styles
            _.assign(geojson.features[0].properties, {
                stroke: vectorStyle.stroke,
                'stroke-width': vectorStyle.strokeWidth * this.vectorScaleFactor,
                'stroke-opacity': vectorStyle.opacity
            });

            // Ensure context opacity is at 1
            this.ctx.globalAlpha = 1;


            // Convert to mapnik xml format
            let xml = mapnikify(geojson, false, (err, xml) => {
                //console.log(xml);
                map.fromString(xml, {}, (err, map) => {
                    //map.zoomAll();

                    // Convert to the bbox desired
                    let bounds = sm.convert(this.bbox, '900913');

                    // Zoom the map to this bbox
                    map.zoomToBox(bounds);

                    // Create the output image
                    let im = new mapnik.Image(this.pixelsPrint.w, this.pixelsPrint.h);

                    // Render this map to an image buffer
                    map.render(im, (err, im) => {
                        if (err) {reject(err); return}
                        // Encode as a png
                        im.encode('png', (err, buffer) => {
                            console.info('vector buffer', buffer);
                            if (err) {reject(err); return}
                            let img = new Image;
                            img.src = buffer;
                            this.ctx.drawImage(img, 0, 0);
                            resolve();
                        })
                    })
                });
            });

        });
    }
}

// For testing - this will eventually come from the frontend
let paperSize = 'a1';
let pixelsScreen = screenSizes.a4; // change this so it doesn't match the paper size
let zScreen = 13;
let bboxScreen = [-122.34649658203124,37.780483978703025,-122.24349975585938,37.89544674639969]; // this is for A4

let map = new StravaMap(pixelsScreen, zScreen, bboxScreen, paperSize, 'matthewkulp.789e1a95');
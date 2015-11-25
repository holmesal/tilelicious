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
import {getDims} from './sizes';

let sm = new SM({size: 256});

// Knobs to turn
let debug = false;                     // turns on tile box renderings
let basemapOpacity = 1;               // fade the basemap
let vectorScaleFactor = 4;



// Constants
// should this change per image size?
let BORDER = 50;
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWF0dGhld2t1bHAiLCJhIjoiY2loNzVzYXpiMGhubnVla3R2NGNvcG1mZSJ9.F_fiMIojh6Dg5kA_-RERMw';
// Maximum static map size, from mapbox
let TILE_SIZE = 256;


// TODO - make these inputs
let size = 'a4';
//let size = 'debug';
let z = 15;
let center = [-122.2708, 37.8044]; // lon, lat


class StravaMap {

    constructor(center, z, size, mapid) {
        this.center = center;
        this.z = z;
        this.size = size;
        this.mapid = mapid;

        // Get the dims for this paper size
        this.dims = getDims(size);
        
        // Init the canvas
        this.initCanvas();

        // Initialize geo extents
        this.initGeo(center, z, this.dims);


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

    initGeo(center, z, dims) {
        // First, get the bounds of the viewport, using:
        //   * the pixel dimensions of the mask
        //   * the geographic center
        //   * the zoom level
        // W-S-E-N
        let bbox = geoViewport.bounds(center, z, [this.dims.w, this.dims.h]);
        this.bbox = bbox;

        // Next, find the tile extent that covers bbox
        this.xyzBounds = sm.xyz(bbox, z);

        // Find the geographic bbox of the above tiles
        let tileBbox = sm.bbox(this.xyzBounds.minX, this.xyzBounds.minY, z);

        // Get pixel position for each bounding box
        let bboxPx = sm.px([bbox[0], bbox[3]], z);
        let tilePx = sm.px([tileBbox[0], tileBbox[3]], z);

        // Get the vector from the corner of the tile bbox to the corner of the view bbox
        this.offset = [
            bboxPx[0] - tilePx[0],
            bboxPx[1] - tilePx[1]
        ];

        if (debug) {
            console.log('.....bbox.....\n', bbox);
            console.log('.....xyzBounds.....\n', this.xyzBounds);
            console.log('.....tileBbox.....\n', tileBbox);
            console.log('.....pixels.....\n', bboxPx, tilePx);
            console.log('.....offset.....\n', this.offset);
        }
    }

    initCanvas() {
        this.canvas = new Canvas(this.dims.w, this.dims.h);
        this.ctx = this.canvas.getContext('2d');
    }

    drawBackground(color) {
        this.ctx.rect(0, 0, this.dims.w, this.dims.h);
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
                        this.fetchImage(x, y, z).then((tileBuffer) => {
                            // Target pixels
                            let pX = relX * TILE_SIZE;
                            let pY = relY * TILE_SIZE;

                            // Log
                            this.renderCount++;
                            console.log(`tile [${this.renderCount}/${count}] ... drawing ${relX}, ${relY} @ ${pX} [+ ${this.offset[0]}], ${pY} [+${this.offset[1]}]`);

                            // Adjust by corner offset and render
                            this.renderTile(tileBuffer, pX - this.offset[0], pY - this.offset[1]);

                            // Done with all tile operations
                            resolveTile();
                        }).catch((err) => {console.error(err); throw new Error(err)});

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
        this.ctx.drawImage(img, x, y);
        // Reset opacity
        this.ctx.globalAlpha = 1;
        // If debugging, stroke tile
        if (debug) {
            this.ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
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
            let map = new mapnik.Map(this.dims.w, this.dims.h);

            // Load the geojson
            let geojson = require('./data/1.json');

            // Update the loaded geojson with styles
            _.assign(geojson.features[0].properties, {
                stroke: '#000000',
                'stroke-width': 1 * vectorScaleFactor,
                'stroke-opacity': 0.15
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
                    let im = new mapnik.Image(this.dims.w, this.dims.h);

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

let map = new StravaMap(center, z, size, 'matthewkulp.789e1a95');
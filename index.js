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
let debug = true;                     // turns on tile box renderings
let basemapOpacity = 0.1;



// Constants
// should this change per image size?
let BORDER = 50;
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ';
// Maximum static map size, from mapbox
let TILE_SIZE = 256;


// TODO - make these inputs
//let size = 'a4';
let size = 'debug';
let z = 12; //15;
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
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
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
                stroke: '#FFFFFF',
                'stroke-width': 1,
                'stroke-opacity': 0.5
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

let tileThings = () => {
    ctx.globalAlpha = basemapOpacity;
    let tileBounds = sm.xyz(bbox, z);
    console.log(tileBounds);
    let count = (tileBounds.maxX - tileBounds.minX + 1) * (tileBounds.maxY - tileBounds.minY + 1);
    let ic = 0;
    let promises = [];
    for (let x=tileBounds.minX; x <= tileBounds.maxX;x++){
        for (let y=tileBounds.minY; y <= tileBounds.maxY;y++){
            let relX = x - tileBounds.minX;
            let relY = y - tileBounds.minY;
            //console.log(`tile [${ic}/${count}]`);
            let tile = new ImageFetcher(x, y, z, relX, relY, ic, count);
            let tilePromise = tile.fetchImage();
            promises.push(tilePromise);
        }
    }
    Promise.all(promises)
        .then(() => {
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

let vectorThings = () => {

    // https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0
    _.assign(geojson.features[0].properties, {
        stroke: '#FFFFFF',
        'stroke-width': 1,
        'stroke-opacity': 0.5
    });



    //let l = new mapnik.Layer('rides');
    //l.datasource = new mapnik.Datasource({type:'geojson',file:'data/1.json'});
    //map.add_layer(l);



};


let map = new StravaMap(center, z, size, 'mapbox.streets');
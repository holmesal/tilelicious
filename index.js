import Canvas, {Image} from 'canvas';
import fs from 'fs';
import request from 'superagent';
import geoViewport from 'geo-viewport';
//import latLngToTileXY from './tileUtils';
import SM from 'sphericalmercator';

let sm = new SM({size: 256});

let dims = {
    w: 3508,
    h: 2480
};

let BORDER = 50;

let z = 15;

// Maximum static map size, from mapbox
let MAX_SIZE = {
    w: 256,
    h: 256
};

//// Example
let focus = {
    center: [-122.2708, 37.8044],
    zoom: z
};
let bbox = geoViewport.bounds(focus.center, z, [dims.w, dims.h]);
let debug = false;
let basemapOpacity = 0.2;

// W-S-E-N
//let bbox = [
//    -122.347269,
//    37.77621,
//    -122.217321,
//    37.837513
//];

let canvas = new Canvas(dims.w, dims.h);

let ctx = canvas.getContext('2d');

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
let bg = (color) => {
    ctx.rect(0, 0, dims.w, dims.h);
    ctx.fillStyle = color;
    ctx.fill();
};

// Render the mapbox tiles
let render = () => {
    // Render out to a png
    let out = fs.createWriteStream(__dirname + '/test.png');
    let stream = canvas.pngStream();

    stream.on('data', function(chunk){
        out.write(chunk);
    });

    stream.on('end', function(){
        console.log('saved png');
    });
};

let fetchMapboxImages = () => {
    console.log('bbox', bbox);
    // How many images should we fetch from mapbox?
    let numCols = Math.ceil(dims.w / MAX_SIZE.w);
    let numRows = Math.ceil(dims.h / MAX_SIZE.h);
    // How much lat/lng should each image be responsible for?
    let intervals = {
        lon: (bbox[2] - bbox[0]) / numCols,
        lat: (bbox[3] - bbox[1]) / numRows,
        pixelsX: dims.w / numCols,
        pixelsY: dims.h / numRows
    };
    // Request one image for each range
    console.log(`fetching ${numCols} x ${numRows} images`)
    for (let x = 0; x < numCols; x++) {
        for (let y = 0; y < numRows; y++) {
             //W-S-E-N
            let edges = [
                bbox[0] + intervals.lon * x, //minlon
                bbox[1] + intervals.lat * y,
                bbox[0] + intervals.lon * (x + 1),
                bbox[1] + intervals.lat * (y + 1)
            ];
            let z = 14;
            let xyzBounds = sm.xyz(edges, z);
            console.log(xyzBounds);
            // Pixel bounds
            let pixels = [
                Math.round(intervals.pixelsX * x),
                Math.round(intervals.pixelsY * y),
                Math.round(intervals.pixelsX * (x + 1)),
                Math.round(intervals.pixelsY * (y + 1))
            ];
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
            let mapboxTile = new ImageFetcher(xyzBounds.minX, xyzBounds.minY, z);
            break;
        }
        break;
    }
};

let tileThings = () => {
    let tileBounds = sm.xyz(bbox, z);
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
        });
};

let renderCount = 0;


class ImageFetcher {

    constructor(x, y, z, relX, relY, ic, count) {
        this.count = count;
        this.relX = relX;
        this.relY = relY;
        //console.info('rendering tile at ' + pos)
        //console.info(viewport)
        //this.dims = dims;
        //let pos = [0,0];
        //let url = `https://api.mapbox.com/v4/mapbox.streets/${viewport.center[0]},${viewport.center[1]},${viewport.zoom}/${size[0]}x${size[1]}.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ`;
        this.url = `https://api.mapbox.com/v4/mapbox.streets/${z}/${x}/${y}.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ`;
        //console.log(url);
        //this.fetchImage(url, relX, relY);
    }

    fetchImage() {
        return new Promise((resolve, reject) => {
            request.get(this.url)
                .end((err, res) => {
                    if (err) {
                        console.error(err);
                    }
                    let size = 256;
                    renderCount++;
                    let pX = this.relX * size;
                    let pY = this.relY * size;
                    console.log(`tile [${renderCount}/${this.count}] ... drawing ${this.relX}, ${this.relY} @ ${pX}, ${pY}`);
                    let img = new Image;
                    img.src = res.body;
                    ctx.drawImage(img, pX, pY);

                    if (debug) {
                        ctx.rect(pX, pY, size, size);
                        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                        ctx.stroke();
                    }
                    resolve()
                    //ctx.drawImage(img, 0, 0, 100, 100);
                //    //img = new Image;
                //    img.src = canvas.toBuffer();
                //    ctx.drawImage(img, 100, 100, 50, 50);
                //    ctx.drawImage(img, 200, 100, 50, 50);
                });
        })
    }

}



ctx.globalAlpha = basemapOpacity;
bg('#202020');
tileThings();
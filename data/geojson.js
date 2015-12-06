import toGeoJSON from 'togeojson'
import fs from 'fs'
import {jsdom} from 'jsdom'

let dir = './data/gpx/';
let geojsonDir = './data/geojson/';
let count = 0;

let geojsons = [];

// For every file in the gpx directory
console.info('looking for gpx files');
fs.readdir(dir, (err, files) => {
    if (err) {
        console.log(err)
    } else {
        console.info(`found ${files.length} files`);
        files.forEach((filename) => {
            importFile(filename);
        })
    }
});

const importFile = (filename) => {
    let path = dir + filename;
    let gpx = jsdom(fs.readFileSync(path, 'utf8'));
    console.info('-> ' + filename);
    parseGpx(gpx);
};

const parseGpx = (gpx) => {
    let geoJSON = toGeoJSON.gpx(gpx);
    writeGeoJSON(geoJSON);
};

const writeGeoJSON = (geojson) => {
    count++;
    let path = `${geojsonDir}${count}.json`;
    console.info('<- ' + path);
    fs.writeFileSync(path, JSON.stringify(geojson));
};
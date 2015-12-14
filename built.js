'use strict';

require("babel-core/register");

// Queues and noms
require('./queues/ImageGenerationQueue');
require('./nom_nom/ActivityNomNom');
require('./nom_nom/StreamNomNom');
require('./queues/tokenExchange');

// Uncomment to import from './gpx'
//require('./data/geojson');

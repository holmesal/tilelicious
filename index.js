require('newrelic');
process.env.PWD = process.cwd();
require('dotenv').load();

require('./dist/queues/ImageGenerationQueue');
require('./dist/queues/tokenExchange');
require('./dist/queues/orderQueue');
require('./dist/nom_nom/ActivityNomNom');
require('./dist/nom_nom/StreamNomNom');
require('./dist/server');

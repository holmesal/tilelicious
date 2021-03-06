require('newrelic');
process.env.PWD = process.cwd();
require('dotenv').load();

if (process.env.WORKER) {
	require('./dist/queues/ImageGenerationQueue');
	require('./dist/queues/tokenExchange');
	require('./dist/queues/orderQueue');
	require('./dist/queues/serviceRequest');
	require('./dist/nom_nom/ActivityNomNom');
	require('./dist/nom_nom/StreamNomNom');
}

require('./dist/server');

process.env.PWD = process.cwd();

require('./dist/queues/ImageGenerationQueue');
require('./dist/queues/tokenExchange');
require('./dist/nom_nom/ActivityNomNom');
require('./dist/nom_nom/StreamNomNom');

process.env.PWD = process.cwd();
console.info(process.env.PWD);

require('./dist/queues/ImageGenerationQueue');
require('./dist/queues/tokenExchange');
require('./dist/nom_nom/ActivityNomNom');
require('./dist/nom_nom/StreamNomNom');
require('./dist/server');

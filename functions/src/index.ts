import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

function checkQueueDepth(event) {
  // Grab the current value of what was written to the Realtime Database.
  // const original = event.data.val();
  // console.log('new task was created: ' + event.params.taskId);

  // get the parent (task list) data
  return event.data.adminRef.parent.once('value').then(function(snapshot) {
  	const counts = {
  		waiting: 0,
  		error: 0,
  		inProgress: 0
  	};
  	snapshot.forEach(function(childSnap) {
  		const task = childSnap.val();
  		// Update the state counts:
  		if (task._state === 'error') counts.error++;
  		else if (task._state === 'in_progress') counts.inProgress++;
  		else if (!task._state) counts.waiting++;
  		else {
  			console.log('Found unknown state: ' + task._state);
  		}
  	});
	console.info('queue stats: ', counts);
	// Update at the root
	return event.data.adminRef.root.child('/queueStats').set(counts);
	});
};

exports.checkQueueDepth = functions.database.ref('/queues/imageGeneration/tasks/{taskId}').onCreate(checkQueueDepth);
exports.checkQueueDepthOnDelete = functions.database.ref('/queues/imageGeneration/tasks/{taskId}').onDelete(checkQueueDepth);
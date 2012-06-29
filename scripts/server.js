//
//	      	Nodester 
//	 Open Source node.js PaaS
//
// GNU Affero General Public License 
//


var fs = require('fs')
  , path = require('path')
  , existsSync = fs.existsSync || path.existsSync
  , coffee = "{{COFFEE}}"
  ;

var iniFile = "{{FILE}}"

console.log('')
console.log(' [*] ', new Date(),' - Spawing',iniFile);
console.log(' [*] ', 'Running node-'+ process.version);
console.log(' [*] ', 'Server now listening on internal port', process.env['app_port'] || 80);
console.log(' [*] ', 'Public Address:', "{{ADDRESS}}")

var pidRunner = path.join(__dirname,'app.pid')
try {
	fs.writeFileSync(pidRunner, process.pid, 'utf8');
	console.log(' [*] ',' Process pid: ', process.pid );
} catch (excp) {
	console.log(' [*] ', 'Opps... Couldn\'t write my pid to fs (' + process.pid + ')');
}

try {
	if (coffee != 'false') {
		require('coffee-script')
	} 
	require(__dirname + '/app/'+ iniFile);
} catch (excp) {
	console.error(' [*] ', new Date(), ' -', iniFile, ' don\'t exists' );
	console.warn(' [*] ', 'Dieing...');
	return process.kill(process.pid,'SIGINT');
}
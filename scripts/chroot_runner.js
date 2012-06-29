#!/usr/bin/env node
/*jshint node:true, noempty:true, laxcomma:true, laxbreak:false */
"use strict";

// Run as sudoer

// node libraries
var fs    = require('fs')
  , path  = require('path')
  , net   = require('net')
  , cp    = require('child_process')
  , spawn = cp.spawn
  , exec  = cp.exec
  ;

// Paths
var configPath = path.join('.nodester','config.json')
  , home = process.env.PWD;


// Misc
var node_versions = require('../lib/lib').node_versions()
  , config = JSON.parse(fs.readFileSync(configPath))
  , cfg = require('../config').opt
  , oldmask, newmask = '0000'
  ;

oldmask = process.umask(newmask);

console.log('Changed umask from: ' + oldmask.toString(8) + ' to ' + newmask.toString(8));

var run_max = 5;
var run_count = 0;
var LOG_STDOUT = 1;
var LOG_STDERR = 2;

// Enviromentals variables
var env = {
  HOME: __dirname,
  PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
  NODE_ENV: 'production'
};

if (config.env) {
  Object.keys(config.env).forEach(function (key) {
    env[key] = String(config.env[key]);
  });
}

env.PORT = env.app_port = parseInt(config.port, 10);
env.app_host = config.ip;


return !function () {
  var upstartScript = fs.readFileSync('./default_upstart.conf','utf8')
    , serverScript = fs.readFileSync('./server.js','utf8')
    , pack = fs.readFileSync(home + '/package.json')
    , coffee = false;

  if (path.extname(config.start) == '.coffee' ) {
    coffee = true;
  }

  serverScript = serverScript.replace(/\{\{FILE\}\}/, config.start)
                             .replace(/\{\{ADDRESS\}\}/, config.name)
                             .replace(/\{\{COFFEE\}\}/, coffee);

  function plainObj (obj) {
    var str = ' ';
    for (var key in obj) {
      str += key + '='+ obj[key] + ' ';
    }
    return str;
  }

  var version = pack.node || process.version;
  // n dir only handles number paths without v0.x.x  => 0.x.x
  version = version.replace('v', '').trim();
  // Insert node-watcher code and link the dependency
  if (node_versions.indexOf(version) !== -1) {
    exec('which n', function (err, std){
      if (!err) {
        console.warn('n is not instaleld');
      } else {
        var nodeVersion ='/usr/local/n/versions/' + version + '/bin/node';
        // export HOME="{{HOME}}"
        // exec {{ENV}} {{VERSION}} {{PATH}}/server.js >> {{PATH}}/logs/app.log
        // Yeah on every start because user can switch versions and stuff
        upstartScript = upstartScript.replace(/\{\{FILE\}\}/, plainObj(env))
                                     .replace(/\{\{HOME\}\}/, home)
                                     .replace(/\{\{VERSION\}\}/, nodeVersion)
                                     .replace(/\{\{PATH\}\}/g, home);

        fs.writeFileSync(home + '/server.js', serverScript, 'utf8');
        fs.writeFileSync('/etc/init/'+ config.name + '.conf', upstartScript);

        var commands = [
          "cd " + home,
          std + " npm " + version + " install",
          coffee ? std + ' npm ' + version + ' install coffee-script': 'echo hi',
          "sudo stop " + config.name,
          "sudo start " + config.name
        ].join(' && ');

        exec(commands, function (error, stdout) {
            if (error) {
              return console.warn(error);
            } else {
              return console.log(stdout);
            }
        });
      }
    });
  } else {
    console.warn(' The version of node.js is not available');
  }
}();
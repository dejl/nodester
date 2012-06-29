/*jshint node:true, noempty:true, laxcomma:true, laxbreak:false */
"use strict";

// Globals vars from app.js (just for lint this file)

var path = {}, fs={}, getDatabase, cfg = {}, log = {},existsSync = {}, exec;

function app_start (repo_id, callback) {
  /*
    User or Api trigger `start`
     -> Check if the repo exists (no?  cb(err))
     -> If repo exists get the info about the repo
     -> populate configData
     -> Check for path, ok here even in the light version we need to keep logs and pid files
     // NEW ARCHITECTURE
        user
          |- app_id1
              |- node_modules
              |- .nodester
              |- logs
                |- log.sock
              |- app 
                |- git clone app_repo_id
              |- star_file.js # require('./app/start_file.js')
              |- package.json
              |- upstart.conf # to cp then
              |- app.pid
          |- app_id2
  */
  var db = getDatabase('repos');

  db.get(repo_id, function (err, doc) {
    if (err) {
      callback(false, err);
    } else {
      var user_home = path.join(cfg.apps_home_dir, doc.username)
        , app_home = user_home + '/' + repo_id
        , apps = getDatabase('apps');

      apps.get(doc.appname, function (err1, app) {
        if (err1) {
          return callback(false, err1);
        } else {
          /*
            Default data for the app
            in light version this should be deleted (_rw, _chroot)
            i'm gonna let them here just to keep the default process
            as it is.
          */
          var configData = {
            appdir      : cfg.app_dir,
            userid      : cfg.app_uid,
            chroot_base : cfg.node_base_folder,
            apphome     : app_home,
            apprwfolder : path.join(app_home, '..', repo_id + '_rw'),
            appchroot   : path.join(app_home, '..', repo_id + '_chroot'),
            start       : app.start,
            port        : app.port,
            ip          : '127.0.0.1',
            name        : doc.appname,
            env         : app.env || {}
          };

          log.info('Checking: %s', configData.apphome);
          if (!path.existsSync(configData.apphome)) {
            //Bad install??
            log.warn('App directory does not exist: %s', configData.apphome);
            callback(false, err);
            return;
          }

          log.info('Checking: %s', path.join(configData.apphome, 'app', app.start));

          if (!path.existsSync(path.join(configData.apphome,'app', app.start))) {
            //Bad install??
            log.warn('App start file does not exist: %s', path.join(configData.apphome, app.start));
            return callback(false, err);
          }

          log.info('Checking: %s', path.join(configData.apphome, '.nodester'));

          if (!path.existsSync(path.join(configData.apphome, '.nodester'))) {
            log.info('Making Directories..');
            ['logs','.nodester','node_modules'].forEach(function (dir) {
              var target = path.join(configData.apphome,dir);
              if (!existsSync(target)) fs.mkdirSync(target,'0777');
            });
          }
          var packPath = path.join(configData.apphome,'app','package.json');
          var pack = {};

          if (!existsSync(packPath)) {
            pack = {
              node: process.version,
              name: doc.appname,
              version:'0.0.1'
            };
          } else {
            try {
              pack = require(packPath);
            }  catch (ex){
              pack = JSON.parse(fs.readFileSync(packPath,'utf8'));
            }
          }

          // Write package.json to root dir
          fs.writeFileSync(path.join(configData.apphome,'package.json'), JSON.stringify(pack,null, 2));

          // Delete package.json from cache
          delete require.cache[require.resolve(packPath)];

          log.info('Writing config data: %s ', path.join(configData.apphome, '.nodester', 'config.json'));

          var configPath = path.join(configData.apphome, '.nodester', 'config.json');

          try {
            fs.writeFileSync(configPath, JSON.stringify(configData),'utf8');
          } catch(excp) { 
            log.error(excp.message);
          }
          
          var cmd = 'cd ' + configData.apphome ;
              cmd += path.join(cfg.app_dir, 'scripts', 'chroot_runner.js');
              cmd += ' >> ' + configData.apphome + '/logs/app.log;';
          log.info('Starting process with %s',cmd);
          exec(cmd, function (error, stdout, stderr) {
            if (stdout) {
              log.info(stdout);
            }
            if (stderr) {
              log.warn(stderr);
            }
            setTimeout(function () {
              var tapp = {
                pid     : 'unknown',
                running : 'failed-to-start'
              };

              var fileRunner = path.join(configData.apphome, 'app.pid');
              fs.readFile(fileRunner, function (err, pids) {
                var pid = parseInt(pids, 10);
                if (pid > 0) {
                  tapp.pid = pid;
                  tapp.running = 'true';
                }
                apps.merge(doc.appname, tapp, function () {
                  callback(true, pid);
                });
              });
            }, 1500);
          });

          
      
        }
      });
    }
  });
}
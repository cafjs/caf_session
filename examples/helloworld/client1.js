'use strict';
/* eslint-disable  no-console */

var caf_core = require('caf_core');
var json_rpc = caf_core.caf_transport.json_rpc;
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var caf_cli = caf_core.caf_cli;

/* `from` CA needs to be the same as target `ca` to enable creation, i.e.,
 *  only owners can create CAs.
 *
 *  With security on, we would need a token to authenticate `from`.
 */
var URL = 'http://root-hello.vcap.me:3000/#from=foo-ca1&ca=foo-ca1';

var SESSION_ID = 'client1';
var s = new caf_cli.Session(URL);

s.changeSessionId(SESSION_ID);

s.onopen = function() {
    async.waterfall([
        function(cb) {
            setTimeout(function() {
                s.sessionInfo(cb);
            }, 3000);
        },
        function(info, cb) {
            console.log(info);
            setTimeout(function() {
                s.notifyAll('Hello from client1', cb);
            }, 5000);
        },
        function(info, cb) {
            console.log(info);
            setTimeout(function() {
                s.sessionInfo(cb);
            }, 5000);
        }
    ], function(err, info) {
        if (err) {
            console.log(myUtils.errToPrettyStr(err));
        } else {
            console.log('Final info:' + JSON.stringify(info));
            s.close();
        }
    });
};

s.onmessage = function(msg) {
    var notif = json_rpc.getMethodArgs(msg)[0];
    console.log('Got notification in client1:' + notif);
};

s.onclose = function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    }
    console.log('Done OK');
};

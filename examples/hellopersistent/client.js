'use strict';
/* eslint-disable  no-console */

var caf_core = require('caf_core');
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var caf_cli = caf_core.caf_cli;
var crypto = require('crypto');

/* `from` CA needs to be the same as target `ca` to enable creation, i.e.,
 *  only owners can create CAs.
 *
 *  With security on, we would need a token to authenticate `from`.
 */
var URL = 'http://root-hellopersist.vcap.me:3000/#from=foo-ca1&ca=foo-ca1';

var randomCrash = function() {
    var rand = crypto.randomBytes(1).readInt8();
    if (rand > 80) {
        console.log('Oops, crashing, please retry');
        process.exit(1);
    }
};

var STUFF = [
    'napkins', 'beer', 'toothpaste', 'bread', 'butter', 'jam', 'wine', 'milk',
    'flowers', 'lettuce', 'tomatosauce', 'apples', 'pears', 'oranges', 'ham'
];

var s = new caf_cli.Session(URL);

s.onopen = function() {
    var nonce = null;
    async.waterfall([
        s.begin,
        function(sessionInfo, cb) {
            console.log(sessionInfo);
            var index = 0;
            if (typeof sessionInfo.memento === 'number') {
                console.log('Crash detected, last buy was ' +
                            STUFF[sessionInfo.memento]);
                index = sessionInfo.memento + 1;
            }
            nonce = sessionInfo.nonce;
            var all = STUFF.slice(index);
            async.forEachOfSeries(all, function(item, localIndex, cb1) {
                randomCrash();
                var globalIndex = index + localIndex;
                s.buy(nonce, globalIndex, item, function(err, info) {
                    console.log(err ? 'Error with index ' + globalIndex :
                                JSON.stringify(info));
                    cb1(err, info);
                });
            }, cb);
        },
        function(cb) {
            s.end(nonce, cb);
        }
    ], function(err, info) {
        if (err) {
            s.close(err);
        } else {
            console.log('End info:' + JSON.stringify(info));
            s.close();
        }
    });
};

s.onclose = function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    }
    console.log('Done OK');
};

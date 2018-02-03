'use strict';
/* eslint-disable  no-console */

var caf_core = require('caf_core');
var caf_comp = caf_core.caf_components;
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

s.onopen = async function() {
    try {
        var nonce = null;
        var globalIndex;
        var sessionInfo = await s.begin().getPromise();
        console.log(sessionInfo);
        var index = 0;
        if (typeof sessionInfo.memento === 'number') {
            console.log('Crash detected, last buy was ' +
                        STUFF[sessionInfo.memento]);
            index = sessionInfo.memento + 1;
        }
        nonce = sessionInfo.nonce;
        var all = STUFF.slice(index);
        for (let [localIndex, item] of all.entries()) {
            // console.log('localIndex:' + localIndex);
            // console.log('item:' + item);
            randomCrash();
            globalIndex = index + localIndex;
            let info = await s.buy(nonce, globalIndex, item).getPromise();
            console.log(JSON.stringify(info));
        }
        var info = await s.end(nonce).getPromise();
        s.close();
        console.log('End info:' + JSON.stringify(info));
    } catch (err) {
        console.log('Error with index ' + globalIndex);
        s.close(err);
    }
};

s.onclose = function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    }
    console.log('Done OK');
};

'use strict';
/* eslint-disable  no-console */

const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const myUtils = caf_comp.myUtils;
const caf_cli = caf_core.caf_cli;
const crypto = require('crypto');

/* `from` CA needs to be the same as target `ca` to enable creation, i.e.,
 *  only owners can create CAs.
 *
 *  With security on, we would need a token to authenticate `from`.
 */
const URL = 'http://root-hellopersist.vcap.me:3000/#from=foo-ca1&ca=foo-ca1';

const randomCrash = function() {
    const rand = crypto.randomBytes(1).readInt8();
    if (rand > 80) {
        console.log('Oops, crashing, please retry');
        process.exit(1);
    }
};

const STUFF = [
    'napkins', 'beer', 'toothpaste', 'bread', 'butter', 'jam', 'wine', 'milk',
    'flowers', 'lettuce', 'tomatosauce', 'apples', 'pears', 'oranges', 'ham'
];

const s = new caf_cli.Session(URL);

s.onopen = async function() {
    let globalIndex;
    try {
        let nonce = null;
        const sessionInfo = await s.begin().getPromise();
        console.log(sessionInfo);
        let index = 0;
        if (typeof sessionInfo.memento === 'number') {
            console.log('Crash detected, last buy was ' +
                        STUFF[sessionInfo.memento]);
            index = sessionInfo.memento + 1;
        }
        nonce = sessionInfo.nonce;
        const all = STUFF.slice(index);
        for (let [localIndex, item] of all.entries()) {
            // console.log('localIndex:' + localIndex);
            // console.log('item:' + item);
            randomCrash();
            globalIndex = index + localIndex;
            const info = await s.buy(nonce, globalIndex, item).getPromise();
            console.log(JSON.stringify(info));
        }
        const info = await s.end(nonce).getPromise();
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

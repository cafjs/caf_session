'use strict';
/* eslint-disable  no-console */

const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const myUtils = caf_comp.myUtils;
const caf_cli = caf_core.caf_cli;
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

/* `from` CA needs to be the same as target `ca` to enable creation, i.e.,
 *  only owners can create CAs.
 *
 *  With security on, we would need a token to authenticate `from`.
 */
const URL = 'http://root-hello.vcap.me:3000/#from=foo-ca1&ca=foo-ca1';

const SESSION_ID = 'client1';
const s = new caf_cli.Session(URL);

s.changeSessionId(SESSION_ID);

s.onopen = async function() {
    try {
        await setTimeoutPromise(3000);
        var info = await s.sessionInfo().getPromise();
        console.log(info);
        await setTimeoutPromise(5000);
        info = await s.notifyAll('Hello from client1').getPromise();
        console.log(info);
        await setTimeoutPromise(5000);
        info = await s.sessionInfo().getPromise();
        console.log('Final info:' + JSON.stringify(info));
        s.close();
    } catch (err) {
        s.close(err);
    }
};

s.onmessage = function(msg) {
    const notif = caf_cli.getMethodArgs(msg)[0];
    console.log('Got notification in client1:' + notif);
};

s.onclose = function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    }
    console.log('Done OK');
};

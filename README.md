# Caf.js

Co-design cloud assistants with your web app and IoT devices.

See https://www.cafjs.com

## Library for Managing Sessions

[![Build Status](https://github.com/cafjs/caf_session/actions/workflows/push.yml/badge.svg)](https://github.com/cafjs/caf_session/actions/workflows/push.yml)

This repository contains a `Caf.js` library to handle notifications using persistent sessions.

### Better Cookies

What's wrong with cookies for session management?

* Chosen by the server not the client.
* Cannot have sensible, human-friendly, values.
* Do not move between devices.
* Browsers mess with them, making it difficult to replicate behavior outside the browser.

This library associates multiple notification queues to each CA (see {@link external:caf_ca}), and identifies them with simple names chosen by the client. Queue names are scoped by the CA name, and they can be easy to remember and still unique. This makes it easy to switch devices within a session.

Moreover, we don't assume an HTTP-based transport or a browser, and now your dumb gadgets can have sessions too.

But this raises a new issue, how to manage these notification queues? If a CA keeps queueing notifications that nobody reads, does it just run out of memory?

The best approach is very application dependent. In some cases we just need the last notification. In others we bound the size of the queue, and silently drop the old ones. Or we throw an error to throttle the CA. And what about duplicated notifications?

Our solution exposes the contents of output queues to application code, so that it can make the right choices.

### Hello World (see `examples/helloworld`)

The following example shows how to limit queues, and periodically notify
two clients, each using a different logical session:

```
exports.methods = {
    async __ca_init__() {
        this.state.counter = 0;
        this.$.session.limitQueue(10, 'client1');
        this.$.session.limitQueue(10, 'client2');
        return [];
    },
    async __ca_pulse__() {
        this.state.counter = this.state.counter + 1;
        if (this.state.counter % 2 === 0) {
            this.$.session.notify([this.state.counter], 'client1');
        }
        if (this.state.counter % 3 === 0) {
            this.$.session.notify([this.state.counter], 'client2');
        }
        return [];
    }
}
```

To check the status of all the queues:

```
exports.methods = {
...
    async sessionInfo() {
        const sessionInfo = {current: this.$.session.getSessionId()};
        this.$.session.getAllSessionIds().forEach((x) => {
            sessionInfo[x] = this.$.session.outq(x);
        });
        return [null, sessionInfo];
    }
}
```

If we want to notify all logical sessions, without knowing them a priori:

```
exports.methods = {
...
    async notifyAll(msg) {
        this.$.session.getAllSessionIds().forEach((x) => {
            this.$.session.notify([msg], x);
        });
        return this.sessionInfo();
    }
}
```

The client uses the handler `onmessage` to receive notifications. See `client1.js` for an example.

### Persistent Sessions

If clients are stateless, or we keep changing devices all the time, can we guarantee that certain actions are only done once?

After all, you didn't want two toasters, did you?

The influential work by Bernstein&Hsu&Mann'90 shows how to use a reliable queue to guarantee exactly-once delivery with a stateless client. A CA has an input queue, and its state is managed transactionally (see  {@link external:caf_ca}). Input and output queues are not checkpointed, but losing them is equivalent to dropping  messages in transit, and we do not assume a reliable transport.

Can we use a CA to implement exactly-once delivery for a stateless client?

Yes, if the client application is written in a certain way:

* First, it needs to explicitly start and end a persistent session. If a session is started again without being properly closed, we assume the client crashed.

* Second, it has to serialize concurrent sessions by using nonces.

* Third, enough client state has to be piggybacked to requests, so that the client can know what was the last committed action before the crash. We use a `memento` for that (see {@link module:caf_session/proxy_session}).

* Fourth, in case of a timeout or error, it has to crash and restart the session. When the session restarts it will receive the last `memento`, and use it to avoid duplicated requests.

The key is that our client library (see {@link  external:caf_cli}) and the CA serialize all the requests of a client within one session instance. Across sessions, nonces guarantee that only one session instance is active, and requests in other concurrent sessions will fail.


### Hello Persistent (see `examples/hellopersistent`)

This example shows how to guarantee that the items bought are not duplicated:

```
exports.methods = {
    async __ca_init__() {
        this.state.counters = {};
        return [];
    },
    async begin() {
        return [null, this.$.session.begin()];
    },
    async buy(nonce, itemIndex, item) {
        if (this.$.session.remember(nonce, itemIndex)) {
            var counter = this.state.counters[item] || 0;
            this.state.counters[item] = counter + 1;
            return this.getCounters();
        } else {
            var err = new Error('Ignoring buy operation, bad nonce');
            err.item = item;
            return [err];
        }
    },
    async end(nonce) {
        return [null, this.$.session.end(nonce)];
    },
    async getCounters() {
        return [null, this.state.counters];
    }
}
```

The client is in `examples/hellopersistent/client.js`.

The `memento` in this case is just an index in a list of items that we want to buy. Every time we buy an item, we increment its counter. The update of the `memento` and the counter is within a transaction scoped by the `buy` method.

If the client crashes, it will call `begin` again, and the CA will notice that the session was not ended properly, returning the `memento`. Then, the client can use that index to safely restart the buying spree where it was left off.

A nonce returned by `begin` is later used in all the method calls within a session instance, detecting races if other clients are still active.

## API

See {@link module:caf_session/proxy_session}

## Configuration

### framework.json

None

### ca.json

See {@link module:caf_session/plug_ca_session}

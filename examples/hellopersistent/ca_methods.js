'use strict';

var caf = require('caf_core');

exports.methods = {
    __ca_init__: function(cb) {
        this.state.counters = {};
        cb(null);
    },
    begin: function(cb) {
        cb(null, this.$.session.begin());
    },
    buy: function(nonce, itemIndex, item, cb) {
        if (this.$.session.remember(nonce, itemIndex)) {
            var counter = this.state.counters[item] || 0;
            this.state.counters[item] = counter + 1;
            this.getCounters(cb);
        } else {
            var err = new Error('Ignoring buy operation, bad nonce');
            err.item = item;
            cb(err);
        }
    },
    end: function(nonce, cb) {
        cb(null, this.$.session.end(nonce));
    },
    getCounters: function(cb) {
        cb(null, this.state.counters);
    }
};

caf.init(module);

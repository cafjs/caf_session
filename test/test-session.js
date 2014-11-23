var async = require('async');
var json_rpc = require('caf_transport');

var hello = require('./hello/main.js');

var TO = 'xx';
var FROM = 'yy';
var TOKEN = 'zz';
var METHOD_NAME = 'doit';
var ARGS = ['hello', 'bye'];

var newMsg = function(sessionId) {
    return json_rpc.request(TOKEN, TO, FROM, sessionId, METHOD_NAME, ARGS[0]);
};

var processMsg = function(opF, prepF, plugCA, sessionId, cb) {
    var msg = newMsg(sessionId);
    prepF = prepF || function(cb0) {
        return function(err, data) {
            cb0(err, data);
        };
    };
    async.series([
                     function(cb0) {
                         plugCA.__ca_begin__(msg, cb0);
                     },
                     function(cb0) {
                         opF(plugCA, cb0);
                     },
                     function(cb0) {
                         plugCA.__ca_prepare__(prepF(cb0));
                     },
                     function(cb0) {
                         plugCA.__ca_commit__(cb0);
                     }], cb);
};

var getNotifData = function(reply) {
    return json_rpc.getMethodArgs(json_rpc.getAppReplyData(reply));
};

var getNotifError = function(reply) {
    return json_rpc.getAppReplyError(reply);
};

module.exports = {
    setUp: function (cb) {
        var self = this;
        hello.load(null, null, 'hello1.json', null,
                   function(err, $) {
                       if (err) {
                           cb(err);
                       } else {
                           self.$ = $;
                           $._.$.session.__ca_init__(cb);
                       }
                   });
    },
    tearDown: function (cb) {
        this.$._.__ca_shutdown__(null, cb);
    },
    helloworld: function (test) {
        var self = this;
        test.expect(3);
        test.equal(typeof(self.$._), 'object',
                   'Cannot create hello');
        test.equal(typeof(self.$._.$.session), 'object',
                   'Cannot create session plug');
        test.equal(typeof(self.$._.$.session.$.proxy), 'object',
                   'Cannot create session proxy');
        test.done();
    },
    sessions: function (test) {
        var self = this;
        test.expect(21);
        var opF1 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            test.deepEqual(plugCA.$.proxy.outq(), []);
            test.deepEqual(plugCA.$.proxy.getAllSessionIds(), []);
            plugCA.$.proxy.notify(['hello', 'world']);
            cb(null);
        };
        var opF2 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'bar');
            test.deepEqual(plugCA.$.proxy.outq('foo'), [['hello', 'world']]);
            test.deepEqual(plugCA.$.proxy.outq(), []);
            test.deepEqual(plugCA.$.proxy.getAllSessionIds(), ['foo']);
            plugCA.$.proxy.notify(['bye', 'planet']);
            plugCA.$.proxy.notify(['hello2','world2'], 'foo');
            cb(null);
        };
        var opF3 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            test.deepEqual(plugCA.$.proxy.outq('bar'), [['bye', 'planet']]);
            test.deepEqual(plugCA.$.proxy.outq('foo'), [['hello', 'world'],
                                                        ['hello2','world2'] ]);
            test.deepEqual(plugCA.$.proxy.getAllSessionIds(), ['foo', 'bar']);
            cb(null);
        };

        var cpF1 = function(cb0) {
            return function(err, data) {
                test.equal(typeof data.sessions['foo'], 'object');
                test.ok(!data.sessions['foo'].bc);
                test.doesNotThrow(function() {JSON.stringify(data.sessions);});
                cb0(err, data);
            };
        };
        async.series([
                         function(cb) {
                             processMsg(opF1, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF2, null, self.$._.$.session, 'bar',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF3, cpF1, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             var cb0 = function(err, data) {
                                 test.ifError(err);
                                 var notif =  getNotifData(data);
                                 test.deepEqual(notif, ['hello', 'world']);
                                 cb(null);
                             };
                             self.$._.$.session.pull(newMsg('foo'), cb0);
                         },
                         function(cb) {
                             var cb0 = function(err, data) {
                                 test.ifError(err);
                                 var code =  json_rpc.getSystemErrorCode(data);
                                 test.equal(code,json_rpc.backchannelTimeout);
                                 cb(null);
                             };
                             self.$._.$.session.pull(newMsg('foo'), cb0);
                         },
                         function(cb) {
                             var cb0 = function(err, data) {
                                 test.ifError(err);
                                 var code =  json_rpc.getSystemErrorCode(data);
                                 test.equal(code,json_rpc.backchannelTimeout);
                                 cb(null);
                             };
                             self.$._.$.session.pull(newMsg('foo'), cb0);
                         }
                     ], function(err, data) {
                         test.ifError(err);
                         test.done();
                     });
    },
    pendingSession: function(test) {
        var self = this;
        test.expect(7);
        var opF1 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            plugCA.$.proxy.notify(['hello', 'world']);
            cb(null);
        };
        var cpF1 = function(cb0) {
            return function(err, data) {
                test.equal(typeof data.sessions['foo'], 'object');
                test.ok(!data.sessions['foo'].bc);
                test.doesNotThrow(function() {JSON.stringify(data.sessions);});
                cb0(err, data);
            };
        };

        async.parallel([
                           function(cb) {
                               var cb0 = function(err, data) {
                                   test.ifError(err);
                                   var notif =  getNotifData(data);
                                   test.deepEqual(notif, ['hello', 'world']);

                                   cb(null);
                               };
                               self.$._.$.session.pull(newMsg('foo'), cb0);
                           },
                           function(cb) {
                               setTimeout(function() {
                                              processMsg(opF1, cpF1,
                                                         self.$._.$.session,
                                                         'foo',
                                                         cb);
                                          },100);
                           }
                       ], function(err, data) {
                           test.ifError(err);
                           test.done();
                       });
    },
    resumeSession: function(test) {
        var self = this;
        test.expect(5);
        var cp;
        var opF1 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            plugCA.$.proxy.notify(['hello', 'world']);
            cb(null);
        };

        var opF2 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            test.deepEqual(plugCA.$.proxy.outq('foo'), [['hello', 'world']]);
            cb(null);
        };
        var cpF1 = function(cb0) {
            return function(err, data) {
                test.doesNotThrow(function() {JSON.stringify(data);});
                cp = data;
                cb0(err, data);
            };
        };

        async.series([
                         function(cb) {
                             processMsg(opF1, cpF1, self.$._.$.session,
                                        'foo', cb);
                         },
                         function(cb) {
console.log('<1');
                             self.$._.$.session.__ca_resume__(cp, cb);
                         },
                         function(cb) {
console.log('<2');
                             processMsg(opF2, null, self.$._.$.session,
                                        'foo', cb);
                         }
                       ], function(err, data) {
                           test.ifError(err);
                           test.done();
                       });
    },
    limits: function(test) {
        var self = this;
        test.expect(17);
        var opF1 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            plugCA.$.proxy.notify(['hello1']);
            plugCA.$.proxy.notify(['hello2']);
            plugCA.$.proxy.notify(['hello3']);
            plugCA.$.proxy.notify(['hello4']);
            plugCA.$.proxy.notify(['hello5']);
            plugCA.$.proxy.limitQueue(3);
            cb(null);
        };
       var opF2 = function(plugCA, cb) {
           test.equal(plugCA.$.proxy.getSessionId(), 'foo');
           test.deepEqual(plugCA.$.proxy.outq('foo'), [['hello3'],
                                                       ['hello4'],['hello5']]);
            plugCA.$.proxy.notify(['hello6']);
            plugCA.$.proxy.notify(['hello7']);
            plugCA.$.proxy.notify(['hello8']);
            plugCA.$.proxy.notify(['hello9']);
            plugCA.$.proxy.notify(['hello10']);
            cb(null);
        };
       var opF3 = function(plugCA, cb) {
           test.equal(plugCA.$.proxy.getSessionId(), 'foo');
           test.deepEqual(plugCA.$.proxy.outq('foo'), [['hello8'],
                                                       ['hello9'],
                                                       ['hello10']]);
           plugCA.$.proxy.limitQueue(-1);
           plugCA.$.proxy.notify(['hello11']);
           cb(null);
        };
        var opF4 = function(plugCA, cb) {
           test.equal(plugCA.$.proxy.getSessionId(), 'foo');
           test.deepEqual(plugCA.$.proxy.outq('foo'), [['hello8'],
                                                       ['hello9'],
                                                       ['hello10'],
                                                       ['hello11']]);
           cb(null);
        };
        var cpF1 = function(cb0) {
            return function(err, data) {
                console.log(JSON.stringify(data));
                test.equal(typeof data.sessions['foo'], 'object');
                test.ok(!data.sessions['foo'].bc);
                test.doesNotThrow(function() {JSON.stringify(data);});
                cb0(err, data);
            };
        };

        async.series([
                         function(cb) {
                             processMsg(opF1, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                              processMsg(opF2, cpF1, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                              processMsg(opF3, cpF1, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                              processMsg(opF4, cpF1, self.$._.$.session, 'foo',
                                        cb);
                         }

                     ], function(err, data) {
                         test.ifError(err);
                         test.done();
                     });
    },
    persist: function(test) {
        var self = this;
        test.expect(19);
        var nonce = null;
        var opF1 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            var res = plugCA.$.proxy.begin();
            nonce = res.nonce;
            test.equal(typeof nonce, 'string');
            test.ok(!res.memento);
            cb(null);
        };
        var opF2 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            var res = plugCA.$.proxy.remember(nonce, 'hello');
            cb(null);
        };
        var opF3 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            // begin without a proper end
            var res = plugCA.$.proxy.begin();
            nonce = res.nonce;
            test.equal(typeof nonce, 'string');
            test.equal(res.memento, 'hello');
            cb(null);
        };
        var opF4 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            var res = plugCA.$.proxy.remember(nonce, 'goodbye');
            cb(null);
        };
       var opF5 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            var res = plugCA.$.proxy.end(nonce);
            cb(null);
        };
       var opF6 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
           //second 'end' idempotent
           var res = plugCA.$.proxy.end(nonce);
           test.ok(res);
           // begin with proper end
           res = plugCA.$.proxy.begin();
           nonce = res.nonce;
           test.equal(typeof nonce, 'string');
           test.ok(!res.memento);
           cb(null);
        };
        var opF7 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            var res = plugCA.$.proxy.remember('bad nonce', 'eeee');
            test.ok(!res);
            plugCA.$.proxy.remember(nonce, 'one'); // ignored
            plugCA.$.proxy.remember(nonce, 'two');
            cb(null);
        };
       var opF8 = function(plugCA, cb) {
            test.equal(plugCA.$.proxy.getSessionId(), 'foo');
            // begin without a proper end
            var res = plugCA.$.proxy.begin();
            nonce = res.nonce;
            test.equal(typeof nonce, 'string');
            test.equal(res.memento, 'two');
            cb(null);
        };
        async.series([
                         function(cb) {
                             processMsg(opF1, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF2, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF3, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF4, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF5, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF6, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                         function(cb) {
                             processMsg(opF7, null, self.$._.$.session, 'foo',
                                        cb);
                         },
                        function(cb) {
                             processMsg(opF8, null, self.$._.$.session, 'foo',
                                        cb);
                         }
                     ], function(err, data) {
                         test.ifError(err);
                         test.done();
                     });
    }
};

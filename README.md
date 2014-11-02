# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF Lib Session

[![Build Status](http://ci.cafjs.com/github.com/cafjs/caf_session/status.svg?branch=master)](http://ci.cafjs.com/github.com/cafjs/caf_session)


This repository contains a CAF lib to handle notifications using persistent, logical sessions.


## API

    lib/proxy_session.js
 
## Configuration Example

### framework.json

None


### ca.json

        {
            "name": "session",
            "module" : "caf_session#plug_ca",
            "description" : "Manages sessions with clients\n Properties:\n <backChannelTimeout> Max seconds to reset the backchannel.\n",
            "env" : {
                "maxRetries" : "$._.env.maxRetries",
                "retryDelay" : "$._.env.retryDelay",
                "backChannelTimeout" : 1000
            },
            "components": [
                {
                    "name": "proxy",
                    "module" : "caf_session#proxy",
                    "description" : "session proxy",
                    "env" : {
                    }
                }
            ]
        }
        
            
 

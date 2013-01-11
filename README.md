# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF Lib Session

This repository contains a CAF lib to handle notifications using persistent, logical sessions.


## API

    lib/proxy_session.js
 
## Configuration Example

### framework.json

None


### ca.json


    "internal" : [
        {
            "module": "caf_session/plug_ca",
            "name": "session_ca",
            "description": "Manages sessions with clients\n Properties:\n <bcTimeout> Max seconds to reset the backchannel.\n",
            "env" : {
                 "bcTimeout" : 8
             }
         }
         ...
     ]

     "proxies" : [
         {
             "module": "caf_session/proxy",
             "name": "session",
             "description": "Provides information of the session of this incoming request",
             "env" : {

            }
          }
          ...
      ]
  
        
            
 

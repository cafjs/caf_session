The `client.js` program randomly crashes, but by restarting it, we ensure progress without duplicated actions.

Use the script `forever.sh` to keep retrying.

We can also crash the server (i.e., Control-C) and restart it, while the client is retrying. The client should recover gracefully, and continue without crashing or losing state.

If we run two concurrent instances of `client.js` one should crash when there is a race, guaranteeing exactly once delivery.

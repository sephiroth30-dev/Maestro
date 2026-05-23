'use strict';
// Entry point shim for Hostinger (or any host that runs "node server.js").
// Uses tsx to run the TypeScript source directly — no compiled dist/ needed.
const { register } = require('tsx/cjs/api');
register();
require('./src/index.ts');

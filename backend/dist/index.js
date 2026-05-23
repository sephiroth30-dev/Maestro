'use strict';
// Auto-generado por scripts/build.js
process.chdir(require('path').join(__dirname, '..'));
const { register } = require('../node_modules/tsx/cjs/api');
register({ tsconfig: require('path').join(__dirname, '..', 'tsconfig.json') });
require('../src/index.ts');

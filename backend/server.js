'use strict';
// Ensure we always run from the backend directory
process.chdir(__dirname);

// Use tsx to run TypeScript source directly (no dist/ needed)
const { register } = require('tsx/cjs/api');
register({ tsconfig: require('path').join(__dirname, 'tsconfig.json') });
require('./src/index.ts');

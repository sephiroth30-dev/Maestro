'use strict';
process.chdir(__dirname);
const { register } = require('tsx/cjs/api');
register({ tsconfig: require('path').join(__dirname, 'tsconfig.json') });
require('./src/index.ts');

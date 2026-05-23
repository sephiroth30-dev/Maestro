"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createRequestLogger = createRequestLogger;
const winston_1 = __importDefault(require("winston"));
const env_js_1 = require("./env.js");
const { combine, timestamp, printf, colorize, errors, json } = winston_1.default.format;
const developmentFormat = combine(colorize({ all: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), errors({ stack: true }), printf(({ level, message, timestamp: ts, requestId, stack, ...metadata }) => {
    let log = `[${ts}] ${level}: ${message}`;
    if (requestId) {
        log = `[${ts}] [${requestId}] ${level}: ${message}`;
    }
    if (stack) {
        log += `\n${stack}`;
    }
    if (Object.keys(metadata).length > 0) {
        log += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    return log;
}));
const productionFormat = combine(timestamp(), errors({ stack: true }), json());
exports.logger = winston_1.default.createLogger({
    level: env_js_1.env.LOG_LEVEL,
    format: env_js_1.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    defaultMeta: { service: 'neurofic-api' },
    transports: [
        new winston_1.default.transports.Console({
            silent: env_js_1.env.NODE_ENV === 'test',
        }),
    ],
});
function createRequestLogger(requestId) {
    return exports.logger.child({ requestId });
}
//# sourceMappingURL=logger.js.map
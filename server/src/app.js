"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express_1.default.json());
const users_1 = __importDefault(require("./routes/users"));
const chats_1 = __importDefault(require("./routes/chats"));
const messages_1 = __importDefault(require("./routes/messages"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);
app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});
app.use('/api/users', users_1.default);
app.use('/api/chats', chats_1.default);
app.use('/api/messages', messages_1.default);
// Centralized error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred'
        }
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map
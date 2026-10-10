const crypto = require('crypto');

const authMiddleware = (req, res, next) => {
    try {
        const authorization = req.headers.authorization || '';
        const [scheme, token, extra] = authorization.split(' ');
        if (scheme !== 'Bearer' || !token || extra) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
            return res.status(500).json({ error: 'Authentication is not configured' });
        }
        const [payload, signature, trailing] = token.split('.');
        if (!payload || !signature || trailing) return res.status(401).json({ error: 'Invalid token' });

        const expected = crypto.createHmac('sha256', secret).update(payload).digest();
        const actual = Buffer.from(signature, 'base64url');
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof decoded.sub !== 'string' || !Number.isFinite(decoded.iat) || Date.now() - decoded.iat > 24 * 60 * 60 * 1000 || decoded.iat > Date.now() + 60_000) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = authMiddleware;

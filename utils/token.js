const crypto = require("crypto")

const getTokenFromRequest = (req) => {
    const authHeader = req.get("authorization") || req.get("token")
    if(typeof authHeader !== "string"){
        return null
    }

    const match = authHeader.match(/^Bearer\s+(\S+)$/i)
    return match ? match[1] : null
}

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex")

module.exports = {getTokenFromRequest, hashToken}

const jwt = require("jsonwebtoken")
const RevokedToken = require("../models/RevokedToken")
const {getTokenFromRequest, hashToken} = require("../utils/token")

const verifyToken = async (req, res, next) =>{
    const token = getTokenFromRequest(req)
    if(!token){
        return res.status(401).json({
            success: false,
            message: "You are not authenticated!"
        })
    }

    try {
        const validation = jwt.verify(token, process.env.JWT_SEC)
        const revokedToken = await RevokedToken.exists({tokenHash: hashToken(token)})
        if(revokedToken){
            return res.status(401).json({
                success: false,
                message: "Token has been revoked."
            })
        }

        req.validation = validation
        return next()
    } catch (err) {
        if(err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError"){
            return res.status(403).json({
                success: false,
                message: "Token is not valid!"
            })
        }

        console.error("Error verifying token:", err)
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
}

const verifyTokenAndAuthorization = (req, res, next) => {
    verifyToken(req, res, () =>{
        if(req.validation?.id === req.params.id || req.validation?.isAdmin){
            next()
        }else{
            res.status(403).json({
                success: false,
                message: "You are not allowed in this operation!" 
            })
        }
    })
}


const verifyTokenAndAdmin = (req, res, next) =>{
    verifyToken(req, res, () =>{
        if(req.validation?.isAdmin){
            next()
        }else{
            res.status(403).json({
                success: false,
                message: "You are not allowed in this operation!" 
            })
        }
    })
}
module.exports = {verifyToken, verifyTokenAndAdmin, verifyTokenAndAuthorization}
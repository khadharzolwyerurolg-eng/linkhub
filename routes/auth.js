const router = require("express").Router()
const User = require("../models/User")
const CryptoJS = require("crypto-js")
const jwt = require("jsonwebtoken")
const RevokedToken = require("../models/RevokedToken")
const {getTokenFromRequest, hashToken} = require("../utils/token")


//REGISTER USER::
router.post("/register", async (req, res) =>{
    const newUser = new User({
        username: req.body.username,
        email: req.body.email,
        password: CryptoJS.AES.encrypt(req.body.password, process.env.PASS_SEC).toString()
    })

    try {
        const verifyUser = await User.findOne({
            $or: [
                { email: req.body.email },
                { username: req.body.username }
            ]
        });

        if (verifyUser) {
            return res.status(400).json({
                success: false,
                message: "Username or Email already exists!" 
            });
        }


        const savedUser = await newUser.save()
        
        return res.status(201).json({
            success: true,
            message: "User has been created!"
        })
    } catch (err) {
        console.error("Error saving user: ", err)

        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})


//LOGIN::
router.post("/login", async (req, res) =>{
    try {
        if(!req.body || !req.body.username){
            return res.status(400).json({
                success: false,
                message: "Missing credentials data!"
            })
        }
        
        const user = await User.findOne({
            username: req.body.username
        })

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Wrong credentials!"
            });
        }


        const hashedPassword = CryptoJS.AES.decrypt(
            user.password,
            process.env.PASS_SEC
        )

        const Orgpassword = hashedPassword.toString(CryptoJS.enc.Utf8)

        Orgpassword !== req.body.password &&
            res.status(401).json({
                success: false,
                message: "Wrong credentials!"
            })

        const accessToken = jwt.sign(
            {
                id: user._id,
                isAdmin: user.isAdmin
            },
            process.env.JWT_SEC,
            {expiresIn: "3d"}
        )

        const {password, ...others} = user._doc;

        res.status(200).json({
            success: true,
            ...others,
            accessToken
        })
    } catch (err) {
        console.error("Error Log in: ", err)

        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})


router.post("/logout", async (req, res) => {
    try {
        const token = getTokenFromRequest(req)
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authorization header is missing or malformed."
            })
        }

        const validation = jwt.verify(token, process.env.JWT_SEC)
        const revokedToken = {
            tokenHash: hashToken(token)
        }
        if(typeof validation === "object" && typeof validation.exp === "number"){
            revokedToken.expiresAt = new Date(validation.exp * 1000)
        }

        await RevokedToken.updateOne(
            {tokenHash: revokedToken.tokenHash},
            {$setOnInsert: revokedToken},
            {upsert: true}
        )

        return res.status(200).json({
            success: true,
            message: "Session ended successfully."
        })
    } catch (err) {
        if(err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError"){
            return res.status(401).json({
                success: false,
                message: "Token is not valid or has expired."
            })
        }

        console.error("Error logging out:", err)
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

module.exports = router
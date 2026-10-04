const router = require("express").Router()
const User = require("../models/User")
const CryptoJS = require("crypto-js")


const {verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin} = require("./verifyToken")

//EDIT USERS
router.put("/:id", verifyTokenAndAuthorization, async (req, res) =>{
    if(!req.body || typeof req.body !== "object" || Array.isArray(req.body)){
        return res.status(400).json({
            success: false,
            message: "A valid update object is required."
        })
    }

    const allowedFields = ["username", "email", "password"]
    if(req.validation?.isAdmin){
        allowedFields.push("isAdmin")
    }

    const requestedFields = Object.keys(req.body)
    if(requestedFields.length === 0 || requestedFields.some(field => !allowedFields.includes(field))){
        return res.status(400).json({
            success: false,
            message: "The update contains unsupported fields."
        })
    }

    const updates = {...req.body}
    if(updates.password){
        updates.password = CryptoJS.AES.encrypt(
            updates.password,
            process.env.PASS_SEC
        ).toString()
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            {
                $set: updates
            },
            {
                new: true,
                runValidators: true
            }
        ).select("-password")

        if(!updatedUser){
            return res.status(404).json({
                success: false,
                message: "User not found."
            })
        }

        res.status(200).json({
            success:  true,
            message: "User has been updated!",
            updatedUser
        })
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//DELETE USER::
router.delete("/:id", verifyTokenAndAuthorization, async (req, res) =>{
    try {
        await User.findByIdAndDelete(req.params.id)
        res.status(200).json({
            success:  true,
            message: "User has been deleted!"
        })
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//GET ALL USERS::
router.get("/", verifyTokenAndAdmin, async (req, res) =>{
    const query = req.query.new

    try {
        const users = query ? await User.find().sort({_id: 1}).limit(5) : await User.find()
        res.status(200).json(users)
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//GET USER BY ID::
router.get("/find/:id", verifyTokenAndAdmin, async (req, res) =>{
    try {
        const user = await User.findById(req.params.id)
        const {password, ...others} = user._doc

        res.status(200).json(others)
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//GET STATISTS ABOUT USERS::
router.get("/stats", verifyTokenAndAdmin, async (req, res) =>{
    const date = new Date()
    const lastYear = new Date(date.setFullYear(date.getFullYear() - 1))

    try {
       const data = await User.aggregate([
        {$match: {createdAt: {$gte: lastYear}}},
        {
            $project: {
                month: {$month: "$createdAt"}
            }
        },
        {
            $group:{
                _id: "$month",
                total: {$sum: 1}
            }
        }
       ]) 
       res.status(200).json(data)
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})
module.exports = router

const mongoose = require("mongoose")

const LinkSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    categoryId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    link: {
       type: String,
        required: true,
        trim: true 
    },
    description: {
        type: String,
        required: true,
        trim: true
    }
}, {timestamps: true})

LinkSchema.index({ userId: 1, link: 1 }, { unique: true })

module.exports = mongoose.model("Link", LinkSchema)
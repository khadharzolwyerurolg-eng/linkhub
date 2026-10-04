const router = require("express").Router()
const Category = require("../models/Categories")


const {verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin} = require("./verifyToken")

//CREATE CATEGORIES::
router.post("/", verifyTokenAndAdmin, async (req, res) =>{

    try {
        if(!req.body || !req.body.name && !req.body.description){
            return res.status(400).json({
                success: false,
                message: "Miffssing categories data!"
            })
        }
        
        const verifyCategory = await Category.findOne({
            $or: [
                {name: req.body.name},
                {description: req.body.description}
            ]
        })
        if(verifyCategory){
            return res.status(409).json({
                success: false,
                message: "Categories already exists!"
            })
        }
        const newCategory = new Category({
            name: req.body.name,
            description: req.body.description
        })

        const savedCategory = await newCategory.save()

        return res.status(201).json({
            success: true,
            message: "Category has been created!",
            savedCategory
        })
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//EDIT CATEGORIES
router.put("/:id", verifyTokenAndAuthorization, async (req, res) =>{
    if(!req.body || typeof req.body !== "object" || Array.isArray(req.body)){
        return res.status(400).json({
            success: false,
            message: "A valid update object is required."
        })
    }

    const allowedFields = ["name", "description"]

    const requestedFields = Object.keys(req.body)
    if(requestedFields.length === 0 || requestedFields.some(field => !allowedFields.includes(field))){
        return res.status(400).json({
            success: false,
            message: "The update contains unsupported fields."
        })
    }

    const updates = {...req.body}

    try {
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            {
                $set: updates
            },
            {
                new: true,
                runValidators: true
            }
        )

        if(!updatedCategory){
            return res.status(404).json({
                success: false,
                message: "Category not found."
            })
        }

        res.status(200).json({
            success:  true,
            message: "Category has been updated!",
            updatedCategory
        })
    } catch (err) {
        if(err.code === 11000){
            return res.status(409).json({
                success: false,
                message: "A category with this name or description already exists."
            })
        }

        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//DELETE CATEGORIES::
router.delete("/:id", verifyTokenAndAuthorization, async (req, res) =>{
    try {
        const updatedCategory = await Category.findOne()

        if(updatedCategory){
            return res.status(404).json({
                success: false,
                message: "Category not found."
            })
        }
        await Category.findByIdAndDelete(req.params.id)
        res.status(200).json({
            success:  true,
            message: "Category has been deleted!"
        })
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//GET ALL CATEGORIES::
router.get("/", verifyToken, async (req, res) =>{
    const query = req.query.new

    try {
        const category = query ? await User.find().sort({_id: 1}).limit(5) : await Category.find()
        res.status(200).json(category)
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
})

//GET CATEGORY BY ID::
router.get("/find/:id", verifyTokenAndAdmin, async (req, res) =>{
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        return res.status(200).json({
            success: true,
            data: category
        });
        
    } catch (err) {
        console.error("Error fetching category: ", err); 

        if (err.kind === 'ObjectId') {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format."
            });
        }

        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        });
    }
});

module.exports = router

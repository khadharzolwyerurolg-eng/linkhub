const express = require("express")
const dotenv = require("dotenv")
const mongoose = require("mongoose")


const app = express()

//::
const userRoute = require("./routes/user")
const authRoute = require("./routes/auth")
const categoryRoute = require("./routes/category")
const linkRoute = require("./routes/link")

//::
app.use(express.json())

dotenv.config();

mongoose.connect(process.env.MONGO_URL)
.then(() => {
    console.log("Mongo Connected!");
})
.catch((err) => {
    console.error("MongoDB connection error:", err);
});

//::
app.use("/api/users", userRoute)
app.use("/api/auth", authRoute)
app.use("/api/category", categoryRoute)
app.use("/api/link", linkRoute)



app.listen(5000, ()=>{
    console.log("Server Running!")
})
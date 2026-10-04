const router = require("express").Router()
const Link = require("../models/Links")
const axios = require("axios")

const {verifyToken} = require("./verifyToken")

const verifyLinkOwnerOrAdmin = async (req, res, next) => {
    try {
        const link = await Link.findById(req.params.id).select("userId")

        if (!link) {
            return res.status(404).json({ message: "Link not found!" })
        }

        if (String(link.userId) !== String(req.validation.id) && !req.validation.isAdmin) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to modify this link."
            })
        }

        return next()
    } catch (err) {
        if (err.name === "CastError") {
            return res.status(400).json({ message: "Invalid link ID." })
        }

        console.error("Error authorizing link access:", err)
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred while processing the request."
        })
    }
}

const normalizeLink = (value) => {
    if (typeof value !== "string" || !value.trim()) {
        const error = new Error("A valid HTTP or HTTPS link is required.")
        error.code = "INVALID_LINK"
        throw error
    }

    let normalizedLink = value.trim().replace(/^(https?:\/\/)(?:https?:\/\/)+/i, "$1")
    const explicitProtocol = normalizedLink.match(/^([a-z][a-z\d+.-]*):\/\//i)?.[1]

    if (explicitProtocol && !["http", "https"].includes(explicitProtocol.toLowerCase())) {
        const error = new Error("Only HTTP and HTTPS links are supported.")
        error.code = "INVALID_LINK"
        throw error
    }

    if (!explicitProtocol) {
        normalizedLink = `https://${normalizedLink}`
    }

    let parsedLink
    try {
        parsedLink = new URL(normalizedLink)
    } catch (err) {
        const error = new Error("A valid HTTP or HTTPS link is required.")
        error.code = "INVALID_LINK"
        throw error
    }

    return parsedLink.toString()
}

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
];

//:: Função auxiliar para gerar cabeçalhos simulados com User-Agent aleatório
const getHeadersConfig = () => {
    const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    return {
        'User-Agent': randomAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
};

// Helper: verifica se um link está alcançável com retries, logging e resposta consistente
const checkLinkAvailable = async (url) => {
    if (!url) return { available: false, reason: 'no_link' };
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const headers = getHeadersConfig();
        try {
            const resp = await axios.get(url, {
                timeout: 7000,
                maxRedirects: 5,
                headers: { ...headers, 'Range': 'bytes=0-1024' },
                validateStatus: () => true // sempre resolve, lidamos com status abaixo
            });

            return { available: true, status: resp.status };
        } catch (err) {
            // Se o servidor respondeu com erro (4xx/5xx), consideramos alcançável
            if (err.response) {
                return { available: true, status: err.response.status };
            }

            // Falha de rede/timeout: tentar novamente antes de desistir
            if (attempt < maxAttempts) {
                await new Promise((r) => setTimeout(r, 500 * attempt));
                continue;
            }

            console.error(`checkLinkAvailable: failed for ${url} —`, err.code || err.message);
            return { available: false, reason: err.code || err.message };
        }
    }
    return { available: false, reason: 'unknown' };
};

// List all links and check whether their URLs are reachable.
const listLinks = async (req, res) => {
    try {
        const links = await Link.find({}, { __v: 0 })
            .populate("userId", "username -_id")      
            .populate("categoryId", "name -_id");     

        const linksWithStatus = await Promise.all(
            links.map(async (link) => {
                const linkObj = link.toObject();
                let linkStatus = "unavailable (no link provided)";

                if (linkObj.link) {
                    const check = await checkLinkAvailable(linkObj.link);
                    linkStatus = check.available ? "disponivel" : "indisponivel";
                }

                linkObj.status_online = linkStatus;
                return linkObj;
            })
        );

        return res.status(200).json(linksWithStatus);
    } catch (err) {
        return res.status(500).json({ message: "Error fetching links.", error: err.message });
    }
};

router.get("/", listLinks);
router.get("/all", listLinks);

// Get a link by ID and check whether its URL is reachable.
router.get("/:id", async (req, res) => {
    try {
        const link = await Link.findById(req.params.id, { __v: 0 })
            .populate("userId", "username email -_id") 
            .populate("categoryId", "name -_id");      

        if (!link) {
            return res.status(404).json({ message: "Link not found!" });
        }

        let linkStatus = "unavailable (no link provided)";

        if (link.link) {
            const check = await checkLinkAvailable(link.link);
            linkStatus = check.available ? "disponivel" : "indisponivel";
        }

        const responseData = link.toObject();
        responseData.status_online = linkStatus;

        return res.status(200).json(responseData);
    } catch (err) {
        const status = err.name === "CastError" ? 400 : 500
        return res.status(status).json({ message: "Error fetching link.", error: err.message });
    }
});



// Create a link.
router.post("/register", verifyToken, async (req, res) => {
    try {
        const { categoryId, title, link, description } = req.body || {};

        if (!categoryId || !title || !link || !description) {
            return res.status(400).json({
                message: "categoryId, title, link and description are required!",
            });
        }

        const normalizedLink = normalizeLink(link)
        const existingLink = await Link.exists({
            userId: req.validation.id,
            link: normalizedLink
        })

        if (existingLink) {
            return res.status(409).json({
                success: false,
                message: "You have already registered this link."
            })
        }

        const newLink = new Link({
            userId: req.validation.id,
            categoryId,
            title,
            link: normalizedLink,
            description,
        });

        const savedLink = await newLink.save();
        return res.status(201).json(savedLink);
    } catch (err) {
        if (err.code === "INVALID_LINK") {
            return res.status(400).json({ message: err.message });
        }

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You have already registered this link."
            })
        }

        return res.status(500).json({
            message: "Error creating link.",
            error: err.message,
        });
    }
});



// Update a link.
router.put("/:id", verifyToken, verifyLinkOwnerOrAdmin, async (req, res) => {
    try {
        const { title, link, description, categoryId } = req.body || {};
        const updates = {};

        if (title !== undefined) updates.title = title;
        if (link !== undefined) updates.link = normalizeLink(link);
        if (description !== undefined) updates.description = description;
        if (categoryId !== undefined) updates.categoryId = categoryId;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "At least one supported field is required." });
        }

        const updatedLink = await Link.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedLink) {
            return res.status(404).json({
                message: "Link not found!",
            });
        }

        return res.status(200).json({
            message: "Link has been updated!",
            link: updatedLink,
        });
    } catch (err) {
        if (err.code === "INVALID_LINK") {
            return res.status(400).json({ message: err.message });
        }

        if (err.name === "CastError") {
            return res.status(400).json({ message: "Invalid link or category ID." });
        }

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You have already registered this link."
            })
        }

        return res.status(500).json({
            message: "Error updating link.",
            error: err.message,
        });
    }
});

// Delete a link.
router.delete("/:id", verifyToken, verifyLinkOwnerOrAdmin, async (req, res) => {
    try {
        const deletedLink = await Link.findByIdAndDelete(req.params.id);

        if (!deletedLink) {
            return res.status(404).json({
                message: "Link not found!",
            });
        }

        return res.status(200).json({
            message: "Link has been deleted!",
        });
    } catch (err) {
        if (err.name === "CastError") {
            return res.status(400).json({ message: "Invalid link ID." });
        }

        return res.status(500).json({
            message: "Error deleting link.",
            error: err.message,
        });
    }
});

module.exports = router;

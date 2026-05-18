const express = require("express");
const app = express();
const mongoose = require("mongoose");
require("dotenv").config();
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? "" : "development-only-session-secret-change-me");

if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required when NODE_ENV=production");
}

if (isProduction || process.env.RENDER) {
    app.set("trust proxy", 1);
}

//Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Rate limiting ──────────────────────────────────────────
const {
    authLimiter,
    sensitiveActionLimiter,
    orderLimiter,
    uploadLimiter,
    generalLimiter,
    contactLimiter,
} = require("./middlewares/ratelimit.middleware");

// General limiter on all /api routes
app.use("/api", generalLimiter);

// Specific limiters on vulnerable endpoints
app.use("/api/login",                    authLimiter);
app.use("/api/register",                 authLimiter);
app.use("/api/auth/google",              authLimiter);
app.use("/api/logout",                   authLimiter);
app.use("/api/profile/switch-role",      sensitiveActionLimiter);
app.use("/api/profile/role",             sensitiveActionLimiter);
app.use("/api/orders/place",             orderLimiter);
app.use("/api/orders",                   generalLimiter);
app.use(/^\/api\/orders\/.*\/upload/,    uploadLimiter);
app.use("/api/contact",                  contactLimiter);
// ──────────────────────────────────────────────────────────

//Connect to database
const {connectDb_submit} = require("./db/db");
connectDb_submit().then(async () => {
    // Auto-seed admin from env vars if no admin exists
    try {
        const Admin = require("./models/admin.models");
        const count = await Admin.countDocuments();
        if (count === 0 && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
            await Admin.create({
                username: process.env.ADMIN_USERNAME,
                password: process.env.ADMIN_PASSWORD, // pre-save hook hashes it
                role: "superadmin"
            });
            console.log(`[admin] Seeded admin: ${process.env.ADMIN_USERNAME}`);
        }
    } catch (e) {
        console.error("[admin seed]", e.message);
    }
});

//Session Setup

app.use(
  session({
    secret: sessionSecret,
    resave: false, 
    saveUninitialized: false, 
    cookie: {
      httpOnly: true, // prevents browser From accessing cookie
      secure: isProduction, 
      maxAge: 1000 * 60 * 60, //Limit of 1 hour
      sameSite: "lax",
    },
  })
);


//Serve HTML file

//Serve home page
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname, "public/html/index.html"));
})
//Serve cart
app.get("/serve/cart", (req,res)=>{
    res.sendFile(__dirname+"/public/html/cart.html");
})
//Serve Profile
app.get("/serve/profile", (req,res)=>{
    res.sendFile(__dirname+"/public/html/profile.html")
})
//Serve Wishlist
app.get("/serve/wishlist", (req,res)=>{
    res.sendFile(__dirname+"/public/html/wishlist.html")
})
//Serve Contact
app.get("/serve/contact", (req,res)=>{
    res.sendFile(__dirname+"/public/html/contact.html")
})
//Serve Categories
app.get("/serve/category/sports", (req,res)=>{
    res.sendFile(__dirname+"/public/html/category-sports.html")
})
// Old URL → new Sports category
app.get("/serve/category/gifts", (req,res)=>{
    res.redirect(301, "/serve/category/sports");
})
app.get("/serve/category/events", (req,res)=>{
    res.sendFile(__dirname+"/public/html/category-events.html")
})
app.get("/serve/category/office", (req,res)=>{
    res.sendFile(__dirname+"/public/html/category-office.html")
})
app.get("/serve/category/custom", (req,res)=>{
    res.sendFile(__dirname+"/public/html/category-custom.html")
})

//Serve payment successful
app.get("/success", (req,res)=>{
    res.sendFile(__dirname+"/public/html/payment_success.html")
});

//Serve payment failed / cancelled
app.get("/payment-fail", (req,res)=>{
    res.sendFile(__dirname+"/public/html/payment_fail.html")
});

//Serve checkout upload page
app.get("/serve/checkout/upload", (req,res)=>{
    res.sendFile(__dirname+"/public/html/checkout_upload.html")
});

//Serve photo tools pages
app.get("/serve/tools/passport", (req,res)=>{
    res.sendFile(__dirname+"/public/html/passport.html")
});
app.get("/serve/tools/mrp", (req,res)=>{
    res.status(200).send("<h1 style='font-family:system-ui;padding:40px'>MRP Photo Maker — coming soon</h1><p style='font-family:system-ui'><a href='/'>← Home</a></p>");
});
app.get("/serve/tools/retouch", (req,res)=>{
    res.status(200).send("<h1 style='font-family:system-ui;padding:40px'>Skin Retouch — coming soon</h1><p style='font-family:system-ui'><a href='/'>← Home</a></p>");
});

//Serve order tracking
app.get("/orders", (req,res)=>{
    res.sendFile(__dirname+"/public/html/orders.html"
    )
});

//Serve Nepal Details
app.get("/api/nepal-data", (req,res)=>{
    res.sendFile(__dirname+"/public/resources/nepal-address.json")
});

//Serve Products JSON
app.get("/api/products", (req,res)=>{
    res.sendFile(__dirname+"/public/resources/products.json")
});

//Serve admin dashboard
app.get("/admin/dashboard", (req,res)=>{
    res.sendFile(__dirname+"/public/html/admin_dashboard.html")
});

//Serve login page
app.get("/login", (req,res)=>{
    res.sendFile(__dirname+"/public/html/login.html")
});

//Serve forgot password page
app.get("/forgot-password", (req,res)=>{
    res.sendFile(__dirname+"/public/html/forgot_password.html")
});

//Serve admin login
app.get("/admin/login", (req,res)=>{
    res.sendFile(path.join(__dirname, "public/html/login_admin.html"))
});

//Serve admin login (alternate path)
app.get("/login/admin", (req,res)=>{
    res.sendFile(__dirname+"/public/html/login_admin.html")
});

//Serve signup member
app.get("/signup", (req,res)=>{
    res.sendFile(__dirname+"/public/html/signup.html")
});

//Serve registration route
const registerRoute = require("./routes/register.routes");
app.use("/api", registerRoute);

//Serve login route
const loginRoute = require("./routes/login.routes");
app.use("/api", loginRoute);

//Serve Google Sign-In route
const googleAuthRoute = require("./routes/google_auth.routes");
app.use("/api", googleAuthRoute);

//Serve profile route
const profileRoute = require("./routes/profile.routes");
app.use("/api", profileRoute);

//Serve cart route
const cartRoute = require("./routes/cart.routes");
app.use("/api", cartRoute);

//Serve contact route
const contactRoute = require("./routes/contact.routes");
app.use("/api", contactRoute);

//Serve delivery address route
const deliveryAddressRoute = require("./routes/delivery_adress.routes");
app.use("/api", deliveryAddressRoute);

//Serve wishlist route
const wishlistRoute = require("./routes/wishlist.routes");
app.use("/api", wishlistRoute);

//Serve order route
const orderRoute = require("./routes/order.routes");
app.use("/api", orderRoute);

//Serve photo tools route
const toolsRoute = require("./routes/tools.routes");
app.use("/api", toolsRoute);

//Serve admin login route
const adminLoginRoute = require("./routes/admin_login.routes");
app.use("/api", adminLoginRoute);



//Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

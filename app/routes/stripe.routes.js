// app/routes/stripe.routes.js
const express = require("express");
const controller = require("../controllers/stripe.controller");

class StripeRoute {
  constructor(app) {
    this.app = app;
    this.register();
  }

  register() {
    const router = express.Router();

    router.post("/create-checkout-session", controller.createCheckoutSession);
    router.post(
      "/webhook",
      express.raw({ type: "application/json" }),
      controller.webhook
    );

    this.app.use("/api/stripe", router);
  }
}

module.exports = StripeRoute;

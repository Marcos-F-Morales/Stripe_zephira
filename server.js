// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./app/models");
const StripeRoute = require("./app/routes/stripe.routes");
require("dotenv").config();

const APP_PORT = process.env.APP_PORT || 8082;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL;

class Server {
  constructor() {
    this.app = express();
    this.port = APP_PORT;

    // Middleware especial para Stripe Webhook
    this.app.use((req, res, next) => {
      if (req.originalUrl === "/api/stripe/webhook") {
        express.raw({ type: "application/json" })(req, res, next);
      } else {
        express.json()(req, res, next);
      }
    });

    this.configureMiddlewares();
    this.configureRoutes();
    this.connectDatabase();
  }

  configureMiddlewares() {
    this.app.use(cors({
      origin: API_GATEWAY_URL,
      credentials: true,
    }));
    this.app.use(bodyParser.urlencoded({ extended: true }));
  }

  configureRoutes() {
    new StripeRoute(this.app);
  }

  async connectDatabase() {
    try {
      await db.sequelize.sync({ alter: true });
      console.log("✅ Base de datos conectada y sincronizada.");
      const tables = await db.sequelize.getQueryInterface().showAllTables();
      console.log("📦 Tablas:", tables);
    } catch (error) {
      console.error("❌ Error al conectar con la base de datos:", error);
    }
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 Stripe Service corriendo en el puerto ${this.port}`);
    });
  }
}

const server = new Server();
server.start();

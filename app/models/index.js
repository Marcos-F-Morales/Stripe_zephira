// app/models/index.js
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const PaymentModel = require("./Payment");
const ReceiptModel = require("./Receipt");

const db = {};
db.sequelize = sequelize;

db.Payment = PaymentModel(sequelize, DataTypes);
db.Receipt = ReceiptModel(sequelize, DataTypes);

// Relaciones
db.Payment.hasOne(db.Receipt, { foreignKey: "paymentId" });
db.Receipt.belongsTo(db.Payment, { foreignKey: "paymentId" });

module.exports = db;

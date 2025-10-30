// app/controllers/stripe.controller.js
const stripe = require("../config/stripe.config");
const { Payment, Receipt } = require("../models");

const getFxGtqToUsd = () => {
  const fx = parseFloat(process.env.FX_GTQ_TO_USD);
  if (!fx || fx <= 0) throw new Error("FX_GTQ_TO_USD inválido");
  return fx;
};

const toUsdCents = (gtq, fx) => Math.round(Number(gtq) * fx * 100);

exports.createCheckoutSession = async (req, res) => {
  try {
    const { items, customerId } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Lista vacía" });

    const fx = getFxGtqToUsd();

    const line_items = items.map((i) => ({
      price_data: {
        currency: "usd",
        product_data: { name: i.name },
        unit_amount: toUsdCents(i.price, fx),
      },
      quantity: i.quantity,
    }));

    const total_cents = line_items.reduce(
      (acc, li) => acc + li.price_data.unit_amount * li.quantity,
      0
    );
    const total_gtq = total_cents / 100 / fx;

    const payment = await Payment.create({
      customerId,
      total_usd_cents: total_cents,
      total_gtq,
      currency: "usd",
      status: "pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: `${process.env.FRONTEND_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/stripe/cancel?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { paymentId: payment.id },
    });

    await payment.update({ stripeSessionId: session.id });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando sesión Stripe" });
  }
};

exports.webhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Error webhook:", err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      await Payment.update({ status: "processing" }, { where: { id: paymentId } });
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const paymentId = intent.metadata?.paymentId;
      const payment = await Payment.findByPk(paymentId);

      if (payment && payment.status !== "paid") {
        await payment.update({ status: "paid", paymentIntentId: intent.id });
        await Receipt.create({
          paymentId: payment.id,
          customerId: payment.customerId,
          total_usd: payment.total_usd_cents / 100,
          total_gtq: payment.total_gtq,
          currency: payment.currency,
        });
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const paymentId = intent.metadata?.paymentId;
      await Payment.update({ status: "failed" }, { where: { id: paymentId } });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Error procesando evento:", err);
    res.status(500).send("Error manejando webhook");
  }
};

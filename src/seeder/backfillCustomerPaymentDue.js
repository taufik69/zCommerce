require("dotenv").config();
require("module-alias/register");
const { default: mongoose } = require("mongoose");
const { customerModel, customerPaymentRecived } = require("../models/customer.model");
const { bumpNsVersion } = require("../utils/cache.util");

// Reconstructs dueBeforePayment/remainingDue for existing payment records by
// replaying each customer's payment history in chronological order, working
// forward from a starting due derived from their current openingDues plus
// every historical reduction (assumes no other due-affecting operations —
// e.g. new invoices — happened interleaved with these payments).
async function backfillCustomerPaymentDue() {
  const customers = await customerModel.find({});
  let updatedPayments = 0;

  for (const customer of customers) {
    const payments = await customerPaymentRecived
      .find({ customer: customer._id })
      .sort({ createdAt: 1 });

    if (!payments.length) continue;

    const totalReduce = payments.reduce(
      (sum, p) =>
        sum +
        Number(p.paidAmount || 0) +
        Number(p.lessAmount || 0) +
        Number(p.cashBack || 0),
      0,
    );

    let runningDue = Number(customer.openingDues || 0) + totalReduce;

    for (const payment of payments) {
      const reduce =
        Number(payment.paidAmount || 0) +
        Number(payment.lessAmount || 0) +
        Number(payment.cashBack || 0);

      const dueBeforePayment = runningDue;
      const remainingDue = runningDue - reduce;

      await customerPaymentRecived.updateOne(
        { _id: payment._id },
        { $set: { dueBeforePayment, remainingDue } },
      );
      updatedPayments += 1;

      runningDue = remainingDue;
    }
  }

  console.log(`Backfilled dueBeforePayment/remainingDue for ${updatedPayments} payment record(s).`);

  await bumpNsVersion("customer");
  await bumpNsVersion("customerPayment");
  console.log("Bumped 'customer' and 'customerPayment' cache namespaces to invalidate stale Redis entries.");
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return backfillCustomerPaymentDue();
  })
  .then(() => {
    console.log("Customer payment due backfill completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error backfilling customer payment due:", err);
    process.exit(1);
  });

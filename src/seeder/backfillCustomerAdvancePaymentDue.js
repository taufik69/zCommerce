require("dotenv").config();
require("module-alias/register");
const { default: mongoose } = require("mongoose");
const {
  customerModel,
  customerAdvancePaymentModel,
} = require("../models/customer.model");
const { bumpNsVersion } = require("../utils/cache.util");

// Reconstructs dueBeforePayment/remainingDue for existing advance payment
// records by replaying each customer's advance payment history in
// chronological order, working forward from a starting due derived from
// their current openingDues plus every historical reduction.
async function backfillCustomerAdvancePaymentDue() {
  const customers = await customerModel.find({});
  let updatedPayments = 0;

  for (const customer of customers) {
    const payments = await customerAdvancePaymentModel
      .find({ customer: customer._id })
      .sort({ createdAt: 1 });

    if (!payments.length) continue;

    const totalReduce = payments.reduce(
      (sum, p) => sum + Number(p.paidAmount || 0),
      0,
    );

    let runningDue = Number(customer.openingDues || 0) + totalReduce;

    for (const payment of payments) {
      const reduce = Number(payment.paidAmount || 0);

      const dueBeforePayment = runningDue;
      const remainingDue = runningDue - reduce;

      await customerAdvancePaymentModel.updateOne(
        { _id: payment._id },
        { $set: { dueBeforePayment, remainingDue } },
      );
      updatedPayments += 1;

      runningDue = remainingDue;
    }
  }

  console.log(
    `Backfilled dueBeforePayment/remainingDue for ${updatedPayments} advance payment record(s).`,
  );

  await bumpNsVersion("customer");
  await bumpNsVersion("customerAdvance");
  console.log(
    "Bumped 'customer' and 'customerAdvance' cache namespaces to invalidate stale Redis entries.",
  );
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return backfillCustomerAdvancePaymentDue();
  })
  .then(() => {
    console.log("Customer advance payment due backfill completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error backfilling customer advance payment due:", err);
    process.exit(1);
  });

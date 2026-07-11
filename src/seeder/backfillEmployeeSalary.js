require("dotenv").config();
require("module-alias/register");
const { default: mongoose } = require("mongoose");
const Employee = require("../models/employee.model");
const { bumpNsVersion } = require("../utils/cache.util");

async function backfillEmployeeSalary() {
  const employees = await Employee.find({});
  let updated = 0;

  for (const employee of employees) {
    const {
      basicSalary = 0,
      houseRent = 0,
      medicalAllowance = 0,
      othersAllowance = 0,
      specialAllowance = 0,
      providentFund = 0,
    } = employee.salary || {};

    const grossSalary =
      basicSalary + houseRent + medicalAllowance + othersAllowance + specialAllowance;
    const netSalary = grossSalary - providentFund;

    await Employee.updateOne(
      { _id: employee._id },
      { $set: { "salary.grossSalary": grossSalary, "salary.netSalary": netSalary } },
    );
    updated += 1;
  }

  console.log(`Backfilled salary.grossSalary/netSalary for ${updated} employee(s).`);

  await bumpNsVersion("employee");
  console.log("Bumped 'employee' cache namespace to invalidate stale Redis entries.");
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return backfillEmployeeSalary();
  })
  .then(() => {
    console.log("Employee salary backfill completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error backfilling employee salary:", err);
    process.exit(1);
  });

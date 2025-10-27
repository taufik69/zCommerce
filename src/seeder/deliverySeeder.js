require("dotenv").config();
const Delivery = require("../models/delivery.model");
const { default: mongoose } = require("mongoose");

const deliveryTypes = [
  {
    name: "Inside Dhaka",
    deliveryCharge: 60,
    description: "Delivery within Dhaka city",
  },
  {
    name: "Outside Dhaka",
    deliveryCharge: 120,
    description: "Delivery outside Dhaka city",
  },
  {
    name: "Sub Area",
    deliveryCharge: 100,
    description: "Delivery to sub areas around Dhaka",
  },
];

async function seedDelivery() {
  try {
    console.log("All delivery types deleted.");

    // Check if delivery types already exist
    const existingDeliveries = await Delivery.find();
    if (existingDeliveries.length > 0) {
      console.log("Delivery types already seeded.");
      return;
    }

    // Insert delivery types
    await Delivery.insertMany(deliveryTypes);
    console.log("Delivery types seeded successfully.");
  } catch (error) {
    console.error("Error seeding delivery types:", error);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return seedDelivery();
  })
  .then(() => {
    console.log("Delivery seeding completed successfully.");
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB or seeding delivery:", err);

    process.exit(1);
  });

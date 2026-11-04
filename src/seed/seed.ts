import mongoose from "mongoose";
import dotenv from "dotenv";

import { seedPermissions } from "./permissions.seed";
import { seedRoles } from "./roles.seed";
import { seedSuperAdmin } from "./superadmin.seed";

dotenv.config();

const runSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);

    console.log("MongoDB connected");

    // Step 1
    await seedPermissions();

    // Step 2
    await seedRoles();

    // Step 3
    await seedSuperAdmin();

    console.log("All seed data inserted successfully");

    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
};

runSeed();
import { randomBytes, scrypt } from "node:crypto";
import LoginModel from "../models/loginmodel";

import Role from "../models/Role";

const SUPERADMIN_NAME = "Super Admin";
const SUPERADMIN_EMAIL = "admin@example.com";
const SUPERADMIN_PASSWORD = "Admin@123456";

const PASSWORD_BYTES = 64;

const derivePasswordHash = (
  password: string,
  salt: string
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_BYTES, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });

export const seedSuperAdmin = async () => {
  const existingUser = await LoginModel.findOne({
    email: SUPERADMIN_EMAIL,
  });

  if (existingUser) {
    console.log("Superadmin already exists.");
    return;
  }

  const superAdminRole = await Role.findOne({
    name: "superadmin",
  });

  if (!superAdminRole) {
    throw new Error("Superadmin role not found. Seed roles first.");
  }

  // Generate password salt
  const passwordSalt = randomBytes(16).toString("hex");

  // Generate password hash using the same login controller algorithm
  const passwordHash = (
    await derivePasswordHash(SUPERADMIN_PASSWORD, passwordSalt)
  ).toString("hex");
      
  console.log("Password Salt:", passwordSalt);
console.log("Password Hash:", passwordHash);
console.log("Password Hash Type:", typeof passwordHash);
console.log("Password Hash Length:", passwordHash?.length);

  // Create superadmin account
  await LoginModel.create({
    name: SUPERADMIN_NAME,
    email: SUPERADMIN_EMAIL,
    role: "superadmin",
    status: "active",
    passwordSalt,
    passwordHash,
  });

  console.log("Superadmin created successfully.");
  console.log("Email:", SUPERADMIN_EMAIL);
};
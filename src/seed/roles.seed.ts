import Role from "../models/Role";
import Permission from "../models/Permission";

export const seedRoles = async () => {
  // Get all permissions
  const allPermissions = await Permission.find();

  if (allPermissions.length === 0) {
    throw new Error("No permissions found. Seed permissions first.");
  }

  // Create only Superadmin role
  await Role.updateOne(
    { name: "superadmin" },
    {
      $set: {
        name: "superadmin",
        description: "Full system access",
        permissions: allPermissions.map(
          (permission: any) => permission._id
        ),
        isSystem: true,
      },
    },
    { upsert: true }
  );

  console.log("Superadmin role seeded successfully");
};
import Permission from "../models/Permission";

const permissions = [
  // Dashboard
  {
    name: "dashboard.view",
    description: "View dashboard",
    module: "Dashboard",
  },

  // Users
  {
    name: "users.view",
    description: "View users",
    module: "Users",
  },
  {
    name: "users.create",
    description: "Create users",
    module: "Users",
  },
  {
    name: "users.edit",
    description: "Edit users",
    module: "Users",
  },
  {
    name: "users.delete",
    description: "Delete users",
    module: "Users",
  },

  // Roles
  {
    name: "roles.view",
    description: "View roles",
    module: "Roles",
  },
  {
    name: "roles.create",
    description: "Create roles",
    module: "Roles",
  },
  {
    name: "roles.edit",
    description: "Edit roles",
    module: "Roles",
  },
  {
    name: "roles.delete",
    description: "Delete roles",
    module: "Roles",
  },

  // Permissions
  {
    name: "permissions.view",
    description: "View permissions",
    module: "Permissions",
  },
  {
    name: "permissions.assign",
    description: "Assign permissions",
    module: "Permissions",
  },

  // Image Tools
  {
    name: "imagetools.view",
    description: "View image tools",
    module: "Image Tools",
  },
  {
    name: "background.remove",
    description: "Remove image background",
    module: "Image Tools",
  },
  {
    name: "background.change",
    description: "Change image background",
    module: "Image Tools",
  },
  {
    name: "image.analyze",
    description: "Analyze image",
    module: "Image Tools",
  },
  {
    name: "image.crop",
    description: "Crop image",
    module: "Image Tools",
  },
  {
    name: "image.compress",
    description: "Compress image",
    module: "Image Tools",
  },
  {
    name: "image.convert",
    description: "Convert image",
    module: "Image Tools",
  },
  {
    name: "image.bulk",
    description: "Bulk image processing",
    module: "Image Tools",
  },
  {
    name: "image.download",
    description: "Download processed images",
    module: "Image Tools",
  },

  // Downloads
  {
    name: "downloads.view",
    description: "View download history",
    module: "Downloads",
  },
  {
    name: "downloads.delete",
    description: "Delete download history",
    module: "Downloads",
  },

  // Guest / Free Limits
  {
    name: "limits.view",
    description: "View free usage limits",
    module: "Limits",
  },
  {
    name: "limits.manage",
    description: "Manage free usage limits",
    module: "Limits",
  },

  // Admin
  {
    name: "admin.view",
    description: "Access admin panel",
    module: "Admin",
  },
  {
    name: "admin.settings",
    description: "Manage admin settings",
    module: "Admin",
  },
];

export const seedPermissions = async () => {
  for (const permission of permissions) {
    await Permission.updateOne(
      { name: permission.name },
      { $set: permission },
      { upsert: true }
    );
  }

  console.log("Permissions seeded successfully");
};
import { Request, Response } from "express";
import RolePermissionConfig, {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_PERMISSION_KEYS,
  RoleName,
  RolePermissionKey,
  RolePermissionValues,
} from "../models/rolepermissionmodel";
import { getSessionUser } from "../midleware/sessionuser";

const CONFIG_KEY = "main";
const BUILT_IN_ROLES = Object.keys(DEFAULT_ROLE_PERMISSIONS);
const isRoleKey = (value: string): boolean => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 40;

const mergePermissions = (stored: unknown): RolePermissionValues => {
  const source = stored && typeof stored === "object" ? stored as Record<string, Record<string, unknown>> : {};
  const merged: RolePermissionValues = Object.fromEntries(
    Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, values]) => [role, { ...values }])
  );
  for (const role of Object.keys(source)) {
    if (!isRoleKey(role)) continue;
    if (!merged[role]) merged[role] = Object.fromEntries(ROLE_PERMISSION_KEYS.map((permission) => [permission, false])) as RolePermissionValues[string];
    const legacyManageUsers = source[role]?.["manageUsers" as RolePermissionKey];
    if (typeof legacyManageUsers === "boolean") {
      if (typeof source[role]?.createUsers !== "boolean") merged[role].createUsers = legacyManageUsers;
      if (typeof source[role]?.editUsers !== "boolean") merged[role].editUsers = legacyManageUsers;
    }
    for (const permission of ROLE_PERMISSION_KEYS) {
      const value = source[role]?.[permission];
      if (typeof value === "boolean") merged[role][permission] = value;
    }
  }
  return merged;
};

const roleCatalog = (permissions: RolePermissionValues, storedLabels: unknown) => {
  const labels = storedLabels && typeof storedLabels === "object" ? storedLabels as Record<string, unknown> : {};
  const knownLabels: Record<string, string> = { user: "User", manager: "Manager", admin: "Admin", superadmin: "Superadmin" };
  return Object.keys(permissions).map((key) => ({
    key,
    label: typeof labels[key] === "string" ? labels[key] as string : knownLabels[key] || key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    description: knownLabels[key] ? `${knownLabels[key]} account` : "Custom role",
  }));
};

export const getRolePermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }
    if (user.role !== "admin" && user.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Administrator access is required." });
      return;
    }

    const config = await RolePermissionConfig.findOne({ key: CONFIG_KEY }).lean();
    const permissions = mergePermissions(config?.permissions);
    res.status(200).json({ success: true, permissions, roles: roleCatalog(permissions, config?.roleLabels) });
  } catch (error) {
    console.error("[Role permissions] Could not load configuration:", error);
    res.status(500).json({ success: false, message: "Could not load role permissions." });
  }
};

export const updateRolePermission = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }
    if (user.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Superadmin access is required." });
      return;
    }

    const { role, permissions: rolePermissions } = (req.body ?? {}) as {
      role?: unknown;
      permissions?: unknown;
    };
    if (
      typeof role !== "string" || !isRoleKey(role) ||
      !rolePermissions || typeof rolePermissions !== "object" || Array.isArray(rolePermissions)
    ) {
      res.status(400).json({ success: false, message: "Provide a valid role and permissions." });
      return;
    }
    const submitted = rolePermissions as Record<string, unknown>;
    if (Object.keys(submitted).some((key) => !ROLE_PERMISSION_KEYS.includes(key as RolePermissionKey)) ||
        ROLE_PERMISSION_KEYS.some((key) => typeof submitted[key] !== "boolean")) {
      res.status(400).json({ success: false, message: "Provide a boolean value for every supported permission." });
      return;
    }

    let config = await RolePermissionConfig.findOne({ key: CONFIG_KEY });
    if (!config) {
      config = new RolePermissionConfig({ key: CONFIG_KEY, permissions: DEFAULT_ROLE_PERMISSIONS });
    }
    const permissions = mergePermissions(config.permissions);
    if (!permissions[role]) {
      res.status(404).json({ success: false, message: "Role not found. Create it before changing permissions." });
      return;
    }
    permissions[role as RoleName] = submitted as RolePermissionValues[RoleName];
    config.permissions = permissions;
    config.markModified("permissions");
    await config.save();

    res.status(200).json({ success: true, permissions, roles: roleCatalog(permissions, config.roleLabels) });
  } catch (error) {
    console.error("[Role permissions] Could not update configuration:", error);
    res.status(500).json({ success: false, message: "Could not update role permissions." });
  }
};

export const createRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: "Please sign in." });
      return;
    }
    if (user.role !== "superadmin") {
      res.status(403).json({ success: false, message: "Superadmin access is required." });
      return;
    }

    const { name } = (req.body ?? {}) as { name?: unknown };
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 40) {
      res.status(400).json({ success: false, message: "Enter a role name between 2 and 40 characters." });
      return;
    }
    const label = name.trim().replace(/\s+/g, " ");
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!isRoleKey(key) || BUILT_IN_ROLES.includes(key)) {
      res.status(400).json({ success: false, message: "Choose a role name using letters or numbers that is not already reserved." });
      return;
    }

    let config = await RolePermissionConfig.findOne({ key: CONFIG_KEY });
    if (!config) config = new RolePermissionConfig({ key: CONFIG_KEY, permissions: DEFAULT_ROLE_PERMISSIONS, roleLabels: {} });
    const permissions = mergePermissions(config.permissions);
    if (permissions[key]) {
      res.status(409).json({ success: false, message: "A role with this name already exists." });
      return;
    }
    permissions[key] = Object.fromEntries(ROLE_PERMISSION_KEYS.map((permission) => [permission, false])) as RolePermissionValues[string];
    const labels = config.roleLabels && typeof config.roleLabels === "object" ? { ...config.roleLabels } : {};
    labels[key] = label;
    config.permissions = permissions;
    config.roleLabels = labels;
    config.markModified("permissions");
    config.markModified("roleLabels");
    await config.save();
    res.status(201).json({ success: true, permissions, roles: roleCatalog(permissions, labels), role: { key, label, description: "Custom role" } });
  } catch (error) {
    console.error("[Role permissions] Could not create role:", error);
    res.status(500).json({ success: false, message: "Could not create role." });
  }
};

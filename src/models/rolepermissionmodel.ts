import mongoose, { Schema } from "mongoose";

export const ROLE_PERMISSION_KEYS = [
  "backgroundRemoval",
  "backgroundChanger",
  "imageCompressor",
  "imageConverter",
  "imageCropper",
  "bulkImageProcessing",
  "imageAnalyzer",
  "imageQualityControls",
  "zipDownloads",
  "viewUsers",
  "createUsers",
  "editUsers",
  "manageStatus",
  "manageRoles",
  "viewDownloads",
  "removeDownloads",
  "viewDownloadHistory",
  "manageDownloadHistory",
  "viewRolePermissions",
  "manageRolePermissions",
] as const;

export type RolePermissionKey = (typeof ROLE_PERMISSION_KEYS)[number];
export type RoleName = string;
export type PermissionValues = Record<RolePermissionKey, boolean>;
export type RolePermissionValues = Record<string, PermissionValues>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionValues = {
  user: {
    backgroundRemoval: true,
    backgroundChanger: true,
    imageCompressor: true,
    imageConverter: true,
    imageCropper: true,
    bulkImageProcessing: true,
    imageAnalyzer: true,
    imageQualityControls: true,
    zipDownloads: true,
    viewUsers: false,
    createUsers: false,
    editUsers: false,
    manageStatus: false,
    manageRoles: false,
    viewDownloads: false,
    removeDownloads: false,
    viewDownloadHistory: true,
    manageDownloadHistory: true,
    viewRolePermissions: false,
    manageRolePermissions: false,
  },
  admin: {
    backgroundRemoval: true,
    backgroundChanger: true,
    imageCompressor: true,
    imageConverter: true,
    imageCropper: true,
    bulkImageProcessing: true,
    imageAnalyzer: true,
    imageQualityControls: true,
    zipDownloads: true,
    viewUsers: true,
    createUsers: true,
    editUsers: true,
    manageStatus: true,
    manageRoles: false,
    viewDownloads: false,
    removeDownloads: false,
    viewDownloadHistory: true,
    manageDownloadHistory: true,
    viewRolePermissions: true,
    manageRolePermissions: false,
  },
  superadmin: {
    backgroundRemoval: true,
    backgroundChanger: true,
    imageCompressor: true,
    imageConverter: true,
    imageCropper: true,
    bulkImageProcessing: true,
    imageAnalyzer: true,
    imageQualityControls: true,
    zipDownloads: true,
    viewUsers: true,
    createUsers: true,
    editUsers: true,
    manageStatus: true,
    manageRoles: true,
    viewDownloads: true,
    removeDownloads: true,
    viewDownloadHistory: true,
    manageDownloadHistory: true,
    viewRolePermissions: true,
    manageRolePermissions: true,
  },
};

interface IRolePermissionConfig extends mongoose.Document {
  key: string;
  permissions: RolePermissionValues;
  roleLabels?: Record<string, string>;
}

const rolePermissionSchema = new Schema<IRolePermissionConfig>(
  {
    key: { type: String, required: true, unique: true },
    permissions: { type: Schema.Types.Mixed, required: true },
    roleLabels: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const RolePermissionConfig =
  (mongoose.models.RolePermissionConfig as mongoose.Model<IRolePermissionConfig> | undefined) ??
  mongoose.model<IRolePermissionConfig>("RolePermissionConfig", rolePermissionSchema);

export default RolePermissionConfig;

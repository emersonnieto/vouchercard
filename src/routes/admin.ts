import { Router } from "express";
import { requireRole } from "../middlewares/requireRole";
import * as adminController from "../modules/admin/admin.controller";

export const adminRouter = Router();

adminRouter.get("/me", adminController.getMe);

adminRouter.get(
  "/agencies",
  requireRole(["SUPERADMIN"]),
  adminController.listAgencies
);

adminRouter.post(
  "/agencies",
  requireRole(["SUPERADMIN"]),
  adminController.createAgency
);

adminRouter.patch(
  "/agencies/:agencyId/status",
  requireRole(["SUPERADMIN"]),
  adminController.updateAgencyStatus
);

adminRouter.patch(
  "/agencies/:agencyId/branding",
  requireRole(["SUPERADMIN"]),
  adminController.updateAgencyBranding
);

adminRouter.post(
  "/agencies/:agencyId/logo",
  requireRole(["SUPERADMIN"]),
  adminController.uploadAgencyLogo
);

adminRouter.post(
  "/agencies/:agencyId/users",
  requireRole(["SUPERADMIN"]),
  adminController.createAgencyUser
);

adminRouter.post(
  "/vouchers",
  requireRole(["ADMIN", "SUPERADMIN"]),
  adminController.createVoucher
);

adminRouter.get(
  "/vouchers",
  requireRole(["ADMIN", "SUPERADMIN"]),
  adminController.listVouchers
);

adminRouter.get(
  "/vouchers/:id",
  requireRole(["ADMIN", "SUPERADMIN"]),
  adminController.getVoucherById
);

import { Router } from "express";
import { requireRole } from "../middlewares/requireRole";
import * as adminController from "../modules/admin/admin.controller";

export const adminRouter = Router();

adminRouter.get("/me", adminController.getMe);
adminRouter.get(
  "/subscription",
  requireRole(["ADMIN"]),
  adminController.getAgencySubscription
);
adminRouter.post(
  "/subscription/cancel",
  requireRole(["ADMIN"]),
  adminController.cancelAgencySubscription
);

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
  requireRole(["ADMIN", "SUPERADMIN"]),
  adminController.updateAgencyBranding
);

adminRouter.post(
  "/agencies/:agencyId/logo",
  requireRole(["ADMIN", "SUPERADMIN"]),
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

adminRouter.patch(
  "/vouchers/:id",
  requireRole(["ADMIN", "SUPERADMIN"]),
  adminController.updateVoucher
);

adminRouter.get(
  "/postal-code-lookup",
  requireRole(["ADMIN", "SUPERADMIN"]),
  adminController.lookupPostalCode
);

import { shipmentController } from "./controller.js";
import { ShipmentPolicy } from "./policy.js";
import auth from "../../../middlewares/auth.js";
import validateObjectId from "../../../middlewares/validateObjectId.js";

export const registerShipmentRoutes = (router) => {
  router.put("/orders/:orderId/shipment", [auth, ShipmentPolicy.sellerOrAdmin(), validateObjectId("orderId")], shipmentController.upsert);
};

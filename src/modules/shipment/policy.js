import authorize from "../../../middlewares/authorize.js";

export class ShipmentPolicy {
  static sellerOrAdmin() {
    return authorize("admin", "seller");
  }
}

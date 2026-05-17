import authorize from "../../../middlewares/authorize.js";

export class SellerPolicy {
  static sellerOrAdmin() {
    return authorize("seller", "admin");
  }
}

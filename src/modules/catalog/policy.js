import authorize from "../../../middlewares/authorize.js";

export class CatalogPolicy {
  static sellerOrAdmin() {
    return authorize("admin", "seller");
  }
}

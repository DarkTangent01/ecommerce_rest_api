import { productController } from "./controller.js";
import { CatalogPolicy } from "./policy.js";
import auth from "../../../middlewares/auth.js";
import admin from "../../../middlewares/admin.js";
import validateObjectId from "../../../middlewares/validateObjectId.js";

export const registerCatalogRoutes = (router) => {
  router.post("/products", [auth, CatalogPolicy.sellerOrAdmin()], productController.store);
  router.put("/products/:id", [auth, CatalogPolicy.sellerOrAdmin(), validateObjectId("id")], productController.update);
  router.delete("/products/:id", [auth, admin, validateObjectId("id")], productController.destroy);
  router.get("/products", productController.index);
  router.get("/products/:id", validateObjectId("id"), productController.show);
};

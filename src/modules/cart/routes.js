import { cartController } from "./controller.js";
import { auth, sensitiveLimiter } from "./policy.js";
import validateObjectId from "../../../middlewares/validateObjectId.js";

export const registerCartRoutes = (router) => {
  router.get("/cart", auth, cartController.show);
  router.post("/cart/items", auth, sensitiveLimiter, cartController.addItem);
  router.put("/cart/items", auth, sensitiveLimiter, cartController.updateItem);
  router.delete("/cart/items/:productId", [auth, sensitiveLimiter, validateObjectId("productId")], cartController.removeItem);
  router.delete("/cart", auth, sensitiveLimiter, cartController.clear);
};

import { wishlistController } from "./controller.js";
import { auth, sensitiveLimiter } from "./policy.js";
import validateObjectId from "../../../middlewares/validateObjectId.js";

export const registerWishlistRoutes = (router) => {
  router.get("/wishlist", auth, wishlistController.show);
  router.post("/wishlist/:productId", [auth, sensitiveLimiter, validateObjectId("productId")], wishlistController.add);
  router.delete("/wishlist/:productId", [auth, sensitiveLimiter, validateObjectId("productId")], wishlistController.remove);
};

import { reviewController } from "./controller.js";
import { auth, reviewLimiter } from "./policy.js";
import validateObjectId from "../../../middlewares/validateObjectId.js";

export const registerReviewRoutes = (router) => {
  router.get("/products/:productId/reviews", validateObjectId("productId"), reviewController.index);
  router.post("/products/:productId/reviews", [auth, reviewLimiter, validateObjectId("productId")], reviewController.create);
};

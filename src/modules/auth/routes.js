import { loginController, refreshController, registerController, userController } from "./controller.js";
import { auth, authLimiter, sensitiveLimiter, stepUpAuth } from "./policy.js";

export const registerAuthRoutes = (router) => {
  router.post("/register", authLimiter, registerController.register);
  router.post("/login", authLimiter, loginController.login);
  router.get("/users", auth, userController.users);
  router.get("/users/export", auth, userController.exportData);
  router.delete("/users/me", [auth, sensitiveLimiter, stepUpAuth], userController.deleteData);
  router.post("/refresh", authLimiter, refreshController.refresh);
  router.post("/logout", auth, sensitiveLimiter, loginController.logout);
};

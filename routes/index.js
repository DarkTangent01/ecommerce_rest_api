import express from "express";
const router = express.Router();
import {
  registerController,
  loginController,
  userController,
  refreshController,
  productController,
} from "../controllers";
import auth from "../middlewares/auth";
import admin from "../middlewares/admin";

router.post("/register", registerController.register);
router.post("/login", loginController.login);
router.get("/users", auth, userController.users);
router.post("/refresh", refreshController.refresh);
router.post("/logout", auth, loginController.logout);

// Product Routes
router.post("/products", [auth, admin], productController.store);
router.put("/products/:id", [auth, admin], productController.update);
router.delete("/products/:id", [auth, admin], productController.destroy);

export default router;

import type { NextFunction, Request, Response } from "express";
import { cancelOrderSchema, checkoutSchema, refundOrderSchema, validate } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import OrderService from "../services/OrderService.js";
import { assertAuthed } from "../types/http.js";

class OrderController {
  orderService: OrderService;

  constructor(orderService = new OrderService()) {
    this.orderService = orderService;
    this.checkout = this.checkout.bind(this);
    this.index = this.index.bind(this);
    this.show = this.show.bind(this);
    this.cancel = this.cancel.bind(this);
    this.requestRefund = this.requestRefund.bind(this);
  }

  async checkout(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(checkoutSchema, req.body);
    if (error) return next(error);

    try {
      assertAuthed(req);
      const order = await this.orderService.checkout(req, value);
      return successResponse(res, order, "Order created", 201);
    } catch (err) {
      return next(err);
    }
  }

  async index(req: Request, res: Response, next: NextFunction) {
    try {
      assertAuthed(req);
      const { orders, meta } = await this.orderService.list(req);
      return successResponse(res, orders, "Orders fetched", 200, meta);
    } catch (err) {
      return next(err);
    }
  }

  async show(req: Request, res: Response, next: NextFunction) {
    try {
      assertAuthed(req);
      const order = await this.orderService.show(req);
      return successResponse(res, order, "Order fetched");
    } catch (err) {
      return next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(cancelOrderSchema, req.body);
    if (error) return next(error);

    try {
      assertAuthed(req);
      const order = await this.orderService.cancel(req, value);
      return successResponse(res, order, "Order cancelled");
    } catch (err) {
      return next(err);
    }
  }

  async requestRefund(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(refundOrderSchema, req.body);
    if (error) return next(error);

    try {
      assertAuthed(req);
      const order = await this.orderService.requestRefund(req, value);
      return successResponse(res, order, "Refund requested");
    } catch (err) {
      return next(err);
    }
  }
}

export default new OrderController();

import { cancelOrderSchema, checkoutSchema, refundOrderSchema } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import OrderService from "../services/OrderService.js";

class OrderController {
  constructor(orderService = new OrderService()) {
    this.orderService = orderService;
    this.checkout = this.checkout.bind(this);
    this.index = this.index.bind(this);
    this.show = this.show.bind(this);
    this.cancel = this.cancel.bind(this);
    this.requestRefund = this.requestRefund.bind(this);
  }

  async checkout(req, res, next) {
    const { error, value } = checkoutSchema.validate(req.body);
    if (error) return next(error);

    try {
      const order = await this.orderService.checkout(req, value);
      return successResponse(res, order, "Order created", 201);
    } catch (err) {
      return next(err);
    }
  }

  async index(req, res, next) {
    try {
      const { orders, meta } = await this.orderService.list(req);
      return successResponse(res, orders, "Orders fetched", 200, meta);
    } catch (err) {
      return next(err);
    }
  }

  async show(req, res, next) {
    try {
      const order = await this.orderService.show(req);
      return successResponse(res, order, "Order fetched");
    } catch (err) {
      return next(err);
    }
  }

  async cancel(req, res, next) {
    const { error, value } = cancelOrderSchema.validate(req.body);
    if (error) return next(error);

    try {
      const order = await this.orderService.cancel(req, value);
      return successResponse(res, order, "Order cancelled");
    } catch (err) {
      return next(err);
    }
  }

  async requestRefund(req, res, next) {
    const { error, value } = refundOrderSchema.validate(req.body);
    if (error) return next(error);

    try {
      const order = await this.orderService.requestRefund(req, value);
      return successResponse(res, order, "Refund requested");
    } catch (err) {
      return next(err);
    }
  }
}

export default new OrderController();

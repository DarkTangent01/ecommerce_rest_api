import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { toAppError } from "../../src/middlewares/errorHandler.js";
import { LockedError } from "../../src/infra/locks/distributedLock.js";
import CustomeErrorHandler from "../../src/services/CustomeErrorHandler.js";
import { AppError } from "../../src/shared/errors/AppError.js";

describe("toAppError", () => {
  it("passes AppErrors through, including the legacy CustomeErrorHandler", () => {
    const err = CustomeErrorHandler.notFound("Order not found");
    expect(err).toBeInstanceOf(AppError);
    expect(toAppError(err)).toMatchObject({ status: 404, code: "NOT_FOUND", message: "Order not found" });
  });

  it("maps a Mongoose CastError to 400 instead of 500", () => {
    const err = new mongoose.Error.CastError("ObjectId", "not-an-id", "_id");
    expect(toAppError(err)).toMatchObject({ status: 400, message: "Invalid value for _id" });
  });

  it("maps a Mongoose ValidationError to 422 with field details", () => {
    const err = new mongoose.Error.ValidationError();
    err.addError("name", new mongoose.Error.ValidatorError({ path: "name", message: "Path `name` is required." }));
    expect(toAppError(err)).toMatchObject({ status: 422, details: [{ field: "name", message: "Path `name` is required." }] });
  });

  it("maps duplicate-key errors to 409", () => {
    expect(toAppError({ code: 11000, keyValue: { sku: "X" } })).toMatchObject({ status: 409, message: "Duplicate value for sku" });
  });

  it("maps the checkout lock to 423 instead of 500", () => {
    expect(toAppError(new LockedError())).toMatchObject({ status: 423, code: "LOCKED" });
  });

  it("hides unexpected error messages", () => {
    expect(toAppError(new Error("connection string mongodb://secret"))).toMatchObject({ status: 500, message: "Internal server error" });
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRazorpayTestMode,
  readRazorpayConfiguration,
} from "./razorpay-config";

test("detects test credentials without exposing values", () => {
  const config = readRazorpayConfiguration({
    RAZORPAY_KEY_ID: "rzp_test_example",
    RAZORPAY_KEY_SECRET: "secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook",
  });

  assert.equal(config.mode, "test");
});

test("refuses test-mode operations for live key id", () => {
  assert.throws(
    () =>
      assertRazorpayTestMode({
        RAZORPAY_KEY_ID: "rzp_live_example",
        RAZORPAY_KEY_SECRET: "secret",
        RAZORPAY_WEBHOOK_SECRET: "webhook",
      }),
    /refused/,
  );
});

test("rejects incomplete configuration", () => {
  assert.throws(
    () =>
      readRazorpayConfiguration({
        RAZORPAY_KEY_ID: "rzp_test_example",
      }),
    /incomplete/,
  );
});

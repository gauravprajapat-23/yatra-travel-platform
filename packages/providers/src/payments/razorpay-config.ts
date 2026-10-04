export type RazorpayMode = "test" | "live";

export type RazorpayConfiguration = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: RazorpayMode;
};

export function readRazorpayConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): RazorpayConfiguration {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (!keyId || !keySecret || !webhookSecret) {
    throw new Error("Razorpay credentials are incomplete.");
  }

  let mode: RazorpayMode;

  if (keyId.startsWith("rzp_test_")) {
    mode = "test";
  } else if (keyId.startsWith("rzp_live_")) {
    mode = "live";
  } else {
    throw new Error("Razorpay key id has an unsupported format.");
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
    mode,
  };
}

export function assertRazorpayTestMode(
  env: NodeJS.ProcessEnv = process.env,
): RazorpayConfiguration {
  const config = readRazorpayConfiguration(env);

  if (config.mode !== "test") {
    throw new Error("Razorpay test-mode operation refused for live credentials.");
  }

  return config;
}

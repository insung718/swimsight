import "server-only";

export function logServerError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    console.error(message);
    return;
  }

  console.error(message, error);
}

import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function unauthorized(message = "Sign in required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "You do not have access to this resource.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Resource not found.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function serviceUnavailable(message = "Service is not configured.") {
  return NextResponse.json({ error: message }, { status: 503 });
}

export function validationError(details: unknown) {
  return badRequest("Validation failed.", details);
}

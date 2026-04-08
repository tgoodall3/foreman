import { NextResponse } from "next/server";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function notFoundResponse(message = "Not found") {
  return errorResponse(message, 404);
}

export function badRequest(message = "Invalid request") {
  return errorResponse(message, 400);
}

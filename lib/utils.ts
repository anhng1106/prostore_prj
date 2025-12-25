import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ZodError } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

//convert prisma obj into a regular js obj
export function convertToPlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

//format number with decimal places
export function formatNumberWithDecimal(num: number): string {
  const [int, decimal] = num.toString().split(".");
  return decimal ? `${int}.${decimal.padEnd(2, "0")}` : `${int}.00`;
}

//format errors
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatError(error: any) {
  if (error instanceof ZodError) {
    //handle zod errors
    const fieldErrors = error.issues.map((e) => e.message);
    return fieldErrors.join(", ");
  } else if (
    error.name === "PrismaClientKnownRequestError" &&
    error.code === "P2002"
  ) {
    //handle prisma errors
    const target = error.meta?.target;
    const raw =
      Array.isArray(target) && target.length > 0
        ? target[0]
        : typeof target === "string"
        ? target
        : "";

    const parsed =
      typeof raw === "string"
        ? raw.split("_").find((part) => part && part.toLowerCase() !== "key") ??
          raw
        : "";

    const field = parsed || "email";

    return `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
  } else {
    //handle other errors
    return typeof error.message === "string"
      ? error.message
      : JSON.stringify(error.message);
  }
}

//round number to 2 decimal places
export function round2(value: number | string) {
  if (typeof value === "number") {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  } else if (typeof value === "string") {
    return Math.round(Number(value + Number.EPSILON) * 100) / 100;
  } else {
    throw new Error("Value is not a number or string");
  }
}

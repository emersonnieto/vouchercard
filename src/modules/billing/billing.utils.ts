import crypto from "crypto";
import { SubscriptionStatus } from "@prisma/client";

export function sanitizeDigits(value: string | undefined | null) {
  return String(value ?? "").replace(/\D+/g, "");
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  return sanitizeDigits(value);
}

export function isValidCpfCnpj(value: string) {
  const digits = sanitizeDigits(value);

  if (digits.length === 11) {
    return isValidCpf(digits);
  }

  if (digits.length === 14) {
    return isValidCnpj(digits);
  }

  return false;
}

export function slugifyAgencyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function generatePublicToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function formatDateOnly(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Nao foi possivel formatar a data.");
  }

  return `${year}-${month}-${day}`;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function formatAsaasDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function mapAsaasEventToStatus(event: string) {
  switch (event) {
    case "CHECKOUT_CREATED":
    case "PAYMENT_CREATED":
      return {
        status: SubscriptionStatus.CHECKOUT_CREATED,
        activateAgency: false,
      };
    case "CHECKOUT_EXPIRED":
      return {
        status: SubscriptionStatus.CHECKOUT_EXPIRED,
        activateAgency: false,
      };
    case "CHECKOUT_CANCELED":
    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED":
    case "SUBSCRIPTION_DELETED":
      return {
        status: SubscriptionStatus.CANCELED,
        activateAgency: false,
      };
    case "CHECKOUT_PAID":
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED":
      return {
        status: SubscriptionStatus.ACTIVE,
        activateAgency: true,
      };
    case "PAYMENT_AUTHORIZED":
      return {
        status: SubscriptionStatus.CHECKOUT_CREATED,
        activateAgency: false,
      };
    case "PAYMENT_OVERDUE":
      return {
        status: SubscriptionStatus.PAST_DUE,
        activateAgency: false,
      };
    default:
      return null;
  }
}

function isValidCpf(value: string) {
  if (/^(\d)\1+$/.test(value)) return false;

  const numbers = value.split("").map(Number);
  const firstVerifier = calculateVerifier(numbers, 9, 10);
  const secondVerifier = calculateVerifier(numbers, 10, 11);

  return firstVerifier === numbers[9] && secondVerifier === numbers[10];
}

function isValidCnpj(value: string) {
  if (/^(\d)\1+$/.test(value)) return false;

  const numbers = value.split("").map(Number);
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const firstVerifier = calculateWeightedVerifier(numbers, firstWeights);
  const secondVerifier = calculateWeightedVerifier(numbers, secondWeights);

  return firstVerifier === numbers[12] && secondVerifier === numbers[13];
}

function calculateVerifier(numbers: number[], sliceLength: number, factor: number) {
  let total = 0;

  for (let index = 0; index < sliceLength; index += 1) {
    total += numbers[index] * (factor - index);
  }

  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

function calculateWeightedVerifier(numbers: number[], weights: number[]) {
  const total = weights.reduce((sum, weight, index) => {
    return sum + numbers[index] * weight;
  }, 0);

  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

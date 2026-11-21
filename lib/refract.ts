export interface RefractionRules {
  maskContacts: boolean;
  maskBudgets: boolean;
  shiftDeadlines: boolean;
  deadlineBufferDays: number;
  blockedKeywords: string[];
  quarantineHighRisk: boolean;
}

export interface RefractionFlag {
  type: "contact" | "budget" | "deadline" | "keyword";
  original: string;
  replacement: string;
  severity: "high" | "medium";
}

export interface RefractionResult {
  originalText: string;
  refractedText: string;
  flags: RefractionFlag[];
  shouldQuarantine: boolean;
}

export const DEFAULT_RULES: RefractionRules = {
  maskContacts: true,
  maskBudgets: true,
  shiftDeadlines: true,
  deadlineBufferDays: 2,
  blockedKeywords: ["Acme", "TechCorp"],
  quarantineHighRisk: true,
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function refractMessage(
  text: string,
  rules: RefractionRules
): RefractionResult {
  let refracted = text;
  const flags: RefractionFlag[] = [];

  // 1. Mask Contacts (Emails, URLs, Phone Numbers)
  if (rules.maskContacts) {
    // Emails
    refracted = refracted.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      (match) => {
        flags.push({
          type: "contact",
          original: match,
          replacement: "[EMAIL HIDDEN]",
          severity: "high",
        });
        return "[EMAIL HIDDEN]";
      }
    );

    // URLs / Links
    refracted = refracted.replace(
      /\b(?:https?:\/\/|www\.)[^\s]+/gi,
      (match) => {
        flags.push({
          type: "contact",
          original: match,
          replacement: "[LINK HIDDEN]",
          severity: "high",
        });
        return "[LINK HIDDEN]";
      }
    );

    // Phone numbers (matches 10+ digit Indian & international formats, ignores years like 2026)
    refracted = refracted.replace(
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,5}\b/g,
      (match) => {
        const digitsOnly = match.replace(/\D/g, "");
        if (digitsOnly.length < 9 || digitsOnly.length > 15) {
          return match;
        }
        flags.push({
          type: "contact",
          original: match,
          replacement: "[PHONE HIDDEN]",
          severity: "high",
        });
        return "[PHONE HIDDEN]";
      }
    );
  }

  // 2. Mask Budgets & Pricing (₹, Rs, INR, $, USD, etc.)
  if (rules.maskBudgets) {
    const prefixCurrencyRegex =
      /(?:₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|K|lakh|lakhs|cr|crore|thousand|million|m|M))?\b/gi;

    refracted = refracted.replace(prefixCurrencyRegex, (match) => {
      flags.push({
        type: "budget",
        original: match,
        replacement: "[BUDGET HIDDEN]",
        severity: "high",
      });
      return "[BUDGET HIDDEN]";
    });

    const suffixCurrencyRegex =
      /\b\d[\d,]*(?:\.\d+)?\s?(?:rupees|rs|inr|dollars|usd|bucks|lakhs?)\b/gi;

    refracted = refracted.replace(suffixCurrencyRegex, (match) => {
      flags.push({
        type: "budget",
        original: match,
        replacement: "[BUDGET HIDDEN]",
        severity: "high",
      });
      return "[BUDGET HIDDEN]";
    });
  }

  // 3. Custom Keyword Shield (Company / Brand Names)
  for (const rawKeyword of rules.blockedKeywords) {
    const keyword = rawKeyword.trim();
    if (!keyword) continue;
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
    refracted = refracted.replace(regex, (match) => {
      flags.push({
        type: "keyword",
        original: match,
        replacement: "[BRAND REDACTED]",
        severity: "high",
      });
      return "[BRAND REDACTED]";
    });
  }

  // 4. Dynamic Deadline Shifter (e.g., Friday -> Wednesday for 2-day review buffer)
  if (rules.shiftDeadlines && rules.deadlineBufferDays > 0) {
    const dayRegex =
      /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi;

    refracted = refracted.replace(dayRegex, (match) => {
      const idx = WEEKDAYS.findIndex(
        (d) => d.toLowerCase() === match.toLowerCase()
      );
      if (idx === -1) return match;
      const shiftedIdx =
        (((idx - rules.deadlineBufferDays) % 7) + 7) % 7;
      const shiftedDay = `${WEEKDAYS[shiftedIdx]} (${rules.deadlineBufferDays}d buffer)`;
      flags.push({
        type: "deadline",
        original: match,
        replacement: shiftedDay,
        severity: "medium",
      });
      return shiftedDay;
    });
  }

  const shouldQuarantine =
    rules.quarantineHighRisk && flags.some((f) => f.severity === "high");

  return {
    originalText: text,
    refractedText: refracted,
    flags,
    shouldQuarantine,
  };
}
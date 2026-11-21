"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Shield,
  ShieldAlert,
  Send,
  Check,
  X,
  EyeOff,
  Clock,
  Sparkles,
  Lock,
  Radio,
  Edit3,
} from "lucide-react";
import {
  DEFAULT_RULES,
  refractMessage,
  type RefractionFlag,
  type RefractionRules,
} from "@/lib/refract";

type Role = "client" | "broker" | "vendor";

interface ChatItem {
  id: string;
  senderRole: Role;
  targetRole?: Role | "both";
  text: string;
  originalText?: string;
  timestamp: number;
  kind: "normal" | "relayed" | "whisper" | "quarantine" | "blocked";
  flags?: RefractionFlag[];
  quarantineStatus?: "pending" | "approved" | "blocked";
  fromRole?: "client" | "vendor";
}

const ROLE_USER_ID: Record<Role, string> = {
  client: "client_demo",
  broker: "broker_demo",
  vendor: "vendor_demo",
};

const USER_ID_TO_ROLE: Record<string, Role> = {
  client_demo: "client",
  broker_demo: "broker",
  vendor_demo: "vendor",
};

function RoomInner() {
  const searchParams = useSearchParams();
  const rawRole = searchParams.get("role");
  const role: Role =
    rawRole === "broker" || rawRole === "vendor" ? rawRole : "client";

  const [status, setStatus] = useState<"connecting" | "connected" | "error">(
    "connecting"
  );
  const [statusText, setStatusText] = useState("Starting...");
  const [errorMsg, setErrorMsg] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Broker-specific state
  const [rules, setRules] = useState<RefractionRules>(DEFAULT_RULES);
  const [keywordsInput, setKeywordsInput] = useState("Acme, TechCorp");
  const [brokerTarget, setBrokerTarget] = useState<"vendor" | "client" | "both">(
    "vendor"
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [showRules, setShowRules] = useState(true);

  const sdkRef = useRef<any>(null);
  const rulesRef = useRef<RefractionRules>(rules);
  const connectedRef = useRef(false);
  const mountedRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sendViaNexconn = async (
    targetUserId: string,
    text: string,
    metadata?: Record<string, string>
  ) => {
    const sdk = sdkRef.current;
    if (!sdk) throw new Error("Nexconn SDK not ready");
    const channel = new sdk.DirectChannel(targetUserId);
    const params = new sdk.SendTextMessageParams({ text });
    if (metadata) {
      params.metadata = metadata;
    }
    const res = await channel.sendMessage(params);
    if (!res?.isOk) {
      throw new Error(res?.error?.message || "Failed to send message");
    }
    return res.data;
  };

  // Connect to Nexconn Chat SDK
  useEffect(() => {
    if (connectedRef.current) return;
    connectedRef.current = true;

    const myUserId = ROLE_USER_ID[role];

    const init = async () => {
      try {
        setStatus("connecting");
        setStatusText("1/4 Fetching token...");
        console.log(`[DealGlass:${role}] 1/4 Fetching token for`, myUserId);

        const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
        if (!appKey) {
          throw new Error("Missing NEXT_PUBLIC_NEXCONN_APP_KEY in .env.local");
        }

        const tokenRes = await fetch(`/api/token?userId=${myUserId}`);
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.token) {
          throw new Error(tokenData.error || "Could not fetch Nexconn token");
        }

        setStatusText("2/4 Loading SDK...");
        console.log(`[DealGlass:${role}] 2/4 Loading @nexconn/chat`);
        const sdk: any = await import("@nexconn/chat");
        sdkRef.current = sdk;

        setStatusText("3/4 Initializing...");
        console.log(`[DealGlass:${role}] 3/4 Initializing NCEngine`, {
          appKey,
          hasAreaCode: Boolean(sdk.AreaCode),
          hasLogLevel: Boolean(sdk.LogLevel),
        });

        sdk.NCEngine.initialize({
          appKey,
          ...(sdk.AreaCode?.SG !== undefined
            ? { areaCode: sdk.AreaCode.SG }
            : {}),
          ...(sdk.LogLevel?.DEBUG !== undefined
            ? { logLevel: sdk.LogLevel.DEBUG }
            : {}),
        });

        const handler = new sdk.MessageHandler({
          onMessageReceived: async (event: any) => {
            if (!mountedRef.current) return;
            const incoming = event?.messages || [];

            for (const msg of incoming) {
              const senderId = String(msg.senderUserId || "");
              if (senderId === myUserId) continue;

              const text = String(
                msg.content?.text ?? msg.content?.content ?? ""
              ).trim();
              if (!text) continue;

              const msgId = String(
                msg.messageUId ||
                  msg.messageId ||
                  `${Date.now()}-${Math.random()}`
              );
              const meta: Record<string, string> = msg.metadata || {};
              const senderRole: Role = USER_ID_TO_ROLE[senderId] || "broker";

              if (
                role === "broker" &&
                (senderRole === "client" || senderRole === "vendor")
              ) {
                const result = refractMessage(text, rulesRef.current);
                const oppositeRole: "client" | "vendor" =
                  senderRole === "client" ? "vendor" : "client";

                if (result.shouldQuarantine) {
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === msgId)) return prev;
                    return [
                      ...prev,
                      {
                        id: msgId,
                        senderRole,
                        fromRole: senderRole,
                        targetRole: oppositeRole,
                        originalText: result.originalText,
                        text: result.refractedText,
                        timestamp: Date.now(),
                        kind: "quarantine",
                        flags: result.flags,
                        quarantineStatus: "pending",
                      },
                    ];
                  });
                } else {
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === msgId)) return prev;
                    return [
                      ...prev,
                      {
                        id: msgId,
                        senderRole,
                        fromRole: senderRole,
                        targetRole: oppositeRole,
                        originalText: result.originalText,
                        text: result.refractedText,
                        timestamp: Date.now(),
                        kind: "relayed",
                        flags: result.flags,
                      },
                    ];
                  });

                  try {
                    await sendViaNexconn(
                      ROLE_USER_ID[oppositeRole],
                      result.refractedText,
                      {
                        dealGlassType: "relayed",
                        originRole: senderRole,
                        refracted: result.flags.length > 0 ? "true" : "false",
                      }
                    );
                  } catch (relayErr) {
                    console.error("Auto-relay failed:", relayErr);
                  }
                }
              } else {
                const kind: ChatItem["kind"] =
                  meta.dealGlassType === "whisper" ? "whisper" : "relayed";
                const displaySender: Role =
                  meta.dealGlassType === "whisper"
                    ? "broker"
                    : meta.originRole === "client" ||
                      meta.originRole === "vendor"
                    ? meta.originRole
                    : senderRole;

                setMessages((prev) => {
                  if (prev.some((m) => m.id === msgId)) return prev;
                  return [
                    ...prev,
                    {
                      id: msgId,
                      senderRole: displaySender,
                      text,
                      timestamp: Date.now(),
                      kind,
                    },
                  ];
                });
              }
            }
          },
        });

        sdk.NCEngine.addMessageHandler(`deal-glass-${role}`, handler);

        setStatusText("4/4 Connecting...");
        console.log(`[DealGlass:${role}] 4/4 Calling NCEngine.connect()`);

        const connectRes: any = await Promise.race([
          sdk.NCEngine.connect({ token: tokenData.token }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("NCEngine.connect() timed out after 12s")),
              12000
            )
          ),
        ]);

        console.log(`[DealGlass:${role}] connect result:`, connectRes);

        if (!connectRes?.isOk) {
          throw new Error(
            connectRes?.error?.message ||
              `Connect failed (code: ${connectRes?.code ?? "unknown"})`
          );
        }

        if (mountedRef.current) {
          setStatus("connected");
          setStatusText("Connected");
        }
      } catch (err: any) {
        console.error(`[DealGlass:${role}] init error:`, err);
        if (mountedRef.current) {
          setStatus("error");
          setStatusText("Error");
          setErrorMsg(err?.message || String(err) || "Connection failed");
        }
      }
    };

    init();
  }, [role]);

  // Listen for 1-click demo triggers from parent 3-pane sandbox
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "DEAL_GLASS_INJECT" && e.data?.role === role) {
        handleSend(e.data.text);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending || status !== "connected") return;

    setSending(true);
    if (!overrideText) setInput("");

    try {
      if (role === "client" || role === "vendor") {
        await sendViaNexconn(ROLE_USER_ID.broker, text, {
          dealGlassType: "inbound",
          originRole: role,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}-${Math.random()}`,
            senderRole: role,
            text,
            timestamp: Date.now(),
            kind: "normal",
          },
        ]);
      } else {
        if (brokerTarget === "both") {
          await Promise.all([
            sendViaNexconn(ROLE_USER_ID.client, text, {
              dealGlassType: "whisper",
              originRole: "broker",
            }),
            sendViaNexconn(ROLE_USER_ID.vendor, text, {
              dealGlassType: "whisper",
              originRole: "broker",
            }),
          ]);
        } else {
          await sendViaNexconn(ROLE_USER_ID[brokerTarget], text, {
            dealGlassType: "whisper",
            originRole: "broker",
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}-${Math.random()}`,
            senderRole: "broker",
            targetRole: brokerTarget,
            text,
            timestamp: Date.now(),
            kind: "whisper",
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleApproveQuarantine = async (item: ChatItem, customText?: string) => {
    if (!item.targetRole || item.targetRole === "both") return;
    const textToSend = (customText ?? item.text).trim();
    if (!textToSend) return;

    try {
      await sendViaNexconn(ROLE_USER_ID[item.targetRole], textToSend, {
        dealGlassType: "relayed",
        originRole: item.fromRole || "client",
        refracted: "true",
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === item.id
            ? { ...m, text: textToSend, quarantineStatus: "approved" }
            : m
        )
      );
      setEditingId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Relay failed");
    }
  };

  const handleBlockQuarantine = (id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, quarantineStatus: "blocked", kind: "blocked" } : m
      )
    );
  };

  const theme = {
    client: {
      title: "Client View",
      subtitle: "client_demo • Acme Corp",
      badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      accent: "bg-blue-600 hover:bg-blue-500",
      sampleText:
        "Hey, call me at 9876543210 or email raj@acme.com. Since I'm paying ₹50,000 for Acme, please finish by Friday.",
      sampleLabel: "⚡ Send Leak Test (Phone + ₹50k + Friday)",
    },
    broker: {
      title: "Broker Control Room",
      subtitle: "broker_demo • Dual-Channel Relay",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      accent: "bg-amber-600 hover:bg-amber-500",
      sampleText: "",
      sampleLabel: "",
    },
    vendor: {
      title: "Vendor / Freelancer",
      subtitle: "vendor_demo • External Contractor",
      badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      accent: "bg-purple-600 hover:bg-purple-500",
      sampleText:
        "Got it! My rate is ₹28,000. You can also reach me at dev@studio.io before Friday.",
      sampleLabel: "⚡ Send Vendor Quote (₹28k + Email)",
    },
  }[role];

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Pane Header */}
      <header className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${theme.badge}`}
            >
              {theme.title}
            </span>
            {role === "broker" && (
              <button
                onClick={() => setShowRules((v) => !v)}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                {showRules ? "Hide Rules" : "Rules"}
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {theme.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              status === "connected"
                ? "bg-emerald-400 animate-pulse"
                : status === "connecting"
                ? "bg-amber-400"
                : "bg-rose-500"
            }`}
          />
          <span className="text-[11px] text-slate-400">{statusText}</span>
        </div>
      </header>

      {/* Broker Refraction Rules Bar */}
      {role === "broker" && showRules && (
        <div className="px-3 py-2.5 bg-slate-900/70 border-b border-slate-800 space-y-2 shrink-0 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() =>
                setRules((r) => ({ ...r, maskContacts: !r.maskContacts }))
              }
              className={`px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                rules.maskContacts
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <EyeOff className="w-3 h-3" /> Contacts
            </button>
            <button
              onClick={() =>
                setRules((r) => ({ ...r, maskBudgets: !r.maskBudgets }))
              }
              className={`px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                rules.maskBudgets
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <Shield className="w-3 h-3" /> Budgets
            </button>
            <button
              onClick={() =>
                setRules((r) => ({ ...r, shiftDeadlines: !r.shiftDeadlines }))
              }
              className={`px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                rules.shiftDeadlines
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <Clock className="w-3 h-3" /> Shift -{rules.deadlineBufferDays}d
            </button>
            <button
              onClick={() =>
                setRules((r) => ({
                  ...r,
                  quarantineHighRisk: !r.quarantineHighRisk,
                }))
              }
              className={`px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                rules.quarantineHighRisk
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <ShieldAlert className="w-3 h-3" /> Quarantine Gate
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 shrink-0">
              Shield Brands:
            </span>
            <input
              value={keywordsInput}
              onChange={(e) => {
                setKeywordsInput(e.target.value);
                setRules((r) => ({
                  ...r,
                  blockedKeywords: e.target.value
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean),
                }));
              }}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
              placeholder="Acme, TechCorp"
            />
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="px-3 py-1.5 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex justify-between items-center">
          <span className="truncate">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-2 text-rose-400">
            ×
          </button>
        </div>
      )}

      {/* Message Feed */}
      <main className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-slate-500">
            <Lock className="w-7 h-7 mb-2 opacity-50" />
            <p className="text-xs font-medium text-slate-400">
              {role === "broker"
                ? "Unified Dual-Channel Relay Ready"
                : "Zero-Leak Deal Glass Channel"}
            </p>
            <p className="text-[11px] mt-1 max-w-[240px]">
              {role === "broker"
                ? "Messages between Client and Vendor pass through your Refraction Engine automatically."
                : "Send a message below or click the sample test button to see live refraction."}
            </p>
          </div>
        )}

        {messages.map((m) => {
          const isMine = m.senderRole === role && m.kind !== "quarantine";

          if (
            role === "broker" &&
            (m.kind === "quarantine" || m.kind === "blocked")
          ) {
            const isPending = m.quarantineStatus === "pending";
            const isApproved = m.quarantineStatus === "approved";

            return (
              <div
                key={m.id}
                className={`rounded-xl border p-3 text-xs space-y-2 ${
                  isPending
                    ? "bg-amber-950/40 border-amber-500/50"
                    : isApproved
                    ? "bg-emerald-950/30 border-emerald-500/40"
                    : "bg-rose-950/30 border-rose-500/40 opacity-75"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold flex items-center gap-1.5 text-amber-300">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {isPending
                      ? `Quarantined (${m.fromRole} → ${m.targetRole})`
                      : isApproved
                      ? `Approved & Relayed to ${m.targetRole}`
                      : `Blocked (${m.fromRole} → ${m.targetRole})`}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {m.flags?.map((f, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] uppercase tracking-wide text-amber-200"
                      >
                        {f.type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-400 mb-0.5">
                    Original ({m.fromRole} wrote):
                  </div>
                  <p className="text-slate-300 line-through decoration-rose-500/60">
                    {m.originalText}
                  </p>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-2 border border-emerald-500/30">
                  <div className="text-[10px] uppercase text-emerald-400 mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Refracted preview for{" "}
                    {m.targetRole}:
                  </div>
                  {editingId === m.id ? (
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-950 border border-amber-500 rounded p-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  ) : (
                    <p className="text-emerald-100 font-medium">{m.text}</p>
                  )}
                </div>

                {isPending && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editingId === m.id ? (
                      <button
                        onClick={() => handleApproveQuarantine(m, editDraft)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Relay Edited
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApproveQuarantine(m)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Refracted
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setEditDraft(m.text);
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 px-2.5 rounded-lg font-medium flex items-center gap-1 border border-slate-700"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleBlockQuarantine(m.id)}
                      className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 py-1.5 px-2.5 rounded-lg font-medium flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Block
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {m.kind === "whisper"
                    ? role === "broker"
                      ? `👻 Whisper → ${m.targetRole}`
                      : "👻 Private Whisper from Broker"
                    : role === "broker" && m.kind === "relayed"
                    ? `${m.fromRole} → ${m.targetRole} (Auto-Relayed)`
                    : isMine
                    ? "You"
                    : m.senderRole}
                </span>
              </div>

              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed border ${
                  m.kind === "whisper"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-100"
                    : isMine
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800/90 border-slate-700 text-slate-100"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                {role === "broker" &&
                  m.originalText &&
                  m.originalText !== m.text && (
                    <p className="mt-1 pt-1 border-t border-slate-700/80 text-[10px] text-slate-400">
                      Original: {m.originalText}
                    </p>
                  )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* 1-Click Sample Button for Client / Vendor */}
      {role !== "broker" && (
        <div className="px-3 pt-1.5 bg-slate-900/60 border-t border-slate-800/80">
          <button
            onClick={() => handleSend(theme.sampleText)}
            disabled={status !== "connected" || sending}
            className="w-full text-[11px] py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition truncate"
          >
            {theme.sampleLabel}
          </button>
        </div>
      )}

      {/* Broker Ghost Whisper Target Selector */}
      {role === "broker" && (
        <div className="px-3 pt-2 bg-slate-900/80 border-t border-slate-800 flex items-center gap-1.5 text-[11px]">
          <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-slate-400">Send to:</span>
          {(["client", "vendor", "both"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setBrokerTarget(t)}
              className={`px-2 py-0.5 rounded-full capitalize border transition ${
                brokerTarget === t
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-200 font-medium"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "both" ? "Both" : `Whisper ${t}`}
            </button>
          ))}
        </div>
      )}

      {/* Message Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2.5 bg-slate-900/90 flex items-center gap-2 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "connected"}
          placeholder={
            role === "broker"
              ? `Type a private whisper to ${brokerTarget}...`
              : `Message as ${role}...`
          }
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={status !== "connected" || sending || !input.trim()}
          className={`p-2 rounded-xl text-white disabled:opacity-40 transition ${theme.accent}`}
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-xs">
          Loading Deal Glass workspace...
        </div>
      }
    >
      <RoomInner />
    </Suspense>
  );
}
"use client";

import { useEffect, useState } from "react";

type PushSubscribeButtonProps = {
  keyword?: string;
  maxPrice?: number;
  productSlug?: string;
  vapidPublicKey: string;
};

type Status =
  | "denied"
  | "error"
  | "idle"
  | "subscribed"
  | "unsupported"
  | "working";

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The browser wants the VAPID key as bytes, not the base64url string. */
function urlBase64ToUint8Array(base64: string) {
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));

  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function PushSubscribeButton({
  keyword,
  maxPrice,
  productSlug,
  vapidPublicKey,
}: PushSubscribeButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isPushSupported() || Notification.permission === "denied") {
      return;
    }

    // Reflect an existing subscription so the button does not invite someone
    // to subscribe to something they already receive. This is an async read of
    // a browser API, not derivable during render, so it belongs in an effect.
    let cancelled = false;

    navigator.serviceWorker.getRegistration().then(async (registration) => {
      const existing = await registration?.pushManager.getSubscription();

      if (existing && !cancelled) {
        setStatus("subscribed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    setStatus("working");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          // Chrome requires this: every push must produce a visible
          // notification, which is what the service worker does.
          userVisibleOnly: true,
        }));

      const json = subscription.toJSON();
      const response = await fetch("/api/push/subscribe", {
        body: JSON.stringify({
          auth: json.keys?.auth,
          endpoint: subscription.endpoint,
          keyword,
          maxPrice,
          p256dh: json.keys?.p256dh,
          productSlug,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(body.error ?? "알림 등록에 실패했습니다.");
        setStatus("error");
        return;
      }

      setStatus("subscribed");
    } catch {
      setMessage("브라우저에서 알림을 등록하지 못했습니다.");
      setStatus("error");
    }
  }

  async function unsubscribe() {
    setStatus("working");

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        await subscription.unsubscribe();
      }

      setStatus("idle");
    } catch {
      setMessage("알림 해제에 실패했습니다.");
      setStatus("error");
    }
  }

  // The markup is identical on the server and on the client. Branching on
  // browser capability during render would mean the server emits nothing and
  // the client emits a button, which is a hydration mismatch; support is
  // checked when the button is pressed instead.
  if (status === "denied") {
    return (
      <p className="text-xs leading-5 text-slate-500">
        브라우저에서 이 사이트의 알림을 차단해 두었습니다. 주소창의 자물쇠
        아이콘에서 알림을 허용하면 가격 알림을 받을 수 있습니다.
      </p>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-xs leading-5 text-slate-500">
        이 브라우저는 웹 알림을 지원하지 않습니다. 위의 알림 등록을 이용해
        주세요.
      </p>
    );
  }

  return (
    <div>
      <button
        className={`w-full px-4 py-3 text-sm font-bold transition ${
          status === "subscribed"
            ? "border border-slate-300 text-slate-700 hover:bg-slate-100"
            : "bg-slate-950 text-white hover:bg-emerald-600"
        } disabled:opacity-60`}
        disabled={status === "working"}
        onClick={status === "subscribed" ? unsubscribe : subscribe}
        type="button"
      >
        {status === "working"
          ? "처리 중..."
          : status === "subscribed"
            ? "브라우저 알림 끄기"
            : "가입 없이 브라우저 알림 받기"}
      </button>
      {status === "subscribed" ? (
        <p className="mt-2 text-xs leading-5 text-emerald-700">
          가격이 조건에 맞으면 브라우저 알림으로 알려드립니다.
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs leading-5 text-rose-600">{message}</p>
      ) : null}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onScan: (code: string) => void;
  onError?: (msg: string) => void;
};

export default function BarcodeScanner({ onScan, onError }: Props) {
  const [active, setActive] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const containerId = "barcode-scanner-region";

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop();
    };
  }, []);

  async function startScan() {
    setActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (decoded) => {
          const code = decoded.replace(/\D/g, "");
          if (code.length >= 8) {
            void scanner.stop();
            scannerRef.current = null;
            setActive(false);
            onScan(code.length > 13 ? code.slice(0, 13) : code.padStart(13, "0").slice(-13));
          }
        },
        () => {}
      );
    } catch {
      setActive(false);
      onError?.("カメラの起動に失敗しました。ブラウザのカメラ権限を確認してください。");
    }
  }

  async function stopScan() {
    await scannerRef.current?.stop();
    scannerRef.current = null;
    setActive(false);
  }

  return (
    <div className="mb-4">
      <div
        id={containerId}
        className={`rounded-xl overflow-hidden bg-gray-900 ${active ? "block" : "hidden"}`}
        data-testid="barcode-scanner"
      />
      {!active ? (
        <button
          type="button"
          onClick={startScan}
          className="w-full bg-[#FFCCBC] text-gray-900 py-3 rounded-xl font-semibold text-sm"
          data-testid="start-camera-button"
        >
          📷 カメラでバーコードを読み取る
        </button>
      ) : (
        <button
          type="button"
          onClick={stopScan}
          className="w-full bg-gray-500 text-white py-3 rounded-xl font-semibold text-sm mt-2"
        >
          カメラを停止
        </button>
      )}
    </div>
  );
}

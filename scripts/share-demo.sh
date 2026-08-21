#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${SHARE_PORT:-3000}"

# システム PATH に node がなくても、プロジェクト同梱 Node を使う
export PATH="${ROOT}/frontend/.tools/bin:${PATH}"

if ! curl -sf "http://localhost:${PORT}" >/dev/null; then
  echo "❌ フロントエンドが起動していません"
  echo "   先に: cd frontend && PATH=\"\$(pwd)/.tools/bin:\$PATH\" npm run dev"
  exit 1
fi

if ! curl -sf "http://localhost:8000/api/family" >/dev/null; then
  echo "❌ バックエンドが起動していません"
  echo "   先に: cd backend && ./.tools/uv run uvicorn main:app --reload --port 8000"
  exit 1
fi

echo "=========================================="
echo "  共有URLを作成します"
echo "  少し待つと https://... が出ます"
echo "  そのURLを相手に送ってください"
echo "  停止するときは Ctrl+C"
echo "=========================================="
echo

if [[ -x "${ROOT}/.tools/cloudflared" ]]; then
  echo "（Cloudflare Tunnel を使用 / パスワード画面なし）"
  echo
  exec "${ROOT}/.tools/cloudflared" tunnel --url "http://localhost:${PORT}"
fi

if command -v cloudflared >/dev/null 2>&1; then
  echo "（Cloudflare Tunnel を使用 / パスワード画面なし）"
  echo
  exec cloudflared tunnel --url "http://localhost:${PORT}"
fi

if command -v npx >/dev/null 2>&1; then
  echo "（localtunnel を使用 / 確認画面が出ることがあります）"
  echo "  確認画面の Tunnel Password には次を入力:"
  echo "  $(curl -s https://ifconfig.me || echo '（ifconfig.me で自分のIPを確認）')"
  echo
  exec npx --yes localtunnel --port "${PORT}"
fi

echo "❌ npx も cloudflared も見つかりません。"
echo "   frontend/.tools/bin に Node があるか確認してください。"
exit 1

import { test, expect } from "@playwright/test";

test.describe("AIチャット相談 → 検索結果 → 商品詳細 → お薬手帳登録", () => {
  test("症状入力から購入登録までの一連の流れ", async ({ page }) => {
    await page.goto("/chat");

    await page.getByTestId("chat-input").fill("頭が痛いです");
    await page.getByTestId("send-button").click();

    await expect(page.getByTestId("assistant-bubble").last()).toContainText("頭痛・発熱");
    await expect(page.getByTestId("go-to-search-button")).toBeVisible();
    await page.getByTestId("go-to-search-button").click();

    await expect(page).toHaveURL(/\/search\?symptoms=/);
    await expect(page.getByTestId("result-grid")).toBeVisible();

    const firstCard = page.getByTestId("product-card").first();
    await expect(firstCard).toBeVisible();
    await firstCard.getByTestId("product-detail-link").click();

    await expect(page.getByTestId("product-detail")).toBeVisible();
    await expect(page.getByTestId("pdf-link")).toBeVisible();
    await expect(page.getByTestId("vendor-list")).toBeVisible();

    await page.getByTestId("price-input").fill("980");
    await page.getByTestId("purpose-input").fill("頭痛のため");
    await page.getByTestId("register-button").click();

    await expect(page.getByTestId("success-message")).toBeVisible();
  });

  test("重篤症状の入力で受診推奨バナーが表示される", async ({ page }) => {
    await page.goto("/chat");
    await page.getByTestId("chat-input").fill("息が苦しいです");
    await page.getByTestId("send-button").click();
    await expect(page.getByTestId("escalation-banner")).toBeVisible();
    await expect(page.getByTestId("go-to-search-button")).not.toBeVisible();
  });
});

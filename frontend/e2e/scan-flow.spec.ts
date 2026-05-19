import { test, expect } from "@playwright/test";

test.describe("JANスキャン → 購入追加 → ダッシュボード反映", () => {
  test("既知のJANコードで商品情報が表示され、追加後にホームの累計が増える", async ({
    page,
  }) => {
    // ホームの初期累計を確認（APIフェッチ完了まで待機）
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const initialText = await page
      .getByTestId("total-amount")
      .textContent();
    const initialTotal = parseInt(
      (initialText ?? "0").replace(/[^0-9]/g, ""),
      10
    );

    // スキャンページへ移動
    await page.getByTestId("scan-link").click();
    await expect(page).toHaveURL("/scan");

    // JANコード入力
    await page.getByTestId("jan-input").fill("4987117709559");
    await page.getByTestId("lookup-button").click();

    // 商品情報の表示を確認
    await expect(page.getByTestId("product-info")).toBeVisible();
    await expect(page.getByTestId("product-name")).toContainText(
      "ロキソニンS 12錠"
    );
    await expect(page.getByTestId("qualified-badge")).toBeVisible();

    // 購入金額を入力して追加
    await page.getByTestId("price-input").fill("980");
    await page.getByTestId("add-button").click();

    // 成功メッセージを確認
    await expect(page.getByTestId("success-message")).toBeVisible();

    // ホームに戻り累計が増えていることを確認（APIフェッチ完了まで待機）
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const newText = await page.getByTestId("total-amount").textContent();
    const newTotal = parseInt((newText ?? "0").replace(/[^0-9]/g, ""), 10);
    expect(newTotal).toBeGreaterThan(initialTotal);
  });

  test("未登録のJANコードでエラーメッセージが表示される", async ({ page }) => {
    await page.goto("/scan");
    await page.getByTestId("jan-input").fill("0000000000000");
    await page.getByTestId("lookup-button").click();
    await expect(page.getByTestId("error-message")).toBeVisible();
    await expect(page.getByTestId("error-message")).toContainText(
      "登録されていません"
    );
  });

  test("税制レポートページでCSVダウンロードリンクが存在する", async ({
    page,
  }) => {
    await page.goto("/tax");
    const csvLink = page.getByTestId("csv-download");
    await expect(csvLink).toBeVisible();
    const href = await csvLink.getAttribute("href");
    expect(href).toContain("fmt=csv");
  });
});

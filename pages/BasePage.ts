import { Page, expect } from "@playwright/test";

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateTo(url: string) {
    await this.page.goto(url);
  }

  async waitForElement(locator: string) {
    await this.page.locator(locator).waitFor({ state: "visible" });
  }

  async assertUrlContains(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

}

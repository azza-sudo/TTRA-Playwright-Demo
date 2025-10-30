import { BasePage } from "./BasePage";
import { Page } from "@playwright/test";
import { expect } from '@playwright/test';

export class SignInPage extends BasePage {
  readonly emailInput = 'input[name="email"]';
  readonly passwordInput = 'input[name="password"]';
  readonly signInButton = 'button[type="submit"]';
  readonly pageHeader = 'h2.title';
  readonly errorAlert = '.auth-alert.alert-danger';
  readonly fieldError = ".alert-danger";

  constructor(page: Page) {
    super(page);
  }

  async login(email: string, password: string) {
    await this.page.fill(this.emailInput, email);
    await this.page.fill(this.passwordInput, password);
    await this.page.click(this.signInButton);
  }
  async logout() {
    await this.page.click('[data-testid="profile-menu"]');
    await this.page.click('[data-testid="logout-button"]');

  }

  async fillEmail(email: string) {
    await this.page.fill(this.emailInput, email);
  }

  async fillPassword(password: string) {
    await this.page.fill(this.passwordInput, password);
  }

  async clickSignIn() {
    await this.page.click(this.signInButton);
  }


  async assertPageIsVisible(title: string) {
    await expect(this.page.locator(this.pageHeader)).toHaveText(title);
  }
  async assertLoginError(expectedMessage: string) {
    await this.page.waitForSelector(this.errorAlert, { state: 'visible' });
    const alertText = await this.page.textContent(this.errorAlert);
    expect(alertText).toContain(expectedMessage);
  }
  async assertFieldValidation(message: string) {
    await expect(this.page.locator(this.fieldError)).toContainText(message);
  }
}

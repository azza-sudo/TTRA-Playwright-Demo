import { BasePage } from "./BasePage";
import { Page } from "@playwright/test";
import { expect } from '@playwright/test';

export class SignUpPage extends BasePage {
  readonly nameInput = 'input[name="name"]';
  readonly emailInput = 'input[name="email"]';
  readonly passwordInput = 'input[name="password"]';
  readonly continueButton = "button[type='submit']";
  readonly finishButton = 'button:has-text("انهاء")';
  readonly errorAlert = '.auth-alert.alert-danger';
  constructor(page: Page) {
    super(page);
  }

  async register(name: string, email: string, password: string) {
    await this.page.fill(this.nameInput, name);
    await this.page.fill(this.emailInput, email);
    await this.page.fill(this.passwordInput, password);
    await this.page.click(this.continueButton);
  }

  async assertRegistrationSuccess() {
    await expect(this.page.getByRole('heading', { name: 'شكرا على التسجيل!' }))
      .toBeVisible()  }

  async clickSignUpButton() {
    await this.page.click(this.continueButton);
  }
  async clickFinishButton() {
    await this.page.click(this.finishButton);
  }
  async assertValidationError(message: string) {
    await this.page.waitForSelector(this.errorAlert, { state: 'visible' });
    const alertText = await this.page.textContent(this.errorAlert);
    expect(alertText).toContain(message);
  }

  async fillName(name: string) {
    await this.page.fill(this.nameInput, name);
  }
  async fillEmail(email: string) {
    await this.page.fill(this.emailInput, email);
  }
  async fillPassword(password: string) {
    await this.page.fill(this.passwordInput, password);
  }
  async togglePasswordVisibility() {
    await this.page.click('._showPW_1oc66_215');
  }

  async assertPasswordVisible() {
    const type = await this.page.getAttribute('input[name="password"]', 'type');
    expect(type).toBe('text');
  }

}

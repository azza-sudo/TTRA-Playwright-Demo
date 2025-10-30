import { test, expect } from "@playwright/test";
import { SignInPage } from "../pages/SignInPage";
import { ENV } from "../config/environment";

test.describe("Sign In Tests", () => {
  let signIn: SignInPage;
  test.beforeEach(async ({ page }) => {
    signIn = new SignInPage(page);
    await signIn.navigateTo("/login");
  });
  test("User can sign in with valid credentials", async ({ page }) => {
    await signIn.login(ENV.validUser.email, ENV.validUser.password);
    await signIn.assertPageIsVisible('الحملات');
    await signIn.assertUrlContains(ENV.baseUrl);
  });

  test("User cannot sign in with invalid credentials", async ({ page }) => {
    await signIn.login(ENV.invalidUser.email, ENV.invalidUser.password);
    await signIn.assertLoginError("بيانات تسجيل الدخول غير صالحة");
  });

  test("User cannot sign in with empty email and password", async ({ page }) => {
    await signIn.clickSignIn();
    await signIn.assertFieldValidation("البريد الإلكتروني وكلمة المرور مطلوبان");
  });

  //bug
    test("User cannot sign in with only email filled", async ({ page }) => {
      await signIn.fillEmail(ENV.validUser.email);
      await signIn.clickSignIn();
      await signIn.assertFieldValidation("كلمة المرور مطلوبة");
    });

  //bug
    test("User cannot sign in with only password filled", async ({ page }) => {
      await signIn.fillPassword(ENV.validUser.password);
      await signIn.clickSignIn();
      await signIn.assertFieldValidation("البريد الإلكتروني مطلوب");
    });

  test("User cannot sign in with invalid email format", async ({ page }) => {
    await signIn.login("invalidemail", ENV.validUser.password);
    await signIn.assertFieldValidation("الرجاء إدخال بريد إلكتروني صالح");
  });
//logout
  test("User can log out successfully", async ({ page }) => {
    await signIn.login(ENV.validUser.email, ENV.validUser.password);
    await signIn.assertPageIsVisible("الحملات");
    await signIn.logout();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(signIn.signInButton)).toBeVisible();
  });
//logout
  test("User cannot access dashboard after logout", async ({ page }) => {
    await signIn.login(ENV.validUser.email, ENV.validUser.password);
    await signIn.assertPageIsVisible("الحملات");
    await signIn.logout();
    await page.goto(`${ENV.baseUrl}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(signIn.signInButton)).toBeVisible();
  });
});

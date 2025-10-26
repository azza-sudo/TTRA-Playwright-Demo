import { test } from "@playwright/test";
import { SignUpPage } from "../pages/SignUpPage";
import { generateRandomEmail } from "../utils/helpers";

test.describe("Sign Up Tests", () => {
  let signUp: SignUpPage;
  test.beforeEach(async ({ page }) => {
    signUp = new SignUpPage(page);
    await signUp.navigateTo("/signup");
  });

  test("User can register with valid details", async ({ page }) => {
    const email = generateRandomEmail();
    await signUp.register("Test User", email, "Test@1234");
    await signUp.clickFinishButton();
    await signUp.assertRegistrationSuccess();
  });

  test("User cannot register with empty fields", async ({ page }) => {
    const email = generateRandomEmail();
    await signUp.clickSignUpButton();
    await signUp.assertValidationError("الاسم مطلوب");
    await signUp.fillName("test");
    await signUp.assertValidationError("البريد الإلكتروني مطلوب");
    await signUp.fillEmail(email);
    await signUp.assertValidationError("كلمة المرور مطلوبة");
  });

  test("User cannot register with invalid email format", async ({ page }) => {
    await signUp.register("Test User", "invalidEmail", "Test@1234");
    await signUp.assertValidationError("الرجاء إدخال بريد إلكتروني صالح");
  });

  test("User cannot register with weak password", async ({ page }) => {
    const email = generateRandomEmail();
    await signUp.register("Test User", email, "12345");
    await signUp.assertValidationError("يجب أن تحتوي كلمة المرور على 8 أرقام على الأقل، ورقم واحد وحرف كبير واحد.");
  });

  test("User cannot register with existing email", async ({ page }) => {
    const existingEmail = "salaha@extendad.com";
    await signUp.register("Test User", existingEmail, "Test@1234");
    await signUp.clickFinishButton();
    await signUp.assertValidationError("هذا المستخدم موجود بالفعل");
  });

  test("User cannot register with missing name", async ({ page }) => {
    const email = generateRandomEmail();
    await signUp.register("", email, "Test@1234");
    await signUp.assertValidationError("الاسم مطلوب");
  });

  test("Password visibility toggle works", async ({ page }) => {
    await signUp.fillPassword("Test@1234");
    await signUp.togglePasswordVisibility();
    await signUp.assertPasswordVisible();
  });
});

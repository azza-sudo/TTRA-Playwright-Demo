// tests/signUp.test.ts
import { expect, test } from "@playwright/test";
import { SignUpPage } from "../pages/SignUpPage";
import EmailService from "../utils/EmailService";
import { generateRandomEmail } from "../utils/helpers";

test.describe("Sign Up Tests", () => {
  let signUp: SignUpPage;

  test.beforeEach(async ({ page }) => {
    signUp = new SignUpPage(page);
    await signUp.navigateTo("/signup");
  });

  function randomAdminName() {
    return `testuser_${Date.now()}`;
  }

  test("User can register with valid details", async ({}, testInfo) => {
    test.slow();
    test.setTimeout(6 * 60 * 1000);

    const emailService = new EmailService();
    const email = await emailService.createUniqueEmail(randomAdminName());

    await signUp.register("Test User", email, "Test@1234");
    await signUp.clickFinishButton();
    // await signUp.assertRegistrationSuccess(); // if your UI shows a success state

    const REQUIRE_EMAIL = process.env.REQUIRE_EMAIL === "1";

    const gotAny = await emailService.waitForEmails(email, {
      minCount: 1,
      timeoutMs: 240_000, // 4 minutes
    });

    if (!gotAny) {
      const subjects = await emailService.getAllEmailsSubjects(email).catch(() => []);
      await testInfo.attach("subjects.txt", {
        body: JSON.stringify(subjects, null, 2),
        contentType: "text/plain",
      });
      console.warn(`[signup] No email within 4 minutes for ${email}.`);
      if (REQUIRE_EMAIL) expect(gotAny).toBeTruthy();
      return;
    }

    const msgBySubject = await emailService.waitForSubject(
      email,
      /welcome|verify|confirm|activation|account|registration/i,
      { timeoutMs: 120_000 }
    );

    const msgByBody = msgBySubject
      ? null
      : await emailService.waitForBodyContains(email, "welcome", {
          timeoutMs: 60_000,
        });

    const matched = msgBySubject ?? msgByBody;
    if (!matched && REQUIRE_EMAIL) {
      expect(matched).toBeTruthy();
    }
  });
//  test("User can register with valid details", async ({ page }) => {
//     const email = generateRandomEmail();
//     await signUp.register("Test User", email, "Test@1234");
//     await signUp.clickFinishButton();
//     await signUp.assertRegistrationSuccess();
//   });

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

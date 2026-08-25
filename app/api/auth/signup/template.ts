export function getVerificationHtml(confirmationUrl: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Almost There! - Vicalary</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
  <style type="text/css">
    /* Reset and Typography */
    body {
      margin: 0;
      padding: 0;
      min-width: 100%;
      font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f7f9f2;
      /* Branded tiled background */
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cimage href='https://vicalary.netlify.app/favicon.ico' x='25' y='25' width='30' height='30' opacity='0.05' /%3E%3C/svg%3E");
      background-repeat: repeat;
    }

    /* Mobile Responsive Overrides */
    @media only screen and (max-width: 600px) {
      .responsive-card {
        padding: 32px 20px !important;
        border-radius: 28px !important;
      }
      .responsive-title {
        font-size: 28px !important;
      }
      .responsive-padding {
        padding: 40px 10px !important;
      }
      .hero-image {
        width: 100% !important;
        height: auto !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0;">
  <!-- Main Outer Wrapper -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f7f9f2;">
    <tr>
      <td align="center" class="responsive-padding" style="padding: 60px 20px;">

        <!-- Brand Header Section -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
          <tr>
            <td align="center">
              <!-- Circular Application Logo -->
              <div style="background-color: #ffffff; padding: 4px; border-radius: 50%; display: inline-block; box-shadow: 0 8px 20px rgba(98, 126, 7, 0.15); border: 2px solid #627E07;">
                <img src="https://vicalary.netlify.app/app-logo.png" 
                     alt="Vicalary Logo" 
                     height="90" 
                     width="90" 
                     style="display: block; border-radius: 50%; border: none;" />
              </div>
              <h1 style="color: #627E07; font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; margin: 16px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Vicalary</h1>
            </td>
          </tr>
        </table>

        <!-- Main "Glass" Content Card -->
        <table class="responsive-card" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e5ebe1; border-radius: 40px; overflow: hidden; box-shadow: 0 25px 60px rgba(98, 126, 7, 0.08);">
          <tr>
            <td align="center" style="padding: 48px 45px;">
              
              <!-- Hero Illustration Image -->
              <div style="margin-bottom: 32px;">
                <img src="https://vicalary.netlify.app/Verificationillustration.png" 
                     alt="Preparing your magical account" 
                     width="300" 
                     style="display: block; width: 300px; max-width: 100%; height: auto; border: none; outline: none;" 
                     class="hero-image" />
              </div>

              <!-- Pill Indicator -->
              <div style="background-color: rgba(145, 168, 35, 0.12); border: 1px solid rgba(145, 168, 35, 0.2); border-radius: 100px; padding: 7px 20px; display: inline-block; margin-bottom: 24px;">
                <span style="color: #627E07; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">Magic Verification</span>
              </div>

              <!-- Heading -->
              <h2 class="responsive-title" style="color: #627E07; font-family: 'Outfit', sans-serif; font-size: 34px; font-weight: 800; margin: 0 0 16px 0; line-height: 1.1; letter-spacing: -1px;">Almost There!</h2>
              
              <!-- Customized Message -->
              <p style="color: #4b5563; font-family: 'Outfit', sans-serif; font-size: 17px; line-height: 1.6; margin: 0 0 36px 0; font-weight: 400;">
                We are busy preparing your magical account. Just one quick <strong>click</strong> below to verify your email and unlock your <strong>true potential</strong>.
              </p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 40px;">
                <tr>
                  <td align="center" bgcolor="#627E07" style="border-radius: 100px; background: linear-gradient(135deg, #91A823 0%, #627E07 100%);">
                    <a href="${confirmationUrl}" target="_blank" style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; color: #ffffff; text-decoration: none; padding: 22px 64px; display: inline-block; letter-spacing: 0.5px;">
                      Verify My Email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Tip Information Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-radius: 20px; background-color: #fafdf5; border: 1px solid #edf2e8;">
                <tr>
                  <td style="padding: 18px; font-family: 'Outfit', sans-serif; font-size: 13px; line-height: 1.6; color: #6b7280; text-align: center;">
                    <strong style="color: #627E07;">Quick Tip:</strong> This link is valid for 24 hours. Didn’t sign up? You can safely ignore this magic lamp.
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

        <!-- Copyright Footer -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 36px;">
          <tr>
            <td align="center" style="font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">
              © 2026 Vicalary Food Delights. All rights reserved.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

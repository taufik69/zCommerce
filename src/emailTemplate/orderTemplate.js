/**
 * Generates the HTML content for an order confirmation email.
 * @param {object} order - The order object from the database.
 * @param {object} shippingInfo - The shipping information of the customer.
 * @param {object} invoice - The invoice object for the order.
 * @returns {string} The complete HTML string for the email.
 */
exports.orderTemplate = (order, shippingInfo, invoice, totalProductInfo) => {
  // A simple way to generate HTML without a dedicated templating engine
  // This can be improved with a library like Handlebars for more complex templates
  let productRows = "";
  // Loop through order items to create the product table rows
  totalProductInfo.forEach((item) => {
    productRows += `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td style="text-align: right;">${item.totalPrice} টাকা</td>
      </tr>
    `;
  });

  // The full HTML template as a string literal
  const template = `
    
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>অর্ডার নিশ্চিতকরণ - আপনার অর্ডারটি নিশ্চিত করা হয়েছে</title>
        <style>
            body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; }
            /* Reset */
            body { margin: 0; padding: 0 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: #f4f4f4; }
            table { border-collapse: collapse !important; }
            a { text-decoration: none; }
            /* Layout */
            .wrapper { max-width: 600px; width: 100%; margin: auto; }
            .content-table { width: 100%; border-radius: 6px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { text-align: center; padding: 20px 0; background-color: #f7f7f7; }
            .header img { width: 120px; height: auto; }
            .hero { background-color: #4CAF50; color: #ffffff; padding: 30px; text-align: center; }
            .body-content { padding: 20px 30px; }
            .footer { background-color: #333333; color: #ffffff; text-align: center; padding: 20px; }
            /* Typography */
            h1 { font-size: 24px; color: #ffffff; margin-top: 0; margin-bottom: 10px; }
            h2 { font-size: 20px; color: #333333; margin-top: 20px; margin-bottom: 10px; }
            p { font-size: 16px; color: #666666; line-height: 24px; margin-bottom: 15px; }
            .order-details p { font-size: 14px; color: #555555; }
            .product-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .product-table th, .product-table td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; font-size: 14px; }
            .product-table th { background-color: #f2f2f2; font-weight: bold; }
            .summary-table { width: 100%; margin-top: 20px; }
            .summary-table td { padding: 8px 0; font-size: 14px; color: #555555; }
            .summary-table .total-row { font-weight: bold; font-size: 16px; color: #222222; }
        </style>
    </head>
    <body style="margin: 0; padding: 0;">
        <div class="wrapper">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" class="content-table">
                <!-- HEADER -->
                <tr>
                    <td align="center" class="header">
                        <a href="#" target="_blank">
                            <img src="https://placehold.co/120x60/333/fff?text=Logo" alt="Company Logo" style="display: block; border: 0;">
                        </a>
                    </td>
                </tr>

                <!-- HERO SECTION -->
                <tr>
                    <td align="center" class="hero">
                        <h1 style="color: #ffffff; margin-top: 0;">আপনার অর্ডারটি নিশ্চিত করা হয়েছে! 🎉</h1>
                        <p style="color: #ffffff; font-size: 16px;">আপনার অর্ডারের জন্য আপনাকে ধন্যবাদ।</p>
                    </td>
                </tr>

                <!-- BODY CONTENT -->
                <tr>
                    <td class="body-content">
                        <p>প্রিয় <strong>${shippingInfo.fullName}</strong>,</p>
                        <p>আপনার অর্ডার <strong>#${
                          invoice.invoiceId
                        }</strong> সফলভাবে নিশ্চিত হয়েছে। আপনার অর্ডারটি শীঘ্রই পাঠানো হবে।</p>

                        <table class="product-table">
                            <thead>
                                <tr>
                                    <th style="border-bottom: 2px solid #ddd;">পণ্য</th>
                                    <th style="border-bottom: 2px solid #ddd;">পরিমাণ</th>
                                    <th style="border-bottom: 2px solid #ddd; text-align: right;">মূল্য</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Product rows generated dynamically -->
                                ${productRows}
                            </tbody>
                        </table>

                        <table class="summary-table">
                            <tr>
                                <td>পণ্যের মোট মূল্য:</td>
                                <td style="text-align: right;">${
                                  invoice.totalAmount
                                } টাকা</td>
                            </tr>
                            <tr>
                                <td>ডিসকাউন্ট:</td>
                                <td style="text-align: right;">-${
                                  invoice.discountAmount
                                } টাকা</td>
                            </tr>
                            <tr>
                                <td>ডেলিভারি চার্জ:</td>
                                <td style="text-align: right;">+${
                                  invoice.deliveryChargeAmount
                                } টাকা</td>
                            </tr>
                            <tr class="total-row">
                                <td style="padding-top: 15px; border-top: 1px solid #ddd;">সর্বমোট:</td>
                                <td style="text-align: right; padding-top: 15px; border-top: 1px solid #ddd;">${
                                  invoice.finalAmount
                                } টাকা</td>
                            </tr>
                        </table>

                        <h2 style="color: #333333; margin-top: 30px;">শিপিংয়ের ঠিকানা</h2>
                        <p class="order-details">
                            <strong>নাম:</strong> ${shippingInfo.fullName}<br>
                            <strong>ঠিকানা:</strong> ${shippingInfo.address}<br>
                            <strong>শহর:</strong> ${shippingInfo.city}<br>
                            <strong>ফোন:</strong> ${shippingInfo.phone}<br>
                            <strong>পেমেন্ট পদ্ধতি:</strong> ${
                              order.paymentMethod
                            }
                        </p>

                        <p>যেকোনো জিজ্ঞাসা বা সহায়তার জন্য, আমাদের সাথে যোগাযোগ করুন।</p>
                    </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                    <td class="footer">
                        <p style="margin: 0; font-size: 14px; color: #cccccc;">© ${new Date().getFullYear()} আপনার কোম্পানি। সর্বস্বত্ব সংরক্ষিত।</p>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #cccccc;"><a href="${
                          process.env.FRONTEND_URL
                        }" style="color: #ffffff;">ওয়েবসাইট</a> | <a href="${
    process.env.FACEBOOK_URL
  }" style="color: #ffffff;">ফেসবুক</a></p>
                    </td>
                </tr>
            </table>
        </div>
    </body>
    </html>
  `;
  return template;
};

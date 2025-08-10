const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  // secure: true,
  auth: {
    user: "taufikislam172@gmail.com",
    pass: "pwfl bspq eehg kcze",
  },
});

const sendEmail = async (to, subject, template) => {
  try {
    const info = await transporter.sendMail({
      from: "Jahir ecommerce <taufikislam172@gmail.com>",
      to: to,
      subject: subject,
      html: template,
    });

    console.log("Message sent:", info.messageId);
  } catch (error) {
    console.log("Error sending email: ", error);
  }
};

module.exports = { sendEmail };

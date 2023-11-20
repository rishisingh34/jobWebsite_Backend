const User = require("../models/user.model");
const bcryptjs = require("bcryptjs");
const { token } = require("../utils/token.util");
const { sendmail , sendOtpMail} = require("../utils/mailer.util");
const Otp = require("../models/otp.model");
// const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const tokenExpiration = Date.now() + 24 * 60 * 60 * 1000;
const authSchema = require('../utils/validationSchema.util')

const authCtrl = {
  signUp: async (req, res) => {
    try {
      // storing responses recieved from client side
      // const { email, password, name, number } = req.body;

      const validationErrors = {};

      try {
        await authSchema.validateAsync(req.body);
      } catch (validationErr) {
        validationErr.details.forEach((error) => {
          if (!validationErrors[error.path[0]]) {
            validationErrors[error.path[0]] = [];
          }
          validationErrors[error.path[0]].push(error.message);
        });
      }

      if (Object.keys(validationErrors).length > 0) {
        return res.status(400).json({ errors: validationErrors });
      }

      const result = await authSchema.validateAsync(req.body);
      const { email, password, name, number } = result;

      const user = await User.findOne({ email: email });

      const hashedPassword = await bcryptjs.hash(password, 8); // hashing Password using bcrypt

      if (user) {
        if (user.isVerified) {
          res.status(409).json({ message: "User already exists" });
          return;
        } else {
          if (
            !user.verificationToken.expiration ||
            user.verificationToken.expiration < Date.now()
          ) {
            const newToken = crypto.randomBytes(20).toString("hex");

            await User.findOneAndUpdate(
              { email: email },
              {
                $set: {
                  name: name,
                  password: hashedPassword,
                  contact: number,
                  verificationToken: {
                    token: newToken,
                    expiration: tokenExpiration,
                  },
                },
              }
            );

            res.status(200).json({
              message:
                "User updated successfully. Verification Link Sent Again",
            });
            return;
          } else {
            res.status(200).json({
              message:
                "Verification Link Already Sent. Check Your Email. New Verification Link Will Be Sent After 24Hrs",
            });
            return;
          }
        }
      }

      // generating verification token for email verfication in database
      const token = crypto.randomBytes(20).toString("hex");

      // attaching verifcation token in Link
      const verificationLink = `https://workshala.onrender.com/verifyEmailPage?token=${token}`;

      const newUser = new User({
        name: name,
        password: hashedPassword,
        email: email,
        contact: number,
        isVerified: false,
        verificationToken: {
          token: token, // Token for Email Verification
          expiration: tokenExpiration, // Token Expiration in 24hrs
        },
      });

      await newUser.save();

      sendmail(email, verificationLink, "Email Verificaition Link");

      res.status(201).json({
        success: true,
        message: "User Created Successfully, Please Verify Email",
        data: {
          name: name,
          email: email,
        },
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
  renderVerifyEmailPage: async (req, res) => {
    try {
      const { token } = req.query;
      const user = await User.findOne({ "verificationToken.token": token });

      if (!user || user.verificationToken.expiration < Date.now()) {
        return res.status(404).json({ error: "Invalid or expired token" });
      }

      await User.findOneAndUpdate(
        { "verificationToken.token": token },
        { 
          $set: { isVerified: true },
          $unset : { verificationToken : 1 }
        }
      );

      res.render("emailVerification"); // Rendering the Successful Verification Page
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email: email });

      if (!user) {
        res.status(404).json({ message: "User not Found" });
        return;
      }

      const passwordCheck = await bcryptjs.compare(password, user.password);

      // Checking email verification
      if (!user.isVerified) {
        res.status(401).json({ message: "Not Verified" });
        return;
      }

      // generating accessToken and refreshToken
      const accessToken = await token.signAccessToken(user.id);
      const refreshToken = await token.signRefreshToken(user.id);

      // sending basic info
      if (passwordCheck) {
        res.status(200).json({
          message: "Login Successful",
          user: {
            name: user.name,
            email: user.email,
          },
          accessToken: accessToken,
          refreshToken: refreshToken,
        });
        return;
      }
      res.status(401).json({ success: false, message: "Invalid Credentials" });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
  refreshToken: async (req, res) => {
    try {
      const { refToken } = req.body;
      if (!refToken) {
        res.status(400).json({ message: "Bad Request" });
        return;
      }
      const userId = await token.verifyRefreshToken(refToken);

      const accessToken = await token.signAccessToken(userId);
      const refreshToken = await token.signRefreshToken(userId);

      res.status(201).json({
        accessToken: accessToken,
        refreshToken: refreshToken,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      let user = await User.findOne({ email });
      if (!user) {
        res.status(404).json({ message: "Email Not Found" });
        return;
      }

      if (!user.isVerified) {
        res.status(401).json({ message: "Email not Verified" });
        return;
      }

      const otp = Math.floor(1000 + Math.random() * 9000);
      let existingOtp = await Otp.findOne({ email });
      if (existingOtp) {
        await existingOtp.updateOne({ otp, createdAt: new Date() });
      } else {
        let newOtp = new Otp({
          email: email,
          otp: otp,
        });
        await newOtp.save();
      }
      console.log(otp);
      sendOtpMail(email, otp, "Reset Passowrd");

      res.json({
        success: true,
        message: "otp is sent to your registered email",
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }
  },
  verifyOtp: async (req, res) => {
    try {
      const { email, otp , newPassword} = req.body;
      let OTP = await Otp.findOne({ email: email });

      if (otp != OTP.otp) {
        res.status(400).json({ message: "Invalid OTP" });
        return;
      }

      Otp.deleteOne({ email });

      let user = await User.findOne({ email : email });
      
      user.updateOne({ password : newPassword });

      res.status(201).json({
        success: true,
        message: "OTP validated. Password Changed",
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
};

module.exports = { authCtrl };

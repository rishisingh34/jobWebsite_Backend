const User = require("../models/user.model");
const bcryptjs = require("bcryptjs");
const {token} = require("../utils/token.util");
const {sendmail} = require("../utils/mailer.util");
const Otp = require("../models/otp.model");
const jwt = require('jsonwebtoken')

const authCtrl = {
  signUp: async (req, res) => {
    try {
      // storing responses recieved from client side
      const { email, password, name, number } = req.body;

      // hashing Password using bcrypt
      const hashedPassword = await bcryptjs.hash(password, 8);

      // this block checks if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        if (!existingUser.isVerified) {

          // updating the existing user's detail whose email is not verified 
          existingUser.updateOne({
            email: email,
            name: name,
            password: hashedPassword,
            contact: number,
          });
        }else{
          res.status(409).json({ success: false, message: "User already Exists" });
          return;
        }
      }

      // storing new user's info in database
      const newUser = new User({
        name: name,
        email: email,
        password: hashedPassword,
        contact: number,
      });

      // saving the newUser info
      await newUser.save();

      // generating and saving otp for email verfication in database
      let otp = Math.floor(Math.random() * 9000) + 1000;

      let newOtp = new Otp({
        email: email,
        otp: otp,
      });
      await newOtp.save();

      // sending email to req.body.email ---> 
      sendmail(email, otp, "Email Verification Otp");

      // status 201 ---> Created + Sending user's data immediately to the frontend + sending refresh/access Token
      res.status(201).json({
        success: true,
        message: "User Created Succesfully, Please Verify Your Email",
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
  // renderVerifyEmailPage : async (req, res) => {
  //   try { 
  //     res.render('emailVerificationPage');
  //   }catch (err){
  //     console.log(err);
  //     res.status(500).json({ error: "Internal Server Error" });
  //   }
  // },
  verifyEmail: async (req, res) => {
    try {
      const { email, otp } = req.body;

      // finding otp from the database 
      let OTP = await Otp.findOne({ email });
      if (otp != OTP?.otp) {
        res.status(400).json({ message: "OTP Mismatch" });
      }

      // updating the user email verification status 
      await User.findOneAndUpdate(
        { email },
        {
          isVerified: true,
        }
      );
      Otp.deleteOne({ email });
      
      res.json({ success: true, message: "Email is verified" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal Server Error" });
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
          email : email,
          otp : otp,
        });
        await newOtp.save();
      }
      console.log(otp)
      sendmail(email, otp, "Reset Passowrd");

      res.json({
        success: true,
        message: "otp is sent to your registered email",
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message : "Internal Server Error"});
      return;
    }
  },
  verifyOtp: async (req, res) => {
    try {
      const { email, otp } = req.body;
      let OTP = await Otp.findOne({ email: email });

      if (otp != OTP.otp) {
        res.status(400).json({ message: "Invalid OTP" });
        return;
      }

      Otp.deleteOne({ email });

      let user = await User.findOne({ email })
      const resetPasswordToken = jwt.sign( { id : user.id}, process.env.RESET, {
        expiresIn : 600
      });

      res.status(201).json({
        success : true ,
        message : "OTP validated",
        data : {
          resetPasswordToken
        }
      });

    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
  changePassword : async (req, res) =>  {
    try {
      const { email, newPassword } = req.body;

      if (!req.headers["authorization"]) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const authHeader = req.headers["authorization"];
      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(token, process.env.RESET);
      
      if(!decoded){
        res.status(400).json({ message : "Bad Request"});
        return;
      }  
    

      const hashedPassword = await bcryptjs.hash(newPassword, 8);
      await User.findOneAndUpdate(
        { email: email },
        { password: hashedPassword }
      );

      res.status(201).json({ message: "Password Changed Succesfully" });

    }catch(err){
      console.log(error);
      res.status(500).json({ message : "Internal Server Error"});
    }
  }
};

module.exports = {authCtrl};
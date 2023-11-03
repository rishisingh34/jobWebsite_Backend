const User = require("../models/user.model");
const bcryptjs = require("bcryptjs");
const {token} = require("../utils/token.util");

const userCtrl = {
    signUp : async (req, res) => {
        try {
            // storing responses recieved from client side
            const {email , password , firstName , lastName} = req.body; 

            // concatenating to get fullName 
            const name = firstName + " " + lastName ; 
            
            // this block checks if email already exists 
           const checkEmail = await User.findOne({ email });
           if( checkEmail ){
            res.status(409).json({ success : false , message : "User already Exists"}); 
            return ; 
           }

           // hashing Password using bcrypt 
           const hashedPassword = await bcryptjs.hash(password, 8);

           // storing user's info in database 
           const newUser = new User({
            name : name ,
            email : email ,
            password : hashedPassword
           })

           // saving the newUser info 
           await newUser.save();

           // generating accessToken and refreshToken
           const accessToken = await token.signAccessToken(newUser.id);
           const refreshToken = await token.signRefreshToken(newUser.id);

           // status 201 ---> Created + Sending user's data immediately to the frontend 
           res.status(201).json({
             success: true,
             message: "User Created Succesfully",
             data: {
               name: name,
               email: email,
             },
             accessToken: accessToken,
             refreshToken: refreshToken,
           });

        } catch(err){
            res.status(500).json({ error : "Internal Server Error"});
        }
    },

    login : async (req, res) => {
        try{
          const { email, password } = req.body;
          const user = await User.findOne({ email: email });

          if (!user) {
            res.status(404).json({ message: "User not Found" });
            return;
          }

          const passwordCheck = await bcryptjs.compare(password, user.password);

          // generating accessToken and refreshToken
          const accessToken = await token.signAccessToken(user.id);
          const refreshToken = await token.signRefreshToken(user.id);

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
          res.status(401).json({ success: false, message: "Not Authorized" });
        }catch(err){
            res.status(500).json({ message : "Internal Server Error"});
        }
    }
};

module.exports = {userCtrl};
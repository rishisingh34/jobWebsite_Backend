const Job = require("../models/job.model");
// const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const axios = require('axios');
const Company = require('../models/company.model');
const multer = require('multer')

const workshalaCtrl = {
    dashBoard : async (req, res) => {
        try {
            const userId = req.user.id;
            const existingProfile = await Profile.findOne({ userId : userId });

            if(!existingProfile) {
                const newProfile = new Profile({
                    userId : userId,
                    name : req.user.name
                });
                await newProfile.save();
            }

            res.status(200).json(req.user);

        }catch(err){
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"}); 
        }
    },
    getProfile : async (req, res) => {       
        try{
            const userId = req.user.id;
            const existingProfile = await Profile.findOne({ userId: userId });
            res.status(200).json(existingProfile);
        }catch(err){
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }

    },
    updateProfile : async (req, res) => {
        try {

            await Profile.findOneAndUpdate(
              { userId: req.user.id },
              {
                name: req.body.name,
                about: req.body.about,
                skills: req.body.skills || [],
                currentCity: req.body.currentCity,
                gender: req.body.gender,
                language: req.body.language,
                studentType: req.body.studentType,
                preferences: req.body.preferences || [],
                positionApplied: req.body.positionApplied,
                workLocation: req.body.workLocation || [],
                imageUrl : req.body.imageUrl
              }
            );

            res.status(200).json({ message : "Successfully updated profile" });

        }catch(err){
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    },
    getJobs : async (req, res) => {
        try {
            
            const jobs = await Job.find();
            res.status(200).json(jobs);
        } catch(err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    },
    jobByPreferences : async (req, res) => {
        try {
            const userId = req.user.id;
            const userProfile = await Profile.findOne({ userId : userId});
            const preferences = userProfile.preferences;

            const recommendationApiUrl = `https://internship-recommendation-modal2.onrender.com/recommendations/${preferences}`;
            const response = await axios.get(recommendationApiUrl);
            const recommendations = response.data.recommendations;
            const objectIds = recommendations.map((item) => item[0]);

            const jobs = await Job.find({ _id: { $in: objectIds }});
            res.status(200).json(jobs);
            

        } catch(err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    },
    getCompanies : async (req, res) => {
        try {
            const companies = await Company.find();
            res.status(200).json(companies);
        } catch(err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    },
    getJobsByCompanyName : async (req, res) => {
        try {
            const {companyName} = req.body;
            const jobs = await Job.find({ companyName: companyName });
            res.status(200).json(jobs);
        } catch(err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    },
};

module.exports = {workshalaCtrl};


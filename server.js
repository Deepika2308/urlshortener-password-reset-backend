import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt, { compareSync } from 'bcrypt';
import dotenv from 'dotenv';
import {sendVerificationMail,sendResetLink} from "./mailer.js";
import jwt from 'jsonwebtoken';
import short from 'short-uuid';
dotenv.config();

const app=express();
const PORT=process.env.PORT;
app.use(express.json());
app.use(cors());

const MONGO_URL = process.env.MONGO_URL;

async function createConnection(){
    let client= new MongoClient(MONGO_URL);
    await client.connect();
    console.log("***connected to mongodb***");
    return client;
}

const client=await createConnection();

app.get("/", (req,res) => {
    res.send("This is URL shortener app")
})

app.post("/register", async(req,res) =>{
    let newUser = req.body;
    let userEmail = newUser.email;

    const password = newUser.password;
    const hashedPass = await generatePassword(password);
    newUser.password = hashedPass;
    let getAllUsers = await client.db("Day38").collection("users").findOne({email:newUser.email});
    
    if(getAllUsers){
        res.send({msg:"Email is already registered!!"});
    }
    else{
        let result = await client.db("Day38").collection("users").insertOne(newUser);
        let insertId = result.insertedId.toString();
        await sendVerificationMail({toMailId:userEmail,userId:insertId});
    res.send({msg:"Link has been sent to the registered mail id. Please follow the link to activate the account!!"});
    }
    
})

app.post("/login", async(req,res) => {
    let {email,password} = req.body;
  
    let result = await client.db("Day38").collection("users").findOne({email:email});
    if(result){
        let dbPassword = result.password;
        let checkPassword = await bcrypt.compare(password,dbPassword);
        if(checkPassword){
            if(result.hasOwnProperty('active')){
                res.send({msg:result});
            }
            else{
                console.log("Inactive account");
                res.send({error:"Account is not yet activated!!"})
            }
        }
        else{
            res.send({error:"Invalid password!!"});
        }
    }
    else{
        res.send({error:"User is not registered with us!!"});
    }
})

//active token is checked while logging in
//users are allowed to login only if this token is true
//will be executed when link in the mail clicked during registration
app.put("/activateUser/:userId", async(req,res) => {
   let {userId} = req.params;
   let {active} = req.body;
   let result = await client.db("Day38").collection("users").updateOne({_id:ObjectId(userId)},{$set:{active:active}});
   console.log(result);
   res.send(result);
})

app.post("/verifyEmail", async(req,res) =>{
    let {email} = req.body;
    let result= await client.db("Day38").collection("users").findOne({email:email});
    if(result){
        res.send({msg:true});
    }
    else{
        res.send({msg:false});
    }
})


app.put("/sendResetLink", async(req,res) =>{
    let {email} = req.body;

 let token = jwt.sign({email:email},process.env.RESET_PASSWORD,{expiresIn:'15m'});

let result = await client.db("Day38").collection("users").updateOne({email:email},{$set:{resetToken:token}});
if(result.modifiedCount){
   let sendResetLinkRes = await sendResetLink({toMailId:email,token:token});
   if(sendResetLinkRes){
    res.send({msg:"mailsent"});
   }
   else{
    res.send({msg:"mailnotsent"});
   }
}
else{
    res.send({msg:"updateerror"});
}

})


app.put(`/saveNewPassword`, async(req,res) =>{
    let {token,password} = req.body;
    let hashedPassword = await generatePassword(password);

    let obj ={
        password:hashedPassword,
        resetToken:""
    }
    
   try{
    let verify = jwt.verify(token,process.env.RESET_PASSWORD);
    let email =verify.email;
    let getToken = await client.db("Day38").collection("users").findOne({email:email});
    console.log(getToken);
    if(getToken.resetToken){
        let result = await client.db("Day38").collection("users").updateOne({email:email},{$set:obj});
    if(result.modifiedCount){
        res.send({msg:"Password changed successfully"});
    }
    else{
        res.send({error:"errorchangingpassword"});
    }
    } //if ends
    else{
        res.send({error:"error"});
    }
   }//try ends
   catch(error){
    res.send({error:error});
   }
})


app.post('/shorten', async(req,res) =>{
    let {longUrl,email} = req.body;

    //get the date and store with the shortl url in the database
   let date= new Date();
    
   //check if long url already exists in databaseName
   //if exists, fetch the respective short url already created
    try{
        let checkUrl = await client.db("Day38").collection("urls").findOne({longUrl:longUrl});
        let takeUserActivity = await client.db("Day38").collection("users").findOne({email:email});
    if(checkUrl){
        let activity = takeUserActivity.activity;
        let obj ={
            longUrl:checkUrl.longUrl,
            code:checkUrl.code,
            shortUrl:checkUrl.shortUrl,
            date:date
        }
        
        //check if activity(containing long url, short url, email id and time) available for user
        //if not create one
        if(activity === undefined){
            
            let pushObj = await client.db("Day38").collection("users").updateOne({email:email},{$push:{activity:obj}});
        }
        else{
            let temp = false;
            for(let i=0;i<activity.length;i++){
                if(activity.longUrl === longUrl){
                    temp = true;
                }
            }

            if(!temp){
                let pushObj = await client.db("Day38").collection("users").updateOne({email:email},{$push:{activity:obj}});
            }
        }
        
        res.send({shortUrl:checkUrl.shortUrl,code:checkUrl.code});
    }
    //executed when new long url is entered
    else{
        let defaultDomain = process.env.DEFAULT_DOMAIN;
        console.log(`Default domain is ${defaultDomain}`);
        //short-uuid npm to generate short url
        let code = short.generate();
        console.log(`random code is ${code}`);

        // create short url
        let shortUrl = `${defaultDomain}/${code}`;
        

        //url details to store in 'url' collection
        let obj ={
            longUrl:longUrl,
            code:code,
            shortUrl:shortUrl,
            date:date
        }

        //user details to store in user collection
        let userObj = {
            longUrl:longUrl,
            code:code,
            shortUrl:shortUrl,
            date:date,
        }

        let result = await client.db("Day38").collection("urls").insertOne(obj);
        let result2 = await client.db("Day38").collection("users").updateOne({email:email},{$push:{activity:userObj}})
        
        if(result.acknowledged){
            let getShortUrl = await client.db("Day38").collection("urls").findOne({_id:ObjectId(result.insertedId)});
            
            res.send({shortUrl:getShortUrl.shortUrl,code:getShortUrl.code});
        }
        else{
            res.send({error:'Error is creating short url'});
        }
    }
    }
    catch(error){
        console.log(error);
        res.send({error:error});
    }
})


//fetch the corresponding lon url from url collection
app.get("/redirect/:code", async(req,res) => {
    let {code} = req.params;

    try{
        let getLongUrl = await client.db("Day38").collection("urls").findOne({code:code});
    if(getLongUrl){
        res.send({msg:getLongUrl.longUrl});
    }
    else{
        res.send({error:"Invalid Code"});
    }
    }
    catch(error){
        res.send({error:error});
    }
    
})


app.get("/getDailyCount", async(req,res) => {
    let result =  await client.db("Day38").collection("urls").aggregate([
        {$group:{_id:{$dateToString:{format:"%Y-%m-%d", date:"$date"}},count:{$sum:1}}},
        {$sort:{_id:1}}
    ]).toArray();
res.send(result);
   
})


app.get("/getMonthlyCount", async(req,res) => {
    let result =  await client.db("Day38").collection("urls").aggregate([
        {$group:{_id:{$month:{date:"$date"}},count:{$sum:1}}},
        {$sort:{_id:1}}
    ]).toArray();
res.send(result);
   
})

app.get("/acitivity/:email", async(req,res) => {
   let {email} = req.params;
   let result = await client.db("Day38").collection("users").findOne({email:email});
   res.send({msg:result.activity});
})


async function generatePassword(password){
    const saltValue = await bcrypt.genSalt(5);
    const hashedPassword  = await bcrypt.hash(password,saltValue);
    return hashedPassword;
}

app.listen(PORT,() => console.log(`App is running is ${PORT}`));
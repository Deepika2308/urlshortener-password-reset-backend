import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {useNavigate} from "react-router-dom";

dotenv.config();

export function sendVerificationMail({toMailId,userId}){

    let navigate= useNavigate();

    return new Promise((res,rej) => {
        const transporter = nodemailer.createTransport({
            service:'gmail',
            auth:{
                user:process.env.GOOGLE_USER,
                pass:process.env.GOOGLE_PASSWORD
            }
        })

        //set from mail id, to mail id, subject and mail body
        const message={
            from:process.env.GOOGLE_USER,
            to:toMailId,
            subject:"Account Activation",
            // html:`<form method="PUT">
            // <h3>Hello,</h3>
            // <p>Thank you for registering with us.</p>
            // <p>To activate your account, please click on the below li
            // nk..</p>
            // <p><a target="_blank" href=${process.env.DOMAIN}/activate/user/${userId}>Click here to activate</a></p>
            // <p>Regards,</p>
            // <p>Application Team</p>
            // </form>`
            html:`<form method="PUT">
            <h3>Hello,</h3>
            <p>Thank you for registering with us.</p>
            <p>To activate your account, please click on the below li
            nk..</p>
            <p><button onClick={() => navigate(${process.env.DOMAIN}/activate/user/${userId})}></p>
            <p>Regards,</p>
            <p>Application Team</p>
            </form>`
        }

        transporter.sendMail(message,function(err,info) {
            if(err){
                rej(err);
            }
            else{
                res(info);
            }
        })
    }) 
}


export function sendResetLink({toMailId,token}){

    return new Promise((res,rej) => {
        const transporter = nodemailer.createTransport({
            service:'gmail',
            auth:{
                user:process.env.GOOGLE_USER,
                pass:process.env.GOOGLE_PASSWORD
            }
        })

        //set from mail id, to mail id, subject and mail body
        const message={
            from:process.env.GOOGLE_USER,
            to:toMailId,
            subject:"Password Reset",
            html:`<form method="PUT">
            <h3>Hello,</h3>
            <p>Click on the below link to reset password</p>
            <p><a target="_blank" href=${process.env.DOMAIN}/resetPassword/${token}>${process.env.DOMAIN}/resetPassword/${token}</a></p>
            <p>Regards,</p>
            <p>Application Team</p>
            </form>`
        }

        transporter.sendMail(message,function(err,info) {
            if(err){
                rej(err);
            }
            else{
                res(info);
            }
        })
    }) 
}
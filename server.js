import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'

dotenv.config();

const app=express();

const PORT=process.env.PORT



app.listen(PORT,()=>{
console.log("server başarılıyla başlatıldı")
})
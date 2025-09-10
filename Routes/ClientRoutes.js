import express from 'express'
import multer from 'multer'
import { ClientRegister } from '../Controller/ClientController.js'
import path from 'path';

const router = express.Router()


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage: storage })


router.post('/register', upload.single('photo'), ClientRegister)

export default router

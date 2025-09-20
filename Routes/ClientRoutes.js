import express from 'express'
import multer from 'multer'
import { AddFriends, AddYorum, ClientLogin, ClientRegister, DeleteClient, deleteIlan, getAllUsers, GetDataClient, GetFriendsList, GetFriendsSayi, GetYorumlar, IlanKayit, IlanShow, MyIlanlar, PostLocation, ResponseFriendRequest, ShowDangerLocations, ShowFriendRequest,  } from '../Controller/ClientController.js'
import path from 'path';
import verifyToken from '../Middlewares/AuthMiddlewares.js';

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
router.post('/login',ClientLogin)
router.get('/clientpanel',verifyToken,GetDataClient)
router.post('/ilanekle',verifyToken,IlanKayit)
router.get('/ilanlar', verifyToken, IlanShow)
router.post('/ilanlar/:ilanId/yorumlar', verifyToken, AddYorum)
router.get('/ilanlar/:ilanId/yorumlar',verifyToken ,GetYorumlar)
router.get('/myshow',verifyToken,MyIlanlar)
router.delete('/ilan/:id', verifyToken, deleteIlan);
router.post('/client/emergency-location', verifyToken, PostLocation);
router.get('/client/getallusers',verifyToken,getAllUsers)
router.post('/add-friend',verifyToken, AddFriends);
router.get('/show-friendrequest', verifyToken, ShowFriendRequest);
router.post('/respond-friendrequest',verifyToken,ResponseFriendRequest)
router.get('/friendsayi',verifyToken,GetFriendsSayi)
router.delete("/:friendId", verifyToken, DeleteClient);
router.get("/friends", verifyToken,GetFriendsList);
router.get("/locations/danger", verifyToken,ShowDangerLocations);

export default router

import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';

const router = express.Router();

// User Login (using sessions)
router.post('/login', async (req, res) => {
 try {
   const { username, password } = req.body;

   const user = await User.findOne({ username });
   if (!user || !(await bcrypt.compare(password, user.password))) {
     return res.status(401).json({ message: 'Invalid credentials' });
   }

   // Create a session for the user
   req.session.userId = user._id;
   res.status(200).json({ message: 'Login successful', userId: user._id });

 } catch (error) {
   res.status(500).json({ message: error.message });
 }
});


router.get('/profile', (req, res) => {
 if (req.session.userId) {
  
  
   res.status(200).json({ userId: req.session.userId, message: 'User profile' });
 } else {
   res.status(401).json({ message: 'Not authenticated' });
 }
});

export { router as userRoutes };
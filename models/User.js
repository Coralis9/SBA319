import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
 username: {
   type: String,
   required: true,
   unique: true,
   trim: true,
   lowercase: true
 },
 password: {
   type: String,
   required: true
 },
 registrationDate: {
   type: Date,
   default: Date.now
 }

});

const User = mongoose.model('User', UserSchema);

export default User;
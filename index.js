import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { gameRoutes } from './routes/gameRoutes.js'; 
import { userRoutes } from './routes/userRoutes.js'; 

dotenv.config();

const app = express();
const port = process.env.PORT || 5051;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static('public'));


app.use('/api/games', gameRoutes);


app.use('/api/users', userRoutes);


mongoose.connect(process.env.ATLAS_URI);
mongoose.connection.once('open', () => {
 console.log('connected to mongoDB');
});

app.listen(port, () => {
 console.log(`Server is running on http://localhost:${port}`);
});










// import express from 'express';
// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();
// const port = process.env.PORT || 5051;


// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());


// app.use(express.static('public'));

// // Mongoose Connection
// mongoose.connect(process.env.ATLAS_URI);
// mongoose.connection.once('open', () => {
//     console.log('connected to mongoDB');
// });

// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });
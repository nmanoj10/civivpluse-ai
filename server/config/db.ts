import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export default async function connectDB() {
  let uri = process.env.MONGO_URI;
  let isMemory = false;
  
  if (!uri) {
    console.log('MONGODB_URI not found. Starting MongoMemoryServer for development...');
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
    isMemory = true;
  }
  
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${isMemory ? 'Memory Server' : 'Remote DB'}`);
    return { isMemory };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export const closeDB = async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
};


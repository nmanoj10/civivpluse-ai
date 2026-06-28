import { Server, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { User } from '../modules/users/user.model';
import { logger } from '../utils/logger';

let io: Server | null = null;

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // JWT Authentication Handshake Middleware
  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        logger.error('SocketIO', 'Handshake failed: Token missing');
        return next(new Error('Authentication error: Token missing'));
      }

      const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-dev');
      const user = await User.findById(decodedToken._id).select('-passwordHash');
      
      if (!user) {
        logger.error('SocketIO', 'Handshake failed: User not found');
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err: any) {
      logger.error('SocketIO', 'Handshake error', { message: err?.message });
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket: any) => {
    const user = socket.user;
    logger.info('SocketIO', `User connected: ${user.name} (${user.role})`, { socketId: socket.id });

    // Join direct user room
    const userRoom = `user:${user._id.toString()}`;
    socket.join(userRoom);

    // Join geographical rooms
    if (user.ward) {
      const wardRoom = `ward:${user.ward.toString().trim()}`;
      socket.join(wardRoom);
      logger.info('SocketIO', `Joined room: ${wardRoom}`, { name: user.name });
    }
    if (user.city) {
      const cityRoom = `city:${user.city.toString().trim()}`;
      socket.join(cityRoom);
      logger.info('SocketIO', `Joined room: ${cityRoom}`, { name: user.name });
    }
    if (user.locality) {
      const localityRoom = `locality:${user.locality.toString().trim()}`;
      socket.join(localityRoom);
      logger.info('SocketIO', `Joined room: ${localityRoom}`, { name: user.name });
    }

    // Role-based rooms
    if (user.role === 'admin') {
      socket.join('admin');
      logger.info('SocketIO', 'Joined room: admin', { name: user.name });
    } else if (user.role === 'ward_officer') {
      socket.join('officer');
      logger.info('SocketIO', 'Joined room: officer', { name: user.name });
      if (user.ward) {
        socket.join(`officer:ward:${user.ward}`);
      }
    }

    socket.on('disconnect', () => {
      logger.info('SocketIO', `User disconnected: ${user.name}`, { socketId: socket.id });
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized yet!');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

export const emitToRoom = (room: string, event: string, data: any) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

export const emitToGlobal = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
  }
};
